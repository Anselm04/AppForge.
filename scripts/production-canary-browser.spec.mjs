import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const resultPath =
  process.env.APPFORGE_CANARY_RESULT_PATH ||
  ".appforge-production-canary-result.json";
const certification = JSON.parse(readFileSync(resultPath, "utf8"));

async function assertInteractiveCounter(page, url, expectedTexts) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });

  for (const text of expectedTexts) {
    await expect(page.getByText(text, { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });
  }

  const button = page.getByRole("button", {
    name: "Increment Canary Counter",
    exact: true,
  });
  await expect(button).toBeVisible({ timeout: 20_000 });

  const before = await page.locator("body").innerText();
  await button.click();
  await expect
    .poll(async () => page.locator("body").innerText(), {
      timeout: 10_000,
      message: "Counter click did not change rendered page content",
    })
    .not.toBe(before);
}

test("initial generated production app is interactive", async ({ page }) => {
  await assertInteractiveCounter(page, certification.liveUrl, [
    "AppForge Production Canary",
    "Increment Canary Counter",
  ]);
});

test("edited redeploy preserves working interaction", async ({ page }) => {
  await assertInteractiveCounter(page, certification.redeployUrl, [
    "AppForge Production Canary Updated",
    "Authenticated edit verified",
    "Increment Canary Counter",
  ]);
});
