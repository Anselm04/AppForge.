import { describe, expect, it } from "vitest";
import {
  prepareProductionFiles,
  requireVerifiedLiveUrl,
} from "../services/productionAutoDeploy.js";

describe("production auto deploy packaging", () => {
  it("uses vite preview when a validated Vite app has no start script", () => {
    const files = prepareProductionFiles({
      "package.json": JSON.stringify({
        scripts: { build: "vite build" },
        devDependencies: { vite: "^5.0.0" },
      }),
      "vite.config.ts": "export default {}",
      "index.html": '<div id="root"></div>',
    });

    expect(files.Dockerfile).toContain("npm run build");
    expect(files.Dockerfile).toContain(
      'CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000", "--strictPort"]',
    );
  });

  it("keeps an explicit application start script for server apps", () => {
    const files = prepareProductionFiles({
      "package.json": JSON.stringify({
        scripts: { build: "tsc", start: "node dist/server.js" },
      }),
    });

    expect(files.Dockerfile).toContain('CMD ["npm", "run", "start"]');
  });

  it("does not replace a generated Dockerfile", () => {
    const dockerfile = "FROM nginx:alpine\n";
    const files = prepareProductionFiles({
      Dockerfile: dockerfile,
      "package.json": "{}",
    });

    expect(files.Dockerfile).toBe(dockerfile);
  });

  it("accepts only a valid HTTPS live product URL", () => {
    expect(requireVerifiedLiveUrl("https://app.example.test")).toBe(
      "https://app.example.test/",
    );
    expect(() => requireVerifiedLiveUrl("http://app.example.test")).toThrow(
      "must return an HTTPS live URL",
    );
    expect(() => requireVerifiedLiveUrl("not-a-url")).toThrow(
      "returned an invalid live URL",
    );
  });
});
