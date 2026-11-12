import { describe, expect, it } from "vitest";
import { generatedChildEnvironment } from "../lib/generatedProcessEnv.js";

describe("generated-code subprocess environment isolation", () => {
  it("does not pass through AppForge provider, database or payment secrets", () => {
    const env = generatedChildEnvironment(
      "/tmp/appforge-generated-test",
      { NODE_ENV: "production", npm_config_prefer_offline: "true" },
      {
        PATH: "/usr/bin",
        HOME: "/home/operator",
        DATABASE_URL: "postgres://secret",
        STRIPE_SECRET_KEY: "sk_live_secret",
        OPENAI_API_KEY: "sk-secret",
        SUPABASE_SERVICE_ROLE_KEY: "service-secret",
        FLY_API_TOKEN: "fly-secret",
      },
    );
    expect(env.PATH).toBe("/usr/bin");
    expect(env.HOME).toBe("/tmp/appforge-generated-test");
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.STRIPE_SECRET_KEY).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(env.FLY_API_TOKEN).toBeUndefined();
    expect(env.NODE_ENV).toBe("production");
  });

  it("refuses a future caller trying to inject an unsupported override", () => {
    expect(() =>
      generatedChildEnvironment("/tmp/appforge-generated-test", {
        STRIPE_SECRET_KEY: "forbidden",
      }),
    ).toThrow("Unsupported generated-process environment override");
  });
});
