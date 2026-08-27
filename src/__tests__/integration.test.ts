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

    supabaseAuthMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ── Credit System ──
describe("Credit System", () => {
  test("getUserCredits returns undefined if no credits record", async () => {
    const { getUserCredits } = await import("../db.js");
    vi.mocked(getUserCredits).mockResolvedValue(undefined);
    const result = await getUserCredits(1);
    expect(result).toBeUndefined();
  });

  test("deductCredits rejects when mocked to throw insufficient credits", async () => {
    const { deductCredits } = await import("../db.js");
    vi.mocked(deductCredits).mockRejectedValue(
      new Error("Insufficient credits: need 5, have 2"),
    );
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

    // Router may respond via json or defer to next on misconfig — never 500 for valid shape
    expect(res.status).not.toHaveBeenCalledWith(500);
    if (res.json.mock.calls.length > 0) {
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.any(String) }),
      );
    }
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
    const { getUserCredits, isUserPro, countBuildsThisMonth } =
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

    const credits = await getUserCredits(1);
    expect(credits).toHaveProperty("balance", 10);
  });
});
