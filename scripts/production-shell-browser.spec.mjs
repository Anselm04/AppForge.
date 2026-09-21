import { expect, test } from "@playwright/test";

const appUrl =
  process.env.APPFORGE_URL || "https://appforge-unfurling-moon-9058.fly.dev";

test.use({ viewport: { width: 390, height: 844 } });

test("production customer shell is interactive on mobile", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle", timeout: 60_000 });

  const prompt = page.getByTestId("hero-app-idea-textarea");
  await expect(prompt).toBeVisible({ timeout: 20_000 });
  await prompt.fill(
    "Build a production-ready booking app with authentication and payments",
  );
  await expect(prompt).toHaveValue(
    "Build a production-ready booking app with authentication and payments",
  );
  await expect(page.getByTestId("home-generate-button")).toBeEnabled();

  const menu = page.locator('button[aria-controls="mobile-nav-drawer"]');
  await expect(menu).toBeVisible();
  await menu.click();

  const controls = page.getByTestId("mobile-nav-controls");
  await expect(controls).toBeVisible();

  const language = controls.getByRole("button", { name: /language/i });
  await expect(language).toBeVisible();
  await language.click();
  await expect(controls.getByRole("listbox")).toBeVisible();
  expect(await controls.getByRole("option").count()).toBeGreaterThan(20);

  const night = controls.getByRole("button", { name: /night/i });
  const day = controls.getByRole("button", { name: /day/i });

  await night.click();
  await expect(night).toHaveAttribute("aria-pressed", "true");

  await day.click();
  await expect(day).toHaveAttribute("aria-pressed", "true");
});
