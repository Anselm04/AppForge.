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
  const composer = page.getByRole("textbox", {
    name: "What do you want to build?",
  });
  await expect(composer).toBeVisible({ timeout: 20_000 });
  await composer.fill("Build a booking app for my business");
  const build = page.getByRole("button", {
    name: "Build with AppForge",
    exact: true,
  });
  await expect(build).toBeEnabled();
  await build.click();
  await expect(page).toHaveURL(/\/signup\?next=\/$/);
  expect(
    await page.evaluate(() => sessionStorage.getItem("appforge.promptDraft")),
  ).toBe("Build a booking app for my business");
  await page.goto(appUrl, { waitUntil: "networkidle", timeout: 60_000 });
  await expect(composer).toHaveValue("Build a booking app for my business");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  await expect(page.getByTestId("hero-app-idea-textarea")).toHaveCount(0);
  // Direct builder links still enforce sign-in after the public composer handoff.
  await page.goto(`${appUrl}/app/new`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
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
