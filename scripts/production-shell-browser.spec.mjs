import { createRequire } from "node:module";

const appUrl =
  process.env.APPFORGE_URL || "https://appforge-unfurling-moon-9058.fly.dev";
const playwrightRoot = process.env.APPFORGE_PLAYWRIGHT_ROOT;

if (!playwrightRoot) {
  throw new Error("APPFORGE_PLAYWRIGHT_ROOT is required for browser verification.");
}

const require = createRequire(import.meta.url);
const { chromium } = require(`${playwrightRoot}/node_modules/playwright`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(appUrl, { waitUntil: "networkidle", timeout: 60_000 });

  const prompt = page.getByTestId("hero-app-idea-textarea");
  await prompt.waitFor({ state: "visible", timeout: 20_000 });
  const requestedApp =
    "Build a production-ready booking app with authentication and payments";
  await prompt.fill(requestedApp);
  assert(
    (await prompt.inputValue()) === requestedApp,
    "Landing prompt did not retain entered text.",
  );
  assert(
    await page.getByTestId("home-generate-button").isEnabled(),
    "Generate button did not enable after entering a valid prompt.",
  );

  const menu = page.locator('button[aria-controls="mobile-nav-drawer"]');
  await menu.waitFor({ state: "visible" });
  await menu.click();

  const controls = page.getByTestId("mobile-nav-controls");
  await controls.waitFor({ state: "visible" });

  const language = controls.getByRole("button", { name: /language/i });
  await language.waitFor({ state: "visible" });
  await language.click();

  const listbox = controls.getByRole("listbox");
  await listbox.waitFor({ state: "visible" });
  const languageCount = await controls.getByRole("option").count();
  assert(
    languageCount > 100,
    `Expected more than 100 language choices, found ${languageCount}.`,
  );

  const french = controls.getByRole("option", { name: "Français" });
  await french.click();
  assert(
    (await page.locator("html").getAttribute("lang")) === "fr",
    "Selecting French did not apply lang=fr to the document.",
  );
  await controls.getByRole("button", { name: /langue/i }).waitFor({
    state: "visible",
  });

  const dark = controls.getByRole("button", { name: /sombre/i });
  const light = controls.getByRole("button", { name: /clair/i });

  await dark.click();
  assert(
    (await dark.getAttribute("aria-pressed")) === "true",
    "Dark theme control did not activate.",
  );

  await light.click();
  assert(
    (await light.getAttribute("aria-pressed")) === "true",
    "Light theme control did not activate.",
  );

  console.log(
    `Production customer shell browser verification passed with ${languageCount} language choices.`,
  );
} finally {
  await browser.close();
}
