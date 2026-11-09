import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, getSubscriptionByUserId } from "../db.js";
import {
  PROVIDER_CREDIT_TOP_UP_PERIOD_LIMIT_USD_CENTS,
  PROVIDER_CREDIT_PACK_PRICE_ID_ENV,
  PURCHASED_PROVIDER_CREDIT_PACKS_CENTS,
  PURCHASED_PROVIDER_CREDIT_PACK_PRICES_USD_CENTS,
  type ProviderCreditPackCents,
} from "../lib/providerCreditPolicy.js";
import { assertEligibleForCreditTopUp } from "./appForgeCreditEligibility.js";
import { assertCommercialCheckoutReady } from "./appForgeCommercialCheckoutGate.js";
import { getAppForgeStripe } from "./appForgeStripe.js";
import { assertAppForgePrice } from "./appForgePricePolicy.js";

const safeId = (value: number) => Number.isSafeInteger(value) && value > 0;
const validStripeSessionId = (value: string) =>
  /^cs_(?:(?:test|live)_)?[A-Za-z0-9]+$/.test(value);

function providerCreditPack(value: number): ProviderCreditPackCents {
  if (
    !PURCHASED_PROVIDER_CREDIT_PACKS_CENTS.includes(
      value as ProviderCreditPackCents,
    )
  ) {
    throw new Error("Unsupported provider-credit pack");
  }
  return value as ProviderCreditPackCents;
}

function requireProviderCreditPriceId(pack: ProviderCreditPackCents): string {
  const priceId = process.env[PROVIDER_CREDIT_PACK_PRICE_ID_ENV[pack]]?.trim();
  if (!priceId) {
    throw new Error(
      `Stripe price ID not configured for provider-credit pack: ${pack}`,
    );
  }
  return priceId;
}

export async function reserveProviderCreditTopUp(
  userId: number,
  packValue: number,
  expiresAt: Date,
): Promise<{ id: string; periodStart: string; customerId: string }> {
  const reservationLifetimeMs = expiresAt.getTime() - Date.now();
  if (
    !safeId(userId) ||
    !Number.isFinite(expiresAt.getTime()) ||
    reservationLifetimeMs <= 0 ||
    reservationLifetimeMs > 24 * 60 * 60 * 1000
  ) {
    throw new Error("Invalid provider-credit reservation");
  }
  const pack = providerCreditPack(packValue);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId})`);
    const subscriptions = await tx.execute<{
      status: string | null;
      tier: string | null;
      periodStart: Date | string | null;
      periodEnd: Date | string | null;
      trialEnd: Date | string | null;
      customerId: string | null;
    }>(sql`
      SELECT status, tier, current_period_start AS "periodStart",
        current_period_end AS "periodEnd", trial_end AS "trialEnd",
        stripe_customer_id AS "customerId"
      FROM subscriptions WHERE user_id = ${userId} FOR UPDATE
    `);
    const subscription = (
      subscriptions as unknown as Array<{
        status: string | null;
        tier: string | null;
        periodStart: Date | string | null;
        periodEnd: Date | string | null;
        trialEnd: Date | string | null;
        customerId: string | null;
      }>
    )[0];
    assertEligibleForCreditTopUp({
      status: subscription?.status,
      tier: subscription?.tier,
      currentPeriodEnd: subscription?.periodEnd
        ? new Date(subscription.periodEnd)
        : null,
      trialEnd: subscription?.trialEnd ? new Date(subscription.trialEnd) : null,
    });
    const start = subscription?.periodStart
      ? new Date(subscription.periodStart)
      : null;
    const end = subscription?.periodEnd
      ? new Date(subscription.periodEnd)
      : null;
    if (
      !start ||
      !end ||
      !subscription.customerId ||
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start >= end ||
      start > new Date() ||
      end <= new Date()
    ) {
      throw new Error(
        "A current Stripe billing period is required for top-ups",
      );
    }

    const periodStart = start.toISOString();
    const amount = PURCHASED_PROVIDER_CREDIT_PACK_PRICES_USD_CENTS[pack];
    const totals = await tx.execute<{ usedCents: string }>(sql`
      SELECT COALESCE(SUM(price_usd_cents), 0)::text AS "usedCents"
      FROM provider_credit_topups
      WHERE user_id = ${userId}
        AND period_start = ${periodStart}::timestamptz
        AND (
          status = 'paid'
          OR status = 'reserved'
        )
    `);
    const usedCents = Number(
      (totals as unknown as Array<{ usedCents: string }>)[0]?.usedCents ?? 0,
    );
    if (
      !Number.isSafeInteger(usedCents) ||
      usedCents < 0 ||
      usedCents + amount > PROVIDER_CREDIT_TOP_UP_PERIOD_LIMIT_USD_CENTS
    ) {
      throw new Error(
        "Provider-credit purchases exceed the approved billing-period limit",
      );
    }

    const id = randomUUID();
    await tx.execute(sql`
      INSERT INTO provider_credit_topups
        (id, user_id, period_start, credits_cents, price_usd_cents, expires_at)
      VALUES (
        ${id}::uuid, ${userId}, ${periodStart}::timestamptz, ${pack}, ${amount},
        ${expiresAt.toISOString()}
      )
    `);
    return { id, periodStart, customerId: subscription.customerId };
  });
}

export async function createProviderCreditCheckout(
  user: { id: number; email?: string | null },
  packValue: number,
): Promise<{ url: string }> {
  await assertCommercialCheckoutReady();
  if (!safeId(user.id)) throw new Error("Valid customer is required");
  const pack = providerCreditPack(packValue);
  const subscription = await getSubscriptionByUserId(user.id);
  assertEligibleForCreditTopUp(subscription);
  const publicAppUrl = process.env.PUBLIC_APP_URL?.trim();
  if (!publicAppUrl) throw new Error("PUBLIC_APP_URL is required");
  let appOrigin: string;
  try {
    const parsedUrl = new URL(publicAppUrl);
    if (
      process.env.NODE_ENV === "production" &&
      parsedUrl.protocol !== "https:"
    ) {
      throw new Error("PUBLIC_APP_URL must use HTTPS in production");
    }
    appOrigin = parsedUrl.origin;
  } catch {
    throw new Error("PUBLIC_APP_URL must be a valid absolute URL");
  }

  const stripe = await getAppForgeStripe();
  const priceId = requireProviderCreditPriceId(pack);
  const price = await stripe.prices.retrieve(priceId);
  const priceCents = PURCHASED_PROVIDER_CREDIT_PACK_PRICES_USD_CENTS[pack];
  assertAppForgePrice(
    price,
    priceCents,
    "one_time",
    process.env.NODE_ENV === "production",
  );

  const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000);
  const reservation = await reserveProviderCreditTopUp(
    user.id,
    pack,
    expiresAt,
  );
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      expires_at: Math.floor(expiresAt.getTime() / 1000),
      success_url: `${appOrigin}/dashboard?checkout=success`,
      cancel_url: `${appOrigin}/dashboard?checkout=cancelled`,
      customer: reservation.customerId,
      client_reference_id: String(user.id),
      metadata: {
        product_line: "appforge_provider_credits",
        userId: String(user.id),
        providerCreditTopUpId: reservation.id,
        creditsCents: String(pack),
      },
      payment_intent_data: {
        metadata: {
          product_line: "appforge_provider_credits",
          userId: String(user.id),
          providerCreditTopUpId: reservation.id,
          creditsCents: String(pack),
        },
      },
    },
    { idempotencyKey: reservation.id },
  );
  const attached = await db.execute(sql`
    UPDATE provider_credit_topups
    SET stripe_session_id = ${session.id}
    WHERE id = ${reservation.id}::uuid
      AND user_id = ${user.id}
      AND status = 'reserved'
    RETURNING id
  `);
  if ((attached as unknown as unknown[]).length !== 1) {
    throw new Error("Unable to attach Stripe session to provider-credit order");
  }
  if (!session.url) {
    throw new Error("Stripe did not return a provider-credit checkout URL");
  }
  return { url: session.url };
}

export async function expireProviderCreditTopUp(input: {
  topUpId: string;
  userId: number;
  sessionId: string;
}): Promise<{ expired: boolean; skipped: boolean }> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input.topUpId,
    ) ||
    !safeId(input.userId) ||
    !validStripeSessionId(input.sessionId)
  ) {
    throw new Error("Invalid provider-credit session expiration");
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.userId})`);
    const rows = await tx.execute<{
      userId: number;
      status: string;
      sessionId: string | null;
    }>(sql`
      SELECT user_id AS "userId", status,
        stripe_session_id AS "sessionId"
      FROM provider_credit_topups
      WHERE id = ${input.topUpId}::uuid
      FOR UPDATE
    `);
    const purchase = (
      rows as unknown as Array<{
        userId: number;
        status: string;
        sessionId: string | null;
      }>
    )[0];
    if (
      !purchase ||
      purchase.userId !== input.userId ||
      (purchase.sessionId && purchase.sessionId !== input.sessionId)
    ) {
      throw new Error("Expired Stripe session does not match provider order");
    }
    if (purchase.status === "expired" || purchase.status === "paid") {
      return { expired: purchase.status === "expired", skipped: true };
    }
    if (purchase.status !== "reserved") {
      throw new Error("Provider-credit order cannot be expired");
    }
    await tx.execute(sql`
      UPDATE provider_credit_topups
      SET status = 'expired', stripe_session_id = ${input.sessionId}
      WHERE id = ${input.topUpId}::uuid AND status = 'reserved'
    `);
    return { expired: true, skipped: false };
  });
}

