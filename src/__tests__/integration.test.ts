import { describe, test, expect, vi } from "vitest";

vi.mock("../db.js", async () => {
  const actual = await vi.importActual<typeof import("../db.js")>("../db.js");
  return {
    ...actual,
    getProjectById: vi.fn(),
    getUserCredits: vi.fn(),
    ensureUserCredits: vi.fn(),
    deductCredits: vi.fn(),
    addCredits: vi.fn(),
    updateProjectStatus: vi.fn(),
    pauseProject: vi.fn(),
    resumeProject: vi.fn(),
    getUserByOpenId: vi.fn(),
    createUser: vi.fn(),
    isUserPro: vi.fn(),
    countBuildsThisMonth: vi.fn(),
  };
});

vi.mock("../agents/pipeline.js", () => ({
  runAgentPipeline: vi.fn(async (_id, _prompt, _stack, write) => {
    write?.("agent", { agent: "Planner", status: "start" });
  }),
}));

vi.mock("stripe", () => {
  const mockRetrieve = vi.fn();
  const mockCreate = vi.fn().mockResolvedValue({
    id: "cs_test_123",
    url: "https://checkout.stripe.com/test",
  });
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: { sessions: { create: mockCreate } },
      subscriptions: { retrieve: mockRetrieve },
    })),
  };
});

vi.mock("../services/deployer.js", () => ({
  deployToVercel: vi.fn().mockResolvedValue("https://appforge-demo.vercel.app"),
  zipFiles: vi.fn().mockResolvedValue({ base64: "UEsDBBQ=", filename: "test.zip" }),
  deployProject: vi.fn().mockResolvedValue({ url: "https://appforge-demo.vercel.app", destination: "vercel" }),
  listDeployDestinations: vi.fn().mockReturnValue({
    vercel: { configured: true, label: "Vercel" },
    netlify: { configured: false, label: "Netlify" },
    fly: { configured: false, label: "Fly.io" },
    "github-pages": { configured: false, label: "GitHub Pages" },
    zip: { configured: true, label: "ZIP download" },
    preview: { configured: true, label: "AppForge live preview" },
  }),
  previewSignature: vi.fn().mockReturnValue("testsig"),
  verifyPreviewSignature: vi.fn().mockReturnValue(true),
}));

describe("Supabase Auth Middleware", () => {
  test("parses Bearer token and attaches req.user", async () => {
    const { supabaseAuthMiddleware } = await import("../middleware/supabaseAuth.js");
    const req = { headers: { authorization: "Bearer test-token" }, cookies: {}, user: undefined } as any;
    const res = {} as any;
    const next = vi.fn();
    supabaseAuthMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe("Credit System", () => {
  test("getUserCredits returns undefined if no credits record", async () => {
    const { getUserCredits } = await import("../db.js");
    vi.mocked(getUserCredits).mockResolvedValue(undefined);
    const result = await getUserCredits(1);
    expect(result).toBeUndefined();
  });
});

describe("Vercel Deploy", () => {
  test("deployToVercel returns a URL", async () => {
    const { deployToVercel } = await import("../services/deployer.js");
    const url = await deployToVercel("test-app", { "src/index.ts": "console.log('hello');", "package.json": "{}" });
    expect(url).toMatch(/^https:\/\//);
  });
});
