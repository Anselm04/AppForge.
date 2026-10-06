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

async function openAccountNavIfNeeded(page) {
  const account = page.getByRole("button", { name: "Account", exact: true }).first();
  if (await account.isVisible().catch(() => false)) return;

  const menu = page.getByRole("button", { name: /menu/i }).first();
  if (await menu.isVisible().catch(() => false)) {
    await menu.click();
    await expect(account).toBeVisible({ timeout: 10_000 });
  }
}

async function expectLoggedIn(page) {
  await openAccountNavIfNeeded(page);
  await expect(
    page.getByRole("button", { name: "Account", exact: true }).first(),
  ).toBeVisible({ timeout: 30_000 });
}

async function expectLoggedOut(page) {
  const login = page.getByRole("button", { name: /log in/i }).first();
  if (!(await login.isVisible().catch(() => false))) {
    const menu = page.getByRole("button", { name: /menu/i }).first();
    if (await menu.isVisible().catch(() => false)) await menu.click();
  }
  await expect(login).toBeVisible({ timeout: 30_000 });
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

async function logoutThroughUi(page, label) {
  await openAccountNavIfNeeded(page);
  let logout = page.getByRole("button", { name: /log out|logout/i }).first();
  if (!(await logout.isVisible().catch(() => false))) {
    const menu = page.getByRole("button", { name: /menu/i }).first();
    if (await menu.isVisible().catch(() => false)) {
      await menu.click();
      logout = page.getByRole("button", { name: /log out|logout/i }).first();
    }
  }
  await expect(logout, `${label}: logout control must be reachable`).toBeVisible({
    timeout: 30_000,
  });
  await logout.click();
  await page.waitForURL(`${baseUrl}/`, { timeout: 30_000 });
  await expectLoggedOut(page);
}

test("requests a real production signup confirmation email", async ({ page }) => {
  test.setTimeout(120_000);
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
        response.url().includes("/api/health/auth-signup"),
      { timeout: 30_000 },
    ),
    form.getByRole("button", { name: /create|sign up|signup/i }).click(),
  ]);

  expect(
    signupResponse.status(),
    `AppForge signup confirmation delivery must be accepted; received HTTP ${signupResponse.status()}`,
  ).toBe(202);

  await expect(form, "signup form must be replaced by the check-email state").toBeHidden({
    timeout: 30_000,
  });
  await expect(
    page.getByText(/check.*email|email.*confirm|confirmation/i).first(),
  ).toBeVisible({ timeout: 30_000 });
});

test("confirmed production account accepts normal login", async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(phase !== "probe-confirmed", "Not the probe-confirmed phase.");

  requireValue("APPFORGE_AUTH_GATE_EMAIL", email);
  requireValue("APPFORGE_CANARY_PASSWORD", password);

  await login(page, 30_000);
});

test("logs in, recovers the session, logs out, and relogs into the confirmed real production account", async ({ page }) => {
  test.setTimeout(10 * 60_000);
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
    await logoutThroughUi(page, `cycle ${cycle}`);
    await expectProtectedRouteClosed(page, `cycle ${cycle}`);
    await login(page);
  }
});

test("confirmed account can authenticate and recover from completely fresh browser contexts ten times", async ({ browser }) => {
  test.setTimeout(10 * 60_000);
  test.skip(phase !== "complete-lifecycle", "Not the complete-lifecycle phase.");

  requireValue("APPFORGE_AUTH_GATE_EMAIL", email);
  requireValue("APPFORGE_CANARY_PASSWORD", password);

  for (let cycle = 1; cycle <= 10; cycle += 1) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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