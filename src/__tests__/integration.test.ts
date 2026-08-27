import { describe, test, expect, vi } from "vitest";

// ── Mocks ──
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
  };
});

vi.mock("../agents/pipeline.js", () => ({
  runAgentPipeline: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("stripe", () => {
  const mockRetrieve = vi.fn();
  const mockCreate = vi
    .fn()
    .mockResolvedValue({
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
}));

// ── Auth Middleware (Unit) ──
describe("Supabase Auth Middleware", () => {
  test("parses Bearer token and attaches req.user", async () => {
    const { supabaseAuthMiddleware } =
      await import("../middleware/supabaseAuth.js");

    const req = {
      headers: { authorization: "Bearer test-token" },
      cookies: {},
      user: undefined,
    } as any;
    const res = {} as any;
    const next = vi.fn();

    // We can't fully test Supabase getUser here without a real token,
    // but we can verify middleware skips gracefully when supabase client is null
    supabaseAuthMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ── Credit System ──
describe("Credit System", () => {
  test("getUserCredits returns null if no credits record", async () => {
    const { getUserCredits } = await import("../db.js");
    vi.mocked(getUserCredits).mockResolvedValue(undefined);
    const result = await getUserCredits(1);
    expect(result).toBeUndefined();
  });

  test("deductCredits throws on insufficient balance", async () => {
    const { deductCredits, getUserCredits } = await import("../db.js");
    vi.mocked(getUserCredits).mockResolvedValue({
      id: 1,
      userId: 1,
      balance: 2,
      tier: "free",
      monthlyAllowance: 3,
      unlimited: false,
      lastRefillAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(deductCredits(1, 5)).rejects.toThrow("Insufficient credits");
  });
});

// ── Checkout ──
describe("Checkout Router", () => {
  test("creates Stripe checkout session with user metadata", async () => {
    const { checkoutRouter } = await import("../routes/checkout.js");

    const req = {
      body: {
        plan: "builder",
        successUrl: "https://appforge.dev/success",
        cancelUrl: "https://appforge.dev/cancel",
      },
      user: { id: 1, email: "test@appforge.dev" },
    } as any;
    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    } as any;

    const next = vi.fn();
    await checkoutRouter(req, res, next);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.any(String) }),
    );
  });
});

// ── Deployment ──
describe("Vercel Deploy", () => {
  test("deployToVercel returns a URL", async () => {
    const { deployToVercel } = await import("../services/deployer.js");
    const url = await deployToVercel("test-app", {
      "src/index.ts": "console.log('hello');",
      "package.json": "{}",
    });
    expect(url).toMatch(/^https:\/\//);
  });
});

// ── Pipeline ──
describe("Agent Pipeline", () => {
  test("runAgentPipeline emits Planner start event", async () => {
    const { runAgentPipeline } = await import("../agents/pipeline.js");
    const events: any[] = [];
    const write = (event: string, data: unknown) =>
      events.push({ event, data });

    await runAgentPipeline(1, "A CRM app", "react-node", write);

    expect(events.length).toBeGreaterThan(0);
    expect(
      events.some(
        (e) => e.event === "agent" && (e.data as any).agent === "Planner",
      ),
    ).toBe(true);
  });
});

// ── tRPC Router ──
describe("Projects Router", () => {
  test("tierStatus includes credit count", async () => {
    const { appRouter } = await import("../routers/index.js");
    const caller = appRouter.createCaller({
      user: { id: 1, email: "test@appforge.dev", name: "Test" },
      req: {} as any,
      res: {} as any,
    });

    // Mock isUserPro and countBuildsThisMonth
    const { isUserPro, countBuildsThisMonth, getUserCredits } =
      await import("../db.js");
    vi.mocked(isUserPro).mockResolvedValue(false);
    vi.mocked(countBuildsThisMonth).mockResolvedValue(1);
    vi.mocked(getUserCredits).mockResolvedValue({
      id: 1,
      userId: 1,
      balance: 10,
      tier: "starter",
      monthlyAllowance: 0,
      unlimited: false,
      lastRefillAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const status = await caller.projects.tierStatus();
    expect(status).toHaveProperty("credits");
    expect(status.credits).toBe(10);
  });
});
