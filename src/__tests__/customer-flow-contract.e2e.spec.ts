import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function expectInOrder(text: string, markers: string[]) {
  let previous = -1;
  for (const marker of markers) {
    const index = text.indexOf(marker);
    expect(index, `Missing customer-flow marker: ${marker}`).toBeGreaterThan(
      -1,
    );
    expect(
      index,
      `Customer-flow marker out of order: ${marker}`,
    ).toBeGreaterThan(previous);
    previous = index;
  }
}

describe("critical customer flow contract", () => {
  it("locks the tester-ready shell and owner entitlement contract", () => {
    const home = source("../pages/Home.tsx");
    const nav = source("../components/TopNav.tsx");
    const projects = source("../routers/projects.ts");

    // Customer landing page stays prompt-only. Stack/capability choices remain
    // internal to AppForge and must never be re-exposed by a branding change.
    expect(home).not.toContain("<select");
    expect(home).not.toContain("<CapabilityPicker");
    expect(home).not.toContain("BuildPurposeStatement");
    expect(home).toContain("INTERNAL_DEFAULT_STACK");
    expect(home).toContain("Owner account · Unlimited lifetime access");

    // Mobile tester controls are release-critical.
    expect(nav).toContain("<LanguageSwitcher");
    expect(nav).toContain("<ThemeToggle");
    expect(nav).toContain('go("/admin")');
    expect(nav).toContain('data-testid="mobile-nav-controls"');
    expect(nav).toContain("h-[100dvh]");

    // Owner/lifetime access overrides customer subscription limits.
    expect(projects).toContain(
      'const tier = unlimited ? "lifetime" : subscriptionTier;',
    );
    expect(projects).toContain("const isPaid = unlimited || subscriptionPaid;");
    expect(projects).toContain("reservationCharged = !unlimited");
  });

  it("keeps account password recovery controls wired", () => {
    const login = source("../pages/Login.tsx");
    const app = source("../App.tsx");
    const supabase = source("../lib/supabase-client.ts");

    expect(login).toContain('to="/forgot-password"');
    expect(app).toContain('path="/account"');
    expect(app).toContain('path="/forgot-password"');
    expect(app).toContain('path="/password-reset"');
    expect(supabase).toContain("requestPasswordReset(email: string)");
    expect(supabase).toContain(
      "updatePassword(accessToken: string, password: string)",
    );
  });

  it("preserves signup destination through confirmation and login", () => {
    const auth = source("../lib/auth.ts");
    const signup = source("../pages/Signup.tsx");

    expect(auth).toContain('const USER_KEY = "appforge.user"');
    expect(auth).not.toContain('const SESSION_KEY = "appforge.session"');
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

    expect(auth).toContain('const USER_KEY = "appforge.user"');
    expect(auth).not.toContain("refreshToken?: string;");
    expect(auth).toContain("export async function refreshSession");
    expect(auth).toContain("Refresh tokens are intentionally HttpOnly.");
    expect(auth).toContain("const refreshed = await refreshServerCookieSession()");
    expect(auth).toContain("clearStoredUser();");
    expect(auth).toContain("export async function ensureFreshSession");
    expect(auth).toContain("return refreshSession();");
    expect(auth).not.toContain("localStorage?.setItem(SESSION_KEY");
  });

  it("keeps Stripe checkout and owner God Code as authenticated entitlement paths", () => {
    const pricing = source("../pages/Pricing.tsx");
    const subscriptions = source("../routers/subscriptions.ts");
    const admin = source("../routers/admin.ts");
    const redeem = source("../pages/Redeem.tsx");

    expect(pricing).toContain(
      "trpc.subscriptions.createCheckoutSession.mutate",
    );
    expect(pricing).toContain('navigate("/signup?next=/pricing")');
    expect(subscriptions).toContain(
      "createCheckoutSession: protectedProcedure",
    );
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

    expect(checkout).toContain("const appUrl = requireAppUrl();");
    expect(checkout).toContain("client_reference_id: String(user.id)");
    expect(checkout).toContain("userId: String(user.id)");
    expect(checkout).toContain("subscription_data:");
    expect(checkout).toContain(
      "success_url: `${appUrl}/dashboard?checkout=success`",
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
      "const deployed = await deployValidatedProjectWithRetry({",
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

  it("makes generated tests blocking for every full-validation build", () => {
    const pipeline = source("../agents/pipeline.generated.ts");

    expect(pipeline).toContain(
      'const testsBlocking = validationMode === "full";',
    );
    expect(pipeline).toContain('if (validationMode === "full") {');
    expect(pipeline).toContain(
      "Generating blocking unit tests before validation and deployment…",
    );
    expect(pipeline).not.toContain(
      "Golden path: tests deferred until UI is green.",
    );
    expectInOrder(pipeline, [
      "attachGeneratedTests(",
      "validateGeneratedBuild(",
      "testsBlocking,",
      'await updateProjectStatus(projectId, "completed");',
    ]);
  });

  it("fails full-validation builds that contain no executable generated tests", () => {
    const validator = source("../agents/buildValidator.ts");

    expect(validator).toContain(
      "const generatedTestFiles = Object.keys(files)",
    );
    expect(validator).toContain(
      "Full-validation build generated no executable unit/integration tests.",
    );
    expect(validator).toContain('stage: "tests"');
    expect(validator).toContain(
      "A production-capable full-validation build must include executable tests before deployment.",
    );
    expectInOrder(validator, [
      "const generatedTestFiles = Object.keys(files)",
      "if (options.testsBlocking && generatedTestFiles.length === 0)",
      '["vitest", "run"]',
      '["vite", "build"]',
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

  it("certifies real production build-test-deploy semantics", () => {
    const canary = source("../../scripts/production-customer-canary.mjs");

    expect(canary).toContain("verifyGeneratedTestContract");
    expect(canary).toContain(
      "Generated production canary has no persisted unit/integration test file",
    );
    expect(canary).toContain(
      "Generated tests do not exercise or reference the requested counter behavior",
    );
    expect(canary).toContain("AppForge Production Canary");
    expect(canary).toContain("Increment Canary Counter");
    expect(canary).toContain("AppForge Production Canary Updated");
    expect(canary).toContain("Authenticated edit verified");
    expect(canary).toContain("generatedTestsVerified: true");
    expect(canary).toContain("initialCustomerVisibleContentVerified");
    expect(canary).toContain("editedCustomerVisibleContentVerified");
    expectInOrder(canary, [
      "const generatedTests = verifyGeneratedTestContract(" +
        "project.generatedFiles);",
      "const live = await verifyDeployedProduct(done.liveUrl",
      'trpc.mutation("projectChat.send"',
      'trpc.mutation("projects.deploy"',
      "const redeployedLive = await verifyDeployedProduct(redeploy.deployUrl",
    ]);
  });

  it("includes real Chromium interaction in production certification", () => {
    const workflow = source(
      "../../.github/workflows/production-full-customer-journey.yml",
    );
    const browserSpec = source(
      "../../scripts/production-canary-browser.spec.mjs",
    );

    expect(workflow).toContain("@playwright/test@1.55.0");
    expect(workflow).toContain("npx playwright install chromium");
    expect(workflow).toContain(
      "npx playwright test scripts/production-canary-browser.spec.mjs --reporter=line",
    );
    expect(browserSpec).toContain('name: "Increment Canary Counter"');
    expect(browserSpec).toContain("await button.click()");
    expect(browserSpec).toContain(
      "Counter click did not change rendered page content",
    );
    expect(browserSpec).toContain("AppForge Production Canary Updated");
    expect(browserSpec).toContain("Authenticated edit verified");
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
