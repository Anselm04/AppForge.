import { eq } from "drizzle-orm";
import * as schema from "./db/schema.js";
import {
  db,
  createUser,
  getUserByOpenId,
  ensureUserCredits,
  getUserCredits,
  unpauseCreditExhaustedProjects,
} from "./db.js";

/** Upsert a user from Supabase (or other) auth identity. */
export async function upsertUserFromAuth(data: {
  openId: string;
  email?: string;
  name?: string;
  picture?: string | null;
}) {
  const existing = await getUserByOpenId(data.openId);
  if (existing) {
    const result = await db
      .update(schema.users)
      .set({
        email: data.email || existing.email,
        name: data.name || existing.name,
        picture: data.picture ?? existing.picture,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, existing.id))
      .returning();
    return result[0] ?? existing;
  }
  return createUser({
    openId: data.openId,
    email: data.email,
    name: data.name,
    picture: data.picture ?? undefined,
  });
}

/**
 * Apply a god-code grant: lifetime → unlimited credits; limited → add credits.
 */
export async function applyGodCodeGrant(
  userId: number,
  grantType: "lifetime" | "limited",
  credits: number,
): Promise<{ credits: number; unlimited: boolean }> {
  await ensureUserCredits(userId);
  const row = await getUserCredits(userId);
  if (!row) return { credits: 0, unlimited: false };

  const now = new Date();
  if (grantType === "lifetime") {
    await db
      .update(schema.userCredits)
      .set({
        unlimited: true,
        tier: "lifetime",
        updatedAt: now,
      })
      .where(eq(schema.userCredits.id, row.id));
    await db.insert(schema.creditTransactions).values({
      userId,
      amount: 0,
      type: "god_code_grant",
      description: "Lifetime unlimited credits (god code)",
    });
    await unpauseCreditExhaustedProjects(userId);
    return { credits: row.balance, unlimited: true };
  }

  const amount = Math.max(0, credits);
  const newBalance = row.balance + amount;
  await db.transaction(async (tx) => {
    await tx
      .update(schema.userCredits)
      .set({ balance: newBalance, updatedAt: now })
      .where(eq(schema.userCredits.id, row.id));
    if (amount > 0) {
      await tx.insert(schema.creditTransactions).values({
        userId,
        amount,
        type: "god_code_grant",
        description: `God code grant (+${amount} credits)`,
      });
    }
  });
  await unpauseCreditExhaustedProjects(userId);
  return { credits: newBalance, unlimited: !!row.unlimited };
}
