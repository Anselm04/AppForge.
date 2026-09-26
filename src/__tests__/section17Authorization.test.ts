import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const auth = readFileSync("src/lib/auth.ts", "utf8");
const supabaseClient = readFileSync("src/lib/supabase-client.ts", "utf8");
const middleware = readFileSync("src/middleware/supabaseAuth.ts", "utf8");
const trpc = readFileSync("src/_core/trpc.ts", "utf8");
const projects = readFileSync("src/routers/projects.ts", "utf8");
const collaboration = readFileSync("src/routers/collaboration.ts", "utf8");
const orgs = readFileSync("src/routers/orgs.ts", "utf8");
const sso = readFileSync("src/routers/sso.ts", "utf8");
const assets = readFileSync("src/routers/assets.ts", "utf8");
const account = readFileSync("src/pages/Account.tsx", "utf8");
const rls = readFileSync(
  "supabase/migrations/20260909142116_optimize_appforge_rls_and_fk_indexes.sql",
  "utf8",
);
const securityScanner = readFileSync(
  "src/services/projectSecurityScanner.ts",
  "utf8",
);

describe("#17 authentication and authorization", () => {
  it("covers signup, login, logout, refresh, expiration, recovery and email verification", () => {
    expect(auth).toContain("export async function signUp");
    expect(auth).toContain("export async function signIn");
    expect(auth).toContain("export function signOut()");
    expect(auth).toContain("export async function refreshSession");
    expect(auth).toContain("accessTokenExpired");
    expect(auth).toContain("completeAuthRedirect");
    expect(supabaseClient).toContain("requestPasswordReset");
    expect(supabaseClient).toContain("updatePassword");
    expect(middleware).toContain("email_confirmed_at");
    expect(middleware).toContain('code: "EMAIL_CONFIRMATION_REQUIRED"');
  });

  it("supports token revocation and multi-device session handling", () => {
    expect(auth).toContain("export function signOutAllDevices()");
    expect(auth).toContain('clearServerSession(session?.accessToken, "local")');
    expect(auth).toContain('clearServerSession(session?.accessToken, "global")');
    expect(supabaseClient).toContain('scope: "local" | "global" = "local"');
    expect(middleware).toContain("revokeSupabaseSession");
    expect(middleware).toContain(
      'req.query.scope === "global" ? "global" : "local"',
    );
    expect(account).toContain("signOutAllDevices");
    expect(account).toContain("Sign out all devices");
  });

  it("enforces project ownership and cross-user isolation", () => {
    expect(projects).toContain("if (project.userId !== ctx.user.id)");
    expect(projects).toContain('throw new TRPCError({ code: "FORBIDDEN"');
  });

  it("enforces collaboration membership and role-based write access", () => {
    expect(collaboration).toContain("getCollaboratorRole(projectId, userId)");
    expect(collaboration).toContain("requireWritableRole(access.role)");
    expect(collaboration).toContain('z.enum(["viewer", "editor"])');
    expect(collaboration).toContain("requireProjectOwner");
  });

  it("separates authenticated, owner-admin, and organization authorization", () => {
    expect(trpc).toContain("export const protectedProcedure");
    expect(trpc).toContain("export const ownerOnlyProcedure");
    expect(trpc).toContain("isOwnerEmail(user.email)");
    expect(orgs).toContain("organizationMembers.userId, ctx.user.id");
    expect(orgs).toContain('["owner", "admin"].includes(membership.role)');
    expect(sso).toContain('membership.role !== "owner"');
  });

  it("enforces storage access through project ownership", () => {
    expect(assets).toContain("project.userId !== ctx.user.id");
    expect(assets).toContain("projectAssets.findMany");
    expect(assets).toContain("userId: ctx.user.id");
  });

  it("keeps database row-level security scoped to authenticated owners", () => {
    expect(rls).toContain("projects_select_own");
    expect(rls).toContain("owner_id = (select auth.uid())");
    expect(rls).toContain("build_snapshots_owner_all");
    expect(rls).toContain("user_id = (select auth.uid())");
    expect(rls).toContain("senior_dev_tasks_owner_all");
  });

  it("prevents generated products from inheriting AppForge platform identity", () => {
    expect(securityScanner).toContain("auth.appforge-identity-boundary");
    expect(securityScanner).toContain(
      "Generated products must define their own identity boundary",
    );
    expect(securityScanner).toContain("appforge\\.access-token");
    expect(securityScanner).toContain("\\/api\\/auth\\/session");
  });

  it("blocks banned accounts at the server authentication boundary", () => {
    expect(middleware).toContain("if (dbUser.isBanned)");
    expect(middleware).toContain('code: "ACCOUNT_DISABLED"');
  });
});