export async function fulfillProviderCreditTopUp(input: {
  topUpId: string;
  userId: number;
  sessionId: string;
  paymentIntentId: string;
  creditsCents: number;
  priceUsdCents: number;
}): Promise<{ grantedCents: number; skipped: boolean }> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input.topUpId,
    ) ||
    !safeId(input.userId) ||
    !validStripeSessionId(input.sessionId) ||
    !/^pi_[A-Za-z0-9]+$/.test(input.paymentIntentId) ||
    !PURCHASED_PROVIDER_CREDIT_PACKS_CENTS.includes(
      input.creditsCents as ProviderCreditPackCents,
    ) ||
    !Number.isSafeInteger(input.priceUsdCents) ||
    input.priceUsdCents <= 0
  ) {
    throw new Error("Invalid provider-credit payment fulfillment");
  }
  const pack = providerCreditPack(input.creditsCents);
  if (
    PURCHASED_PROVIDER_CREDIT_PACK_PRICES_USD_CENTS[pack] !==
    input.priceUsdCents
  ) {
    throw new Error("Provider-credit amount does not match approved pricing");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.userId})`);
    const rows = await tx.execute<{
      userId: number;
      periodStart: Date | string;
      creditsCents: string;
      priceUsdCents: number;
      status: string;
      expiresAt: Date | string;
      sessionId: string | null;
      paymentIntentId: string | null;
    }>(sql`
      SELECT user_id AS "userId", period_start::text AS "periodStart",
        credits_cents::text AS "creditsCents",
        price_usd_cents AS "priceUsdCents", status,
        expires_at AS "expiresAt", stripe_session_id AS "sessionId",
        payment_intent_id AS "paymentIntentId"
      FROM provider_credit_topups
      WHERE id = ${input.topUpId}::uuid
      FOR UPDATE
    `);
    const purchase = (
      rows as unknown as Array<{
        userId: number;
        periodStart: Date | string;
        creditsCents: string;
        priceUsdCents: number;
        status: string;
        expiresAt: Date | string;
        sessionId: string | null;
        paymentIntentId: string | null;
      }>
    )[0];
    if (
      !purchase ||
      purchase.userId !== input.userId ||
      Number(purchase.creditsCents) !== input.creditsCents ||
      purchase.priceUsdCents !== input.priceUsdCents ||
      (purchase.sessionId && purchase.sessionId !== input.sessionId) ||
      (purchase.paymentIntentId &&
        purchase.paymentIntentId !== input.paymentIntentId)
    ) {
      throw new Error("Provider-credit checkout does not match reserved order");
    }
    if (purchase.status === "paid") {
      return { grantedCents: 0, skipped: true };
    }
    if (purchase.status !== "reserved") {
      throw new Error("Provider-credit checkout is not fulfillable");
    }
    const periodStartDate = new Date(purchase.periodStart)
      .toISOString()
      .slice(0, 10);

    await tx.execute(sql`
      INSERT INTO provider_credit_accounts (user_id, purchased_balance_cents)
      VALUES (${input.userId}, 0)
      ON CONFLICT (user_id) DO NOTHING
    `);
    const event = await tx.execute(sql`
      INSERT INTO provider_credit_events
        (user_id, source_id, kind, amount_cents, period_start)
      VALUES (
        ${input.userId}, ${input.paymentIntentId}, 'purchased_grant',
        ${input.creditsCents}, ${periodStartDate}::date
      )
      ON CONFLICT (user_id, source_id) DO NOTHING
      RETURNING id
    `);
    if ((event as unknown as unknown[]).length !== 1) {
      throw new Error("Provider-credit payment was already granted elsewhere");
    }
    await tx.execute(sql`
      UPDATE provider_credit_accounts
      SET purchased_balance_cents = purchased_balance_cents + ${input.creditsCents},
        updated_at = NOW()
      WHERE user_id = ${input.userId}
    `);
    await tx.execute(sql`
      UPDATE provider_credit_topups
      SET status = 'paid', stripe_session_id = ${input.sessionId},
        payment_intent_id = ${input.paymentIntentId}
      WHERE id = ${input.topUpId}::uuid AND status = 'reserved'
    `);
    return { grantedCents: input.creditsCents, skipped: false };
  });
}
