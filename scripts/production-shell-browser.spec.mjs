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

  const listbox = controls.getByRole("listbox");
  await expect(listbox).toBeVisible();
  expect(await controls.getByRole("option").count()).toBeGreaterThan(100);

  const french = controls.getByRole("option", { name: "Français" });
  await french.click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(
    controls.getByRole("button", { name: /langue/i }),
  ).toBeVisible();

  const dark = controls.getByRole("button", { name: /sombre/i });
  const light = controls.getByRole("button", { name: /clair/i });

  await dark.click();
  await expect(dark).toHaveAttribute("aria-pressed", "true");

  await light.click();
  await expect(light).toHaveAttribute("aria-pressed", "true");
});
