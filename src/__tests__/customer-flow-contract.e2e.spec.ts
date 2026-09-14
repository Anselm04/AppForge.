import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function expectInOrder(text: string, markers: string[]) {
  let previous = -1;
  for (const marker of markers) {
    const index = text.indexOf(marker);
    expect(index, `Missing customer-flow marker: ${marker}`).toBeGreaterThan(-1);
    expect(index, `Customer-flow marker out of order: ${marker}`).toBeGreaterThan(
      previous,
    );
    previous = index;
  }
}

describe("critical customer flow contract", () => {
  it("preserves signup destination through confirmation and login", () => {
    const auth = source("../lib/auth.ts");
    const signup = source("../pages/Signup.tsx");

    expect(auth).toContain('const SESSION_KEY = "appforge.session"');
    expect(auth).toContain("export async function completeAuthRedirect");
    expect(auth).toContain("saveSession(session);");
    expect(auth).toContain("export function loginPathWithReturn");
    expect(signup).toContain("await signUp(email.trim(), password, next);");
    expect(signup).toContain(
      "navigate(`/login?next=${encodeURIComponent(next)}`)",
    );
  });

  it("keeps confirmed users authenticated across refresh/reopen with token refresh", () => {
    const auth = source("../lib/auth.ts");

    expect(auth).toContain('const SESSION_KEY = "appforge.session"');
    expect(auth).toContain("refreshToken?: string;");
    expect(auth).toContain("export async function refreshSession");
    expect(auth).toContain(
      "await supabaseClient.refreshSession(current.refreshToken!)",
    );
    expect(auth).toContain("saveSession(next);");
    expect(auth).toContain("export async function ensureFreshSession");
    expect(auth).toContain("signOut();");
  });

  it("keeps Stripe checkout and owner God Code as authenticated entitlement paths", () => {
    const pricing = source("../pages/Pricing.tsx");
    const subscriptions = source("../routers/subscriptions.ts");
    const admin = source("../routers/admin.ts");
    const redeem = source("../pages/Redeem.tsx");

    expect(pricing).toContain("trpc.subscriptions.createCheckoutSession.mutate");
    expect(pricing).toContain('navigate("/signup?next=/pricing")');
    expect(subscriptions).toContain("createCheckoutSession: protectedProcedure");
    expect(subscriptions).toContain("hasManagedSubscription");
    expect(subscriptions).toContain(
      "You already have a Stripe subscription. Use Manage billing",
    );
    expect(admin).toContain("redeemCode: protectedProcedure");
    expect(admin).toContain("await applyGodCodeGrant(");
    expect(admin).toContain("found.redeemedAt ||");
    expect(admin).toContain("eq(schema.godCodes.isUsed, false)");
    expect(admin).toContain("redeemedByUserId: ctx.user.id");
    expect(redeem).toContain(
      'queryClient.invalidateQueries({ queryKey: ["projects", "tierStatus"] })',
    );
    expect(redeem).toContain(
      'queryClient.invalidateQueries({ queryKey: ["auth"] })',
    );
  });

  it("binds Stripe checkout and webhook fulfillment to the same AppForge user", () => {
    const checkout = source("../services/stripeCheckout.ts");
    const webhook = source("../webhooks/stripe.ts");

    expect(checkout).toContain("client_reference_id: String(user.id)");
    expect(checkout).toContain("userId: String(user.id)");
    expect(checkout).toContain("subscription_data:");
    expect(checkout).toContain("const appUrl = requireAppUrl();");
    expect(checkout).toContain('throw new Error("PUBLIC_APP_URL is required")');
    expect(checkout).toContain(
      'success_url: `${appUrl}/dashboard?checkout=success`',
    );
    expect(webhook).toContain("resolveCheckoutUserId(session)");
    expect(webhook).toContain(
      "resolveConsistentUserId(userId, metadataUserId, customerUserId)",
    );
    expect(webhook).toContain("await upsertSubscription({");
    expect(webhook).toContain("await paidCreditPackForSession(session)");
  });

  it("processes each Stripe webhook event at most once", () => {
    const webhook = source("../webhooks/stripe.ts");
    const ledger = source("../services/stripeEventLedger.ts");

    expect(webhook).toContain("processStripeEventOnce");
    expect(ledger).toContain("pg_advisory_xact_lock");
    expect(ledger).toContain("FROM stripe_webhook_events");
    expect(ledger).toContain("INSERT INTO stripe_webhook_events");
    expectInOrder(ledger, [
      "pg_advisory_xact_lock",
      "FROM stripe_webhook_events",
      "await handler();",
      "INSERT INTO stripe_webhook_events",
    ]);
  });

  it("pins unique production Stripe prices and one production Supabase target", () => {
    const fly = source("../../fly.toml");
    const priceNames = [
      "STRIPE_STARTER_PRICE_ID",
      "STRIPE_BUILDER_PRICE_ID",
      "STRIPE_STUDIO_PRICE_ID",
      "STRIPE_ENTERPRISE_PRICE_ID",
      "STRIPE_CREDITS_50_PRICE_ID",
      "STRIPE_CREDITS_100_PRICE_ID",
      "STRIPE_CREDITS_250_PRICE_ID",
    ];
    const prices = priceNames.map((name) => {
      const match = fly.match(new RegExp(`${name} = '(price_[^']+)'`));
      expect(match, `Missing production Stripe price: ${name}`).not.toBeNull();
      return match?.[1] ?? "";
    });

    expect(new Set(prices).size).toBe(priceNames.length);

    const supabase = fly.match(/SUPABASE_URL = '(https:\/\/[^']+)'/)?.[1];
    const viteSupabase = fly.match(
      /VITE_SUPABASE_URL = '(https:\/\/[^']+)'/,
    )?.[1];
    expect(supabase).toBeTruthy();
    expect(viteSupabase).toBe(supabase);
  });

  it("creates a project once and automatically claims and enqueues its build", () => {
    const projects = source("../routers/projects.ts");

    expectInOrder(projects, [
      "const id = await createProject({",
      "const claimed = await claimProjectBuildStart(id, ctx.user.id);",
      "await enqueueBuild({",
      'return { id, status: "running" as const };',
    ]);
    expect(projects).toContain("Build start refund for project ${id}");
    expect(projects).toContain(
      'await releaseProjectBuildClaim(id, ctx.user.id, "pending", null)',
    );
  });

  it("requires agent completion before production deploy and emits done only after deploy", () => {
    const worker = source("../services/build-worker.ts");

    expectInOrder(worker, [
      "await runAgentPipeline(",
      'const passed = updated?.status === "completed";',
      "const deployed = await deployValidatedProject({",
      'await emit(projectId, "done", donePayload);',
    ]);
    expect(worker).toContain('if (event === "done") {');
    expect(worker).toContain("pendingDone = data;");
    expect(worker).toContain('await refundReservation("Failed build")');
    expect(worker).toContain(
      'await updateProjectStatus(projectId, "failed", "build_failed")',
    );
  });

  it("keeps validation in the agent pipeline before a build can complete", () => {
    const pipeline = source("../agents/pipeline.generated.ts");

    expectInOrder(pipeline, [
      "validationResult = await validateGeneratedBuild(",
      "if (!validationResult?.passed) {",
      'await updateProjectStatus(projectId, "completed");',
      'write("done", {',
    ]);
  });

  it("requires root content plus same-origin JS/CSS assets before production success", () => {
    const autoDeploy = source("../services/productionAutoDeploy.ts");
    const health = source("../services/deployHealth.ts");

    expect(autoDeploy).toContain("runPostDeploySmokeTest");
    expect(autoDeploy).toContain("requireVerifiedLiveUrl");
    expect(autoDeploy).toContain('parsed.protocol !== "https:"');
    expect(autoDeploy).toContain("liveUrl");
    expect(health).toContain("Empty response body");
    expect(health).toContain("probeDeployUrl(base, 15_000, true)");
    expect(health).toContain("probeGeneratedProductAssets");
    expect(health).toContain("assets.some((asset) => !asset.result.ok)");
  });

  it("opens only the verified live generated product after terminal success", () => {
    const buildPage = source("../pages/Build.tsx");

    expect(buildPage).toContain("normalizeLiveProductUrl(");
    expect(buildPage).toContain("window.location.assign(live);");
    expectInOrder(buildPage, [
      'if (event === "done") {',
      "const live = normalizeLiveProductUrl(",
      "window.location.assign(live);",
    ]);
  });
});
