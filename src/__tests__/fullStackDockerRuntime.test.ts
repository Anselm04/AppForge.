import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("full-stack Docker runtime", () => {
  const compose = readFileSync("docker-compose.prod.yml", "utf8");
  const image = readFileSync("Dockerfile", "utf8");

  it("uses the real Node server port", () => {
    expect(compose).toContain("127.0.0.1:3000:3000");
    expect(compose).toContain("/api/health/live");
    expect(compose).not.toContain("nginx-proxy:");
  });

  it("keeps durable dependencies private", () => {
    expect(compose).toContain("postgres:");
    expect(compose).toContain("redis:");
    expect(compose).toContain("DATABASE_URL:");
    expect(compose).toContain("REDIS_URL:");
    expect(compose).toContain("condition: service_healthy");
    expect(compose).toContain("/var/lib/postgresql/data");
    expect(compose).toContain("/data");
    expect(compose).not.toContain("5432:5432");
    expect(compose).not.toContain("6379:6379");
  });

  it("does not download Fly tools", () => {
    expect(image).toContain("EXPOSE 3000");
    expect(image).toContain("dist/server.js");
    expect(image).not.toContain("https://fly.io/install.sh");
    expect(image).not.toContain("flyctl version");
  });
});
