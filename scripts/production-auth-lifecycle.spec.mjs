import { expect, test } from "@playwright/test";

const baseUrl = (
  process.env.APPFORGE_URL ||
  "https://appforge-unfurling-moon-9058.fly.dev"
).replace(/\/$/, "");
const phase = process.env.APPFORGE_AUTH_GATE_PHASE || "";
const email = process.env.APPFORGE_AUTH_GATE_EMAIL || "";
const password = process.env.APPFORGE_CANARY_PASSWORD || "";

function requireValue(name, value) {
  if (!value) throw new Error(`Missing required value: ${name}`);
  return value;
}

async function expectLoggedIn(page) {
  await expect(
    page.getByRole("button", { name: "Account", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
}

async function expectLoggedOut(page) {
  await expect(page.getByRole("button", { name: /log in/i }).first()).toBeVisible({
    timeout: 30_000,
  });
}

async function expectProtectedRouteClosed(page, label) {
  const protectedResponse = await page.request.get(`${baseUrl}/api/build/1`);
  expect(
    protectedResponse.status(),
    `${label}: logged-out protected route must stay closed`,
  ).toBe(401);
}

async function login(page, timeout = 60_000) {
  await page.goto(`${baseUrl}/login?next=%2Faccount`, {
    waitUntil: "networkidle",
    timeout,
  });
  const form = page.locator("form");
  await form.getByLabel(/email/i).fill(email);
  await form.getByLabel(/^password/i).fill(password);
  await form.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(`${baseUrl}/account`, { timeout });
  await expectLoggedIn(page);
}

async function proveCookieBackedRecovery(page, label) {
  await page.evaluate(() => {
    sessionStorage.removeItem("appforge.access-token");
  });
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
  await expectLoggedIn(page);
  await expect(
    page,
    `${label}: recovery must return to the account page`,
  ).toHaveURL(`${baseUrl}/account`);
}

test("requests a real production signup confirmation email", async ({ page }) => {
  test.skip(
    phase !== "request-confirmation",
    "Not the request-confirmation phase.",
  );

  requireValue("APPFORGE_AUTH_GATE_EMAIL", email);
  requireValue("APPFORGE_CANARY_PASSWORD", password);

  await page.goto(`${baseUrl}/signup?next=%2Faccount`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });

  const form = page.locator("form");
  await form.getByLabel(/email/i).fill(email);
  await form.getByLabel(/^password/i).fill(password);
  await form.getByLabel(/confirm/i).fill(password);

  const [signupResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/auth/v1/signup"),
      { timeout: 30_000 },
    ),
    form.getByRole("button", { name: /create|sign up|signup/i }).click(),
  ]);

  expect(
    signupResponse.ok(),
    `real Supabase signup must succeed; received HTTP ${signupResponse.status()}`,
  ).toBe(true);

  await expect(form, "signup form must be replaced by the check-email state").toBeHidden({
    timeout: 30_000,
  });
  await expect(
    page.getByText(/check.*email|email.*confirm|confirmation/i).first(),
  ).toBeVisible({ timeout: 30_000 });
});

test("confirmed production account accepts normal login", async ({ page }) => {
  test.skip(phase !== "probe-confirmed", "Not the probe-confirmed phase.");

  requireValue("APPFORGE_AUTH_GATE_EMAIL", email);
  requireValue("APPFORGE_CANARY_PASSWORD", password);

  await login(page, 15_000);
});

test("logs in, recovers the session, logs out, and relogs into the confirmed real production account", async ({ page }) => {
  test.skip(phase !== "complete-lifecycle", "Not the complete-lifecycle phase.");

  requireValue("APPFORGE_AUTH_GATE_EMAIL", email);
  requireValue("APPFORGE_CANARY_PASSWORD", password);

  await login(page);
  await expect(page).toHaveURL(`${baseUrl}/account`);

  await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
  await expectLoggedIn(page);
  await expect(page).toHaveURL(`${baseUrl}/account`);

  await proveCookieBackedRecovery(page, "initial login");

  for (let cycle = 2; cycle <= 10; cycle += 1) {
    const cycleLogout = page.getByRole("button", { name: /log out/i }).first();
    await expect(cycleLogout).toBeVisible({ timeout: 30_000 });
    await cycleLogout.click();
    await page.waitForURL(`${baseUrl}/`, { timeout: 30_000 });
    await expectLoggedOut(page);
    await expectProtectedRouteClosed(page, `cycle ${cycle}`);

    await login(page);
  }
});

test("confirmed account can authenticate and recover from completely fresh browser contexts ten times", async ({ browser }) => {
  test.skip(phase !== "complete-lifecycle", "Not the complete-lifecycle phase.");

  requireValue("APPFORGE_AUTH_GATE_EMAIL", email);
  requireValue("APPFORGE_CANARY_PASSWORD", password);

  for (let cycle = 1; cycle <= 10; cycle += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await login(page);
      await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
      await expectLoggedIn(page);
      await proveCookieBackedRecovery(page, `fresh context ${cycle}`);
    } finally {
      await context.close();
    }
  }
});
