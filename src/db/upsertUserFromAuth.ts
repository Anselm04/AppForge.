import { eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "./schema.js";

/** Upsert a user from Supabase (or other) auth identity.
 * Match by openId first; if missing, link an existing row by confirmed email
 * (unique) so a new Supabase UID does not 401 on INSERT email conflict.
 */
export async function upsertUserFromAuth(data: {
  openId: string;
  email?: string;
  name?: string;
  picture?: string | null;
}) {
  const email =
    typeof data.email === "string" && data.email.trim()
      ? data.email.trim().toLowerCase()
      : undefined;

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${data.openId}, 0))`,
    );
    if (email) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${email}, 1))`,
      );
    }

    const byOpenId = await tx.query.users.findFirst({
      where: eq(schema.users.openId, data.openId),
    });
    if (byOpenId) {
      const result = await tx
        .update(schema.users)
        .set({
          email: email || byOpenId.email,
          name: data.name || byOpenId.name,
          picture: data.picture ?? byOpenId.picture,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, byOpenId.id))
        .returning();
      return result[0] ?? byOpenId;
    }

    if (email) {
      const byEmail = await tx.query.users.findFirst({
        where: eq(schema.users.email, email),
      });
      if (byEmail) {
        const result = await tx
          .update(schema.users)
          .set({
            openId: data.openId,
            email,
            name: data.name || byEmail.name,
            picture: data.picture ?? byEmail.picture,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, byEmail.id))
          .returning();
        return result[0] ?? byEmail;
      }
    }

    try {
      const result = await tx
        .insert(schema.users)
        .values({
          openId: data.openId,
          email,
          name: data.name,
          picture: data.picture ?? undefined,
        })
        .returning();
      return result[0];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: unknown }).code ?? "")
          : "";
      const causeMsg =
        err && typeof err === "object" && "cause" in err && (err as { cause?: unknown }).cause
          ? String((err as { cause?: unknown }).cause)
          : "";
      const looksLikeUnique =
        code === "23505" ||
        /unique|duplicate|23505/i.test(msg) ||
        /unique|duplicate|23505/i.test(causeMsg);
      if (!looksLikeUnique) throw err;
      const raced =
        (await tx.query.users.findFirst({
          where: eq(schema.users.openId, data.openId),
        })) ||
        (email
          ? await tx.query.users.findFirst({
              where: eq(schema.users.email, email),
            })
          : undefined);
      if (!raced) throw err;
      const result = await tx
        .update(schema.users)
        .set({
          openId: data.openId,
          email: email || raced.email,
          name: data.name || raced.name,
          picture: data.picture ?? raced.picture,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, raced.id))
        .returning();
      return result[0] ?? raced;
    }
  });
}
