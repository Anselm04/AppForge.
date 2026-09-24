import { describe, expect, it } from "vitest";
import {
  generatedArtifactSha256,
  prepareProductionFiles,
  requireVerifiedLiveUrl,
} from "../services/productionAutoDeploy.js";

describe("production auto deploy packaging", () => {
  it("embeds an immutable artifact identity for post-deploy verification", () => {
    const source = {
      "package.json": JSON.stringify({ scripts: { build: "vite build" } }),
      "index.html": "<main>real product</main>",
    };
    const files = prepareProductionFiles(source, "react-node");
    expect(JSON.parse(files["public/.well-known/appforge-build.json"])).toEqual(
      { artifactSha256: generatedArtifactSha256(source) },
    );
    expect(generatedArtifactSha256(files)).toBe(
      generatedArtifactSha256(source),
    );
  });
  it("serves a validated Vite app's static output with nginx on port 3000", () => {
    const files = prepareProductionFiles(
      {
        "package.json": JSON.stringify({
          scripts: {
            build: "vite build",
            start: "vite preview --host 0.0.0.0",
          },
          devDependencies: { vite: "^5.0.0" },
        }),
        "vite.config.ts": "export default {}",
        "index.html": '<div id="root"></div>',
      },
      "react-node",
    );

    expect(files.Dockerfile).toContain("RUN npm run build");
    expect(files.Dockerfile).toContain("FROM nginx:1.27-alpine");
    expect(files.Dockerfile).toContain("listen 3000;");
    expect(files.Dockerfile).toContain(
      "COPY --from=build /app/dist /usr/share/nginx/html",
    );
    expect(files.Dockerfile).toContain(
      "cp -R public/.well-known/. dist/.well-known/",
    );
  });

  it("keeps an explicit application start script for React apps with their own server", () => {
    const files = prepareProductionFiles(
      {
        "package.json": JSON.stringify({
          scripts: { build: "tsc", start: "node dist/server.js" },
        }),
      },
      "react-node",
    );

    expect(files.Dockerfile).toContain('CMD ["npm", "run", "start"]');
    expect(files.Dockerfile).not.toContain("nginx");
  });

  it("packages each runnable stack with its own production runtime", () => {
    const next = prepareProductionFiles({ "package.json": "{}" }, "next-node");
    expect(next.Dockerfile).toContain(
      'CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]',
    );

    const api = prepareProductionFiles({ "package.json": "{}" }, "api-service");
    expect(api.Dockerfile).toContain("FROM node:22-alpine");
    expect(api.Dockerfile).toContain('CMD ["npm", "run", "start"]');
    expect(api.Dockerfile).toContain("ENV PORT=3000");

    const automation = prepareProductionFiles(
      { "package.json": "{}" },
      "browser-automation",
    );
    expect(automation.Dockerfile).toContain(
      "FROM mcr.microsoft.com/playwright:v1.59.1-noble",
    );

    const game = prepareProductionFiles(
      { "package.json": "{}" },
      "phaser-html5",
    );
    expect(game.Dockerfile).toContain("FROM nginx:1.27-alpine");
    const site = prepareProductionFiles(
      { "index.html": "<main>site</main>", "package.json": "{}" },
      "static-html",
    );
    expect(site.Dockerfile).toContain("COPY --from=build /app/dist");
  });

  it("refuses production packaging for structural-only stacks", () => {
    for (const stack of [
      "react-native-expo",
      "flutter-firebase",
      "electron-react",
      "tauri-rust",
      "python-service",
      "ai-agent-python",
      "chrome-extension",
    ]) {
      expect(() =>
        prepareProductionFiles({ "package.json": "{}" }, stack),
      ).toThrow(/Structural-only stack/);
    }
  });

  it("does not replace a generated Dockerfile", () => {
    const dockerfile = "FROM nginx:alpine\n";
    const files = prepareProductionFiles(
      {
        Dockerfile: dockerfile,
        "package.json": "{}",
      },
      "react-node",
    );

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
