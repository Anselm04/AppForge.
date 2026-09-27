import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const trpc = source("src/_core/trpc.ts");
const projects = source("src/routers/projects.ts");
const orgs = source("src/routers/orgs.ts");
const server = source("src/server.ts");
const sandboxProxy = source("src/routes/sandboxDevProxy.ts");
const hostedApps = source("src/routes/hostedApps.ts");
const rls = source(
  "supabase/migrations/20260909142116_optimize_appforge_rls_and_fk_indexes.sql",
);

describe("Section 17 authentication and authorization boundaries", () => {
  it("fails closed for unauthenticated and non-owner administrative access", () => {
    expect(trpc).toContain("if (!opts.ctx.user)");
    expect(trpc).toContain('code: "UNAUTHORIZED"');
    expect(trpc).toContain("if (!isOwnerEmail(user.email))");
    expect(trpc).toContain('code: "FORBIDDEN"');
  });

  it("binds project reads and logs to the authenticated project owner", () => {
    expect(projects).toContain("list: protectedProcedure");
    expect(projects).toContain("return getProjectsByUserId(ctx.user.id)");
    expect(projects).toContain("if (project.userId !== ctx.user.id)");
    expect(projects).toContain('message: "Access denied"');
  });

  it("enforces organization membership and role checks server-side", () => {
    expect(orgs).toContain(
      "eq(schema.organizationMembers.userId, ctx.user.id)",
    );
    expect(orgs).toContain('!["owner", "admin"].includes(membership.role)');
    expect(orgs).toContain('membership.role !== "owner"');
  });

  it("keeps execution and billing REST APIs behind authenticated middleware", () => {
    expect(server).toContain(
      'app.use("/api/ai", requireAuthenticatedUser, aiRouter)',
    );
    expect(server).toContain(
      'app.use("/api/agents", requireAuthenticatedUser, agentsRouter)',
    );
    expect(server).toContain(
      'app.use("/api/build", requireAuthenticatedUser, buildRouter)',
    );
    expect(server).toContain(
      'app.use("/api/generate", requireAuthenticatedUser, generateRouter)',
    );
    expect(server).toContain(
      'app.use("/api/checkout", requireAuthenticatedUser, checkoutRouter)',
    );
  });

  it("keeps Supabase browser-facing project data owner-scoped with RLS", () => {
    expect(rls).toContain("alter policy projects_select_own");
    expect(rls).toContain("using (owner_id = (select auth.uid()))");
    expect(rls).toContain("alter policy projects_update_own");
    expect(rls).toContain("with check (owner_id = (select auth.uid()))");
    expect(rls).toContain("alter policy build_runs_owner_all");
    expect(rls).toContain("alter policy build_snapshots_owner_all");
  });

  it("prevents generated products from inheriting AppForge identity privileges", () => {
    expect(hostedApps).toContain(
      '"sandbox allow-scripts allow-forms allow-modals allow-popups"',
    );
    expect(sandboxProxy).toContain(
      "if (!project || project.userId !== userId)",
    );
    expect(sandboxProxy).toContain("delete headers.authorization");
    expect(sandboxProxy).toContain("delete headers.cookie");
    expect(sandboxProxy).toContain('delete headers["x-api-key"]');
    expect(sandboxProxy).toContain('delete headers["set-cookie"]');
    expect(sandboxProxy).toContain(
      '"sandbox allow-scripts allow-forms allow-modals allow-popups"',
    );
  });
});
