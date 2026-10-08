import { expect, test } from "@playwright/test";

const appUrl =
  process.env.APPFORGE_URL || "https://appforge-unfurling-moon-9058.fly.dev";

test.use({
  viewport: { width: 390, height: 844 },
  ...(process.env.APPFORGE_BROWSER_CHANNEL === "chrome"
    ? { channel: "chrome" }
    : {}),
});

test("production customer shell is interactive on mobile", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle", timeout: 60_000 });

  // Signed-out visitors see the public landing page. The private builder
  // mounts only after the server confirms an authenticated session.
  const startBuilding = page.locator('a[href="/app/new"]').first();
  await expect(startBuilding).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("hero-app-idea-textarea")).toHaveCount(0);
  await startBuilding.click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.goto(appUrl, { waitUntil: "networkidle", timeout: 60_000 });

  const menu = page.locator('button[aria-controls="mobile-nav-drawer"]');
  await expect(menu).toBeVisible();
  await menu.click();

  const controls = page.getByTestId("mobile-nav-controls");
  await expect(controls).toBeVisible();

  const language = controls.getByRole("button", { name: /language/i });
  await expect(language).toBeVisible();
  await language.click();

  const listbox = controls.getByRole("listbox");
  await expect(listbox).toBeVisible();
  expect(await controls.getByRole("option").count()).toBeGreaterThan(100);

  const french = controls.getByRole("option", { name: "Français" });
  await french.click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(controls.getByRole("button", { name: /langue/i })).toBeVisible();

  const dark = controls.getByRole("button", { name: /sombre/i });
  const light = controls.getByRole("button", { name: /clair/i });

  await dark.click();
  await expect(dark).toHaveAttribute("aria-pressed", "true");

  await light.click();
  await expect(light).toHaveAttribute("aria-pressed", "true");
});
