import { randomUUID } from "node:crypto";
import {
  assertProviderPricesConfirmed,
  maximumProviderEnvelopeCents,
  trustedRates,
  type CostEnvelope,
} from "../lib/providerCostEnvelope.js";
import { runReservedProviderOperation } from "./guardedProviderOperation.js";

/**
 * Executes exactly one network attempt with a reviewed monetary maximum
 * reserved atomically BEFORE any provider request. Every retry and model
 * fallback must call this again with its own operation ID.
 *
 * A network error or a successful response without trustworthy usage evidence
 * retains the original reservation for reconciliation; never refund an
 * uncertain charge or retry without a separate reservation.
 */
export async function dispatchCostedLlmAttempt(
  input: {
    provider: string;
    model: string;
    maxInputTokens: number;
    maxOutputTokens: number;
    externalRuntimeStorageEgressCents: number;
  },
  dispatch: () => Promise<Response>,
): Promise<Response> {
  const approved = trustedRates().find(
    (rate) => rate.provider === input.provider && rate.model === input.model,
  );
  if (!approved) throw new Error("Provider/model has no reviewed billing rate");
  if (
    !Number.isSafeInteger(input.externalRuntimeStorageEgressCents) ||
    input.externalRuntimeStorageEgressCents < 1 ||
    !Number.isSafeInteger(input.maxInputTokens) ||
    input.maxInputTokens < 1 ||
    !Number.isSafeInteger(input.maxOutputTokens) ||
    input.maxOutputTokens < 1
  ) {
    throw new Error("LLM provider cost ceiling is incomplete");
  }
  const envelope: CostEnvelope = {
    attempts: [{
      provider: approved.provider,
      model: approved.model,
      maxInputTokens: input.maxInputTokens,
      maxOutputTokens: input.maxOutputTokens,
      inputUsdMicrosPerMillionTokens: approved.inputUsdMicrosPerMillionTokens,
      outputUsdMicrosPerMillionTokens: approved.outputUsdMicrosPerMillionTokens,
      fixedRequestCents: approved.fixedRequestCents,
    }],
    externalRuntimeStorageEgressCents: input.externalRuntimeStorageEgressCents,
    priceSnapshotSource: "provider_confirmed",
    priceSnapshotValidUntil: approved.validUntil,
  };
  assertProviderPricesConfirmed(envelope);
  const maximumCents = maximumProviderEnvelopeCents(envelope);
  const operationId = "llm_" + randomUUID().replace(/-/g, "");

  return runReservedProviderOperation(
    { operationId, envelope },
    async () => {
      const response = await dispatch();
      if (!response.ok) {
        // A failed HTTP call can still incur provider charges.
        throw new Error(
          `Provider attempt returned HTTP ${response.status}; reserved maximum ${maximumCents} cents awaits reconciliation`,
        );
      }

      const body = (await response.clone().json()) as {
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const actualInput = body.usage?.prompt_tokens;
      const actualOutput = body.usage?.completion_tokens;
      if (
        !Number.isSafeInteger(actualInput) ||
        !Number.isSafeInteger(actualOutput) ||
        actualInput === undefined ||
        actualOutput === undefined ||
        actualInput < 0 ||
        actualOutput < 0 ||
        actualInput > input.maxInputTokens ||
        actualOutput > input.maxOutputTokens
      ) {
        throw new Error(
          "Provider usage missing or exceeded approved bounds; charge remains reserved for reconciliation",
        );
      }
      const verified = maximumProviderEnvelopeCents({
        ...envelope,
        attempts: [{
          ...envelope.attempts[0],
          maxInputTokens: Math.max(1, actualInput),
          maxOutputTokens: Math.max(1, actualOutput),
        }],
      });
      return { value: response, verifiedCents: Math.min(maximumCents, verified) };
    },
  );
}
