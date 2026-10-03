import { expect, test } from "@playwright/test";

const baseUrl = (
  process.env.APPFORGE_URL ||
  "https://appforge-unfurling-moon-9058.fly.dev"
).replace(/\/$/, "");
const phase = process.env.APPFORGE_ADMIN_MFA_PHASE || "";
const email = process.env.APPFORGE_CANARY_EMAIL || "";
const password = process.env.APPFORGE_CANARY_PASSWORD || "";
const smsCode = process.env.APPFORGE_ADMIN_MFA_CODE || "";

function required(name, value) {
  if (!value) throw new Error(`Missing required value: ${name}`);
  return value;
}

async function loginOwner(page) {
  required("APPFORGE_CANARY_EMAIL", email);
  required("APPFORGE_CANARY_PASSWORD", password);

  await page.goto(`${baseUrl}/login?next=%2Fadmin`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL((url) => url.origin === new URL(baseUrl).origin, {
    timeout: 60_000,
  });
  await page.goto(`${baseUrl}/admin`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
}

async function expectMfaLocked(page) {
  await expect(
    page.getByRole("heading", { name: /admin verification required/i }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/AppForge Admin/)).toHaveCount(0);
}

test("production owner admin challenge sends SMS", async ({ page }) => {
  test.skip(phase !== "request", "Not the request phase.");
  await loginOwner(page);
  await expectMfaLocked(page);

  const send = page.getByRole("button", { name: /send sms code/i });
  await expect(send).toBeVisible({ timeout: 30_000 });
  await send.click();

  await expect(
    page.getByRole("button", { name: /send another code/i }),
  ).toBeVisible({ timeout: 30_000 });
});

test("production owner SMS code unlocks admin and logout revokes MFA", async ({
  page,
}) => {
  test.skip(phase !== "verify", "Not the verify phase.");

  required("APPFORGE_ADMIN_MFA_CODE", smsCode);
  if (!/^\d{6}$/.test(smsCode)) {
    throw new Error("APPFORGE_ADMIN_MFA_CODE must be a six-digit SMS code.");
  }

  await loginOwner(page);
  await expectMfaLocked(page);

  await page.getByLabel("Admin SMS code").fill(smsCode);
  await page.getByRole("button", { name: /verify and enter admin/i }).click();

  await expect(
    page.getByRole("heading", { name: "AppForge Admin", exact: true }),
  ).toBeVisible({ timeout: 30_000 });

  await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
  await expect(
    page.getByRole("heading", { name: "AppForge Admin", exact: true }),
  ).toBeVisible({ timeout: 30_000 });

  const logout = page.getByRole("button", { name: /log out/i }).first();
  await expect(logout).toBeVisible({ timeout: 30_000 });
  await logout.click();
  await page.waitForURL(`${baseUrl}/`, { timeout: 30_000 });

  await loginOwner(page);
  await expectMfaLocked(page);
});
