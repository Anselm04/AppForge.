import { expect, test } from "@playwright/test";

const baseUrl = (process.env.APPFORGE_URL || "https://appforge-unfurling-moon-9058.fly.dev").replace(/\/$/, "");
const phase = process.env.APPFORGE_AUTH_GATE_PHASE || "";
const email = process.env.APPFORGE_AUTH_GATE_EMAIL || "";
const password = process.env.APPFORGE_CANARY_PASSWORD || "";
const confirmationUrl = process.env.APPFORGE_AUTH_GATE_CONFIRMATION_URL || "";

function requireValue(name, value) {
  if (!value) throw new Error(`Missing required value: ${name}`);
  return value;
}

function assertConfirmationUrl(value) {
  const parsed = new URL(requireValue("APPFORGE_AUTH_GATE_CONFIRMATION_URL", value));
  if (parsed.protocol !== "https:") {
    throw new Error("Confirmation URL must use HTTPS.");
  }
  if (!parsed.pathname.includes("/auth/v1/verify")) {
    throw new Error("Confirmation URL is not a Supabase auth verification URL.");
  }
  return parsed.toString();
}

async function expectLoggedIn(page) {
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

async function expectLoggedOut(page) {
  await expect(page.getByRole("button", { name: /log in/i }).first()).toBeVisible({
    timeout: 30_000,
  });
}

test("requests a real production signup confirmation email", async ({ page }) => {
  test.skip(phase !== "request-confirmation", "Not the request-confirmation phase.");

  requireValue("APPFORGE_AUTH_GATE_EMAIL", email);
  requireValue("APPFORGE_CANARY_PASSWORD", password);

  await page.goto(`${baseUrl}/signup?next=%2Faccount`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByLabel(/confirm/i).fill(password);
  await page.getByRole("button", { name: /create|sign up|signup/i }).click();

  await expect(
    page.getByText(/check.*email|email.*confirm|confirmation/i).first(),
  ).toBeVisible({ timeout: 30_000 });
});

test("confirms, logs out, and relogs into the real production account", async ({ page }) => {
  test.skip(phase !== "complete-lifecycle", "Not the complete-lifecycle phase.");

  requireValue("APPFORGE_AUTH_GATE_EMAIL", email);
  requireValue("APPFORGE_CANARY_PASSWORD", password);
  const realConfirmationUrl = assertConfirmationUrl(confirmationUrl);

  await page.goto(realConfirmationUrl, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });

  await page.waitForURL((url) => url.origin === new URL(baseUrl).origin, {
    timeout: 60_000,
  });
  await expectLoggedIn(page);

  const logout = page.getByRole("button", { name: /log out/i }).first();
  await expect(logout).toBeVisible({ timeout: 30_000 });
  await logout.click();

  await page.waitForURL(`${baseUrl}/`, { timeout: 30_000 });
  await expectLoggedOut(page);

  await page.goto(`${baseUrl}/login?next=%2Faccount`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();

  await page.waitForURL(`${baseUrl}/account`, { timeout: 60_000 });
  await expectLoggedIn(page);
  await expect(page).toHaveURL(`${baseUrl}/account`);

  // Prove session continuity across a hard reload.
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
  await expectLoggedIn(page);
  await expect(page).toHaveURL(`${baseUrl}/account`);

  // Repeat logout -> anonymous boundary -> relogin two more times.
  for (let cycle = 2; cycle <= 10; cycle += 1) {
    const cycleLogout = page.getByRole("button", { name: /log out/i }).first();
    await expect(cycleLogout).toBeVisible({ timeout: 30_000 });
    await cycleLogout.click();
    await page.waitForURL(`${baseUrl}/`, { timeout: 30_000 });
    await expectLoggedOut(page);

    const protectedResponse = await page.request.get(`${baseUrl}/api/build/1`);
    expect(protectedResponse.status(), `cycle ${cycle}: logged-out protected route must stay closed`).toBe(401);

    await page.goto(`${baseUrl}/login?next=%2Faccount`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password/i).fill(password);
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await page.waitForURL(`${baseUrl}/account`, { timeout: 60_000 });
    await expectLoggedIn(page);
  }
});

test("confirmed account can authenticate from completely fresh browser contexts ten times", async ({ browser }) => {
  test.skip(phase !== "complete-lifecycle", "Not the complete-lifecycle phase.");

  requireValue("APPFORGE_AUTH_GATE_EMAIL", email);
  requireValue("APPFORGE_CANARY_PASSWORD", password);

  for (let cycle = 1; cycle <= 10; cycle += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/login?next=%2Faccount`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/^password/i).fill(password);
      await page.getByRole("button", { name: /log in|sign in/i }).click();
      await page.waitForURL(`${baseUrl}/account`, { timeout: 60_000 });
      await expectLoggedIn(page);

      // Prove each fresh context can survive a hard reload and still be authenticated.
      await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
      await expectLoggedIn(page);
    } finally {
      await context.close();
    }
  }
});
