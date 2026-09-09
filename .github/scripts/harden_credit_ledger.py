from pathlib import Path

# Harden monthly refill against concurrent duplicate grants.
p = Path("src/db.ts")
s = p.read_text()
start = s.index("export async function refillMonthlyCredits(")
end = s.index("\nexport async function syncTierFromSubscription(", start)
s = s[:start] + '''export async function refillMonthlyCredits(
  userId: number,
  tier?: string,
): Promise<void> {
  await ensureUserCredits(userId);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${userId})`);
    const rows = await tx
      .select()
      .from(schema.userCredits)
      .where(eq(schema.userCredits.userId, userId))
      .limit(1);
    const credits = rows[0];
    if (!credits) return;

    const effectiveTier = tier ?? credits.tier ?? "free";
    const refillAmount = getTierCreditRefill(effectiveTier);
    if (refillAmount === null) return;

    const now = new Date();
    const lastRefill = credits.lastRefillAt ?? credits.createdAt ?? now;
    const daysSinceRefill =
      (now.getTime() - new Date(lastRefill).getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSinceRefill < 30) return;

    await tx
      .update(schema.userCredits)
      .set({
        balance: refillAmount,
        tier: effectiveTier,
        monthlyAllowance: getTierBuildLimit(effectiveTier) ?? 0,
        lastRefillAt: now,
        updatedAt: now,
      })
      .where(eq(schema.userCredits.id, credits.id));
    await tx.insert(schema.creditTransactions).values({
      userId,
      amount: refillAmount,
      type: "subscription_grant",
      description: `Monthly credit refill for ${effectiveTier} tier (${refillAmount} credits)`,
    });
  });
}
''' + s[end:]
p.write_text(s)

# Unknown Stripe prices must never silently provision Starter access.
p = Path("src/webhooks/stripe.ts")
s = p.read_text()
old = '''function resolveTier(
  meta?: Stripe.Metadata | null,
  priceId?: string | null
): string {
  const fromMeta = (meta?.tier || meta?.plan || "").toLowerCase();
  if (fromMeta && PAID_TIERS.has(fromMeta)) return fromMeta;
  return tierFromPriceId(priceId) ?? "starter";
}'''
new = '''function resolveTier(
  meta?: Stripe.Metadata | null,
  priceId?: string | null,
): string {
  const fromMeta = (meta?.tier || meta?.plan || "").toLowerCase();
  const mappedTier = tierFromPriceId(priceId);

  if (mappedTier) {
    if (fromMeta && PAID_TIERS.has(fromMeta) && fromMeta !== mappedTier) {
      throw new Error(
        `Stripe tier metadata mismatch: metadata=${fromMeta}, price=${priceId}`,
      );
    }
    return mappedTier;
  }

  // Enterprise/custom may be invoice-assisted flows without a standard price map,
  // but ordinary subscription prices must be recognized explicitly.
  if (fromMeta === "enterprise" || fromMeta === "custom") return fromMeta;

  throw new Error(
    `Unrecognized Stripe price; refusing to provision access: ${priceId || "missing"}`,
  );
}'''
assert old in s, "resolveTier target not found"
s = s.replace(old, new)
p.write_text(s)
