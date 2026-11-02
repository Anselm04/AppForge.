import { test } from "@playwright/test";

test("owner can request a trial testing code and enter admin on the live release", async ({
  page,
}) => {
  test.setTimeout(120000);
  if (
    !process.env.APPFORGE_CANARY_EMAIL ||
    !process.env.APPFORGE_CANARY_PASSWORD
  )
    throw new Error("Owner browser verification credentials are missing");
  const base = "https://appforge-unfurling-moon-9058.fly.dev";
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.getByLabel(/email/i).fill(process.env.APPFORGE_CANARY_EMAIL);
  await page
    .getByLabel(/^password/i)
    .fill(process.env.APPFORGE_CANARY_PASSWORD);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForTimeout(3000);
  await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: "Admin verification required" })
    .waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /send sms code/i }).click();
  const codeElement = page.getByRole("status").locator("strong");
  await codeElement.waitFor({ timeout: 30000 });
  const code = ((await codeElement.textContent()) || "").trim();
  if (!/^\d{6}$/.test(code))
    throw new Error("A valid temporary testing challenge was not issued");
  if (
    !(await page
      .getByText(/If you receive an AppForge admin code you did not request/)
      .isVisible())
  )
    throw new Error("Security warning is missing");
  const wrong = code === "111111" ? "222222" : "111111";
  await page.getByLabel("Admin SMS code").fill(wrong);
  await page.getByRole("button", { name: "Verify and enter admin" }).click();
  await page
    .getByText("That code was not accepted. Admin access remains locked.")
    .waitFor();
  await page.getByLabel("Admin SMS code").fill(code);
  await page.getByRole("button", { name: "Verify and enter admin" }).click();
  await page
    .getByRole("heading", { name: /AppForge Admin/i })
    .waitFor({ timeout: 30000 });
  console.log(
    "Live owner trial challenge, wrong-code rejection, and admin unlock passed.",
  );
});
