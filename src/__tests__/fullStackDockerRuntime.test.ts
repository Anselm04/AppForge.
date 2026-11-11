import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const compose = readFileSync("docker-compose.prod.yml", "utf8");
const dockerfile = readFileSync("Dockerfile", "utf8");

describe("full-stack Docker runtime without Fly", () => {
  it("maps the Express port and health endpoint", () => {
    expect(compose).toContain('"127.0.0.1:3000:3000"');
    expect(compose).toContain("http://127.0.0.1:3000/api/health/live");
    expect(compose).not.toContain('"80:80"');
    expect(compose).not.toContain("nginx-proxy:");
  });

  it("keeps PostgreSQL and Redis private", () => {
    expect(compose).toContain("postgres:");
    expect(compose).toContain("redis:");
    expect(compose).toContain("DATABASE_URL:");
    expect(compose).toContain("REDIS_URL:");
    expect(compose).toContain("condition: service_healthy");
    expect(compose).toContain("/var/lib/postgresql/data");
    expect(compose).toContain("/data");
    expect(compose).not.toMatch(/- "5432:5432"/);
    expect(compose).not.toMatch(/- "6379:6379"/);
  });

  it("does not download Fly CLI while building the complete app server", () => {
    expect(dockerfile).toContain('CMD ["node", "dist/server.js"]');
    expect(dockerfile).toContain('EXPOSE 3000');
    expect(dockerfile).not.toContain("https://fly.io/install.sh");
    expect(dockerfile).not.toContain("flyctl version");
  });
});
