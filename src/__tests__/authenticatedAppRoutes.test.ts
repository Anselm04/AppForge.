import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/App.tsx", "utf8");
const guardSource = readFileSync("src/components/auth/RequireAuth.tsx", "utf8");

describe("authenticated AppForge routes", () => {
  it("redirects signed-out visitors before mounting the build interface", () => {
    expect(guardSource).toContain("trpc.auth.me.query()");
    expect(guardSource).toContain("<Navigate");
    expect(guardSource).toContain("/login?next=");
    expect(guardSource).toContain("<Outlet />");
  });

  it("places every build-capable route behind RequireAuth", () => {
    expect(appSource).toContain(
      'import { RequireAuth } from "./components/auth/RequireAuth.js";',
    );
    expect(appSource).toContain("<Route element={<RequireAuth />}>");

    for (const path of [
      "/",
      "/app/new",
      "/dashboard",
      "/tools",
      "/build/:projectId",
      "/account",
      "/settings/org",
      "/settings",
      "/shortcuts",
      "/ai-builder",
      "/templates",
      "/editor",
      "/studio",
      "/studio/video",
      "/studio/music",
      "/studio/marketing",
      "/studio/ar",
      "/studio/education",
      "/studio/patent",
      "/studio/architecture",
      "/studio/game",
      "/studio/cad",
      "/studio/legal",
      "/studio/fintech",
      "/studio/healthcare",
      "/studio/mobile",
      "/studio/voice",
      "/studio/data",
      "/studio/localization",
      "/studio/collab",
    ]) {
      expect(appSource).toContain(`path="${path}"`);
    }
  });
});
