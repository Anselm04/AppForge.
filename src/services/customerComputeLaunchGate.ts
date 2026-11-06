import { TRPCError } from "@trpc/server";

/**
 * This is a RELEASE STOP, not a substitute for real provider cost metering.
 *
 * Current build reservation charges a fixed 5 abstract credits, while the
 * autonomous pipeline can use unbounded external AI/provider resources.
 * No environment toggle is allowed to pretend that is a USD spending cap.
 * Remove this stop ONLY in a reviewed change which installs atomic
 * per-customer/per-job monetary reservations, provider metering and hard
 * enforcement inside every external billable call.
 *
 * Only explicit local test/development CI can use mocked model calls. Unknown runtimes fail closed. Owner review/test actions
 * are explicitly outside paid customer launch certification.
 */
export const CUSTOMER_COMPUTE_NOT_CERTIFIED =
  "Customer builds are paused while AppForge completes provider-cost metering and spending protection. Your saved work and purchased credits are preserved; no new paid build will start.";

export function customerComputeLaunchCertified(
  environment: string | undefined = process.env.NODE_ENV,
): boolean {
  // This is deliberately NOT controlled by a config flag: env=true is not
  // evidence that all AI, VM, storage, egress and retry charges are capped.
  return environment === "test" || environment === "development";
}

export function assertCustomerComputeLaunchCertified(
  owner: boolean,
  environment: string | undefined = process.env.NODE_ENV,
): void {
  if (owner || customerComputeLaunchCertified(environment)) return;
  throw new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: CUSTOMER_COMPUTE_NOT_CERTIFIED,
  });
}
