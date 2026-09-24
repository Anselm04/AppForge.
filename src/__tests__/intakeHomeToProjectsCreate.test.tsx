/**
 * Regression: every product type goes through the real Home page payload,
 * the real tRPC projects.create procedure, the canonical contract, and stack
 * selection. Only I/O boundaries (database, queue, captcha, moderation, auth
 * session) are replaced; the classifier, contract builder, stack adapters,
 * router validation, and Home component run for real.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCError } from "@trpc/server";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { ProductContract } from "../lib/productContract.js";
import { buildJobSchema } from "../lib/buildJob.js";

const created: Array<{ techStack: string; productContract: ProductContract }> =
  [];
const queued: unknown[] = [];
const navigateSpy = vi.fn();

vi.mock("../db.js", () => ({
  createProject: vi.fn(async (data: Record<string, unknown>) => {
    created.push(data as never);
    return created.length;
  }),
  countBuildsThisMonth: vi.fn(async () => 0),
  ensureUserCredits: vi.fn(async () => ({
    balance: 100,
    unlimited: false,
    tier: "builder",
  })),
  getUserTier: vi.fn(async () => "builder"),
  getTierBuildLimit: vi.fn(() => null),
  deductCredits: vi.fn(async () => undefined),
  addCredits: vi.fn(async () => undefined),
  db: {
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  },
}));
vi.mock("../lib/hcaptcha.js", () => ({
  verifyHcaptchaToken: vi.fn(async () => true),
}));
vi.mock("../routers/moderation.js", () => ({
  moderateUserContent: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("../services/build-claim.js", () => ({
  claimProjectBuildStart: vi.fn(async () => true),
  releaseProjectBuildClaim: vi.fn(async () => undefined),
}));
vi.mock("../services/build-queue.js", () => ({
  enqueueBuild: vi.fn(async (job: unknown) => {
    queued.push(job);
  }),
}));

// Home talks to the real router through this client.
vi.mock("../utils/trpc.js", async () => {
  const { projectsRouter } = await import("../routers/projects.js");
  const caller = projectsRouter.createCaller({
    req: {} as never,
    res: {} as never,
    user: { id: 7, email: "maker@example.com", name: "Maker" },
  });
  return {
    trpc: {
      auth: {
        me: { query: async () => ({ id: 7, email: "maker@example.com" }) },
      },
      projects: {
        tierStatus: {
          query: async () => ({
            tier: "builder",
            credits: 100,
            unlimited: false,
          }),
        },
        create: { mutate: (input: never) => caller.create(input) },
      },
    },
  };
});
vi.mock("../lib/auth.js", () => ({
  ensureFreshSession: vi.fn(async () => ({ accessToken: "token" })),
  getAccessToken: vi.fn(() => "token"),
  refreshSession: vi.fn(async () => false),
  loginPathWithReturn: (path: string) => `/login?next=${path}`,
}));
vi.mock("../components/HcaptchaWidget.js", () => ({
  HcaptchaWidget: () => null,
}));
vi.mock("../components/CreditsPauseBanner.js", () => ({
  CreditsPauseBanner: () => null,
}));
vi.mock("../i18n/LocaleContext.js", () => ({
  useLocale: () => ({ t: (key: string) => key, locale: "en" }),
}));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigateSpy,
}));

const { Home } = await import("../pages/Home.js");
const { projectsRouter } = await import("../routers/projects.js");

function renderHome() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Home />
    </QueryClientProvider>,
  );
}

async function submitFromHome(prompt: string) {
  renderHome();
  fireEvent.change(screen.getByTestId("hero-app-idea-textarea"), {
    target: { value: prompt },
  });
  const button = screen.getByTestId("home-generate-button");
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
}

beforeAll(() => {
  process.env.APPFORGE_CONTRACT_LLM_ENRICHMENT = "off";
});
afterAll(() => {
  delete process.env.APPFORGE_CONTRACT_LLM_ENRICHMENT;
});
beforeEach(() => {
  created.length = 0;
  queued.length = 0;
  navigateSpy.mockReset();
  localStorage.clear();
});

// [prompt, product type, stack adapter, words the prompt-specific requirements must carry]
const PRODUCT_CASES: Array<[string, string, string, RegExp]> = [
  ["Marketing website for my bakery", "website", "react-node", /bakery/i],
  [
    "CRM for plumbers with Stripe billing and team accounts",
    "saas_application",
    "react-node",
    /plumbers|Stripe billing|Team accounts/,
  ],
  ["iPhone habit tracker app", "mobile_app", "react-native-expo", /habit/i],
  [
    "Desktop app for editing markdown notes offline",
    "desktop_app",
    "electron-react",
    /markdown notes|Note/,
  ],
  ["a 2D platformer game", "game", "phaser-html5", /platformer/i],
  [
    "AI agent that triages my Gmail inbox and drafts replies",
    "ai_agent",
    "ai-agent-node",
    /Gmail|drafts replies/i,
  ],
  [
    "CLI tool that generates TypeScript types from JSON",
    "developer_tool",
    "node-service",
    /TypeScript types/,
  ],
  ["REST API for bookings", "api", "api-service", /Booking/],
  [
    "Online store selling handmade candles with cart and checkout",
    "ecommerce_product",
    "react-node",
    /handmade candles/,
  ],
  [
    "Chrome extension that summarizes the current page with AI",
    "browser_extension",
    "chrome-extension",
    /summarizes the current page/i,
  ],
  [
    "Discord bot that posts daily weather updates to a channel",
    "automation_tool",
    "node-service",
    /weather|daily/i,
  ],
  [
    "Dashboard that visualizes CSV sales data",
    "data_product",
    "data-visualization",
    /CSV/,
  ],
];

describe("Home → projects.create → contract → stack", () => {
  it.each(PRODUCT_CASES)(
    "builds %j as %s on %s with prompt-specific requirements",
    async (prompt, productType, stack, promptWords) => {
      await submitFromHome(prompt);
      await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/build/1"));

      expect(created).toHaveLength(1);
      const [project] = created;
      expect(project.techStack).toBe(stack);
      expect(project.productContract.productType).toBe(productType);
      expect(project.productContract.selectedTechnologyStack).toBe(stack);
      expect(project.productContract.originalPrompt).toBe(prompt);
      const requirementText = project.productContract.functionalRequirements
        .map((requirement) => requirement.text)
        .join("\n");
      expect(requirementText).toMatch(promptWords);
      expect(requirementText).not.toContain(
        "Implement the complete primary workflow in the original prompt.",
      );

      // The queued job is exactly what the build worker validates.
      expect(queued).toHaveLength(1);
      expect(buildJobSchema.safeParse(queued[0]).success).toBe(true);
    },
  );

  it("gives every product type a different requirement list", async () => {
    const lists = new Set<string>();
    for (const [prompt] of PRODUCT_CASES) {
      const caller = projectsRouter.createCaller({
        req: {} as never,
        res: {} as never,
        user: { id: 7, email: "maker@example.com", name: "Maker" },
      });
      await caller.create({ title: prompt.slice(0, 60), description: prompt });
    }
    for (const project of created) {
      lists.add(
        JSON.stringify(
          project.productContract.functionalRequirements.map((r) => r.text),
        ),
      );
    }
    expect(lists.size).toBe(PRODUCT_CASES.length);
  });

  it("shows a structured clarification for an unresolvable prompt and builds the chosen type", async () => {
    await submitFromHome("Build me something cool please");

    const panel = await screen.findByTestId("home-clarification");
    expect(panel).toHaveTextContent(/What kind of product/i);
    expect(created).toHaveLength(0);
    expect(navigateSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("home-clarification-choice-game"));
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/build/1"));
    expect(created).toHaveLength(1);
    expect(created[0].productContract.productType).toBe("game");
    expect(created[0].techStack).toBe("phaser-html5");
    expect(created[0].productContract.originalPrompt).toBe(
      "Build me something cool please",
    );
  });

  it("returns clarification data (not an error) from projects.create", async () => {
    const caller = projectsRouter.createCaller({
      req: {} as never,
      res: {} as never,
      user: { id: 7, email: "maker@example.com", name: "Maker" },
    });
    const result = await caller.create({
      title: "x",
      description: "Build me something cool please",
    });
    expect(result.status).toBe("clarification_required");
    if (result.status !== "clarification_required") return;
    const [question] = result.clarification.questions;
    expect(question.id).toBe("primary_product_type");
    expect(question.choices.map((choice) => choice.value)).toEqual(
      expect.arrayContaining(["game", "mobile_app", "api", "website"]),
    );
    expect(created).toHaveLength(0);
  });

  it("keeps a compatible explicit stack and rejects an incompatible one with a 400, never a 500", async () => {
    const caller = projectsRouter.createCaller({
      req: {} as never,
      res: {} as never,
      user: { id: 7, email: "maker@example.com", name: "Maker" },
    });

    await caller.create({
      title: "Bakery",
      description: "Marketing website for my bakery",
      techStack: "next-node",
    });
    expect(created[0].techStack).toBe("next-node");

    const error = await caller
      .create({
        title: "Game",
        description: "a 2D platformer game",
        techStack: "next-node",
      })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("BAD_REQUEST");
    expect((error as TRPCError).message).toMatch(/next-node/);
    expect((error as TRPCError).message).toMatch(/phaser-html5/);
    expect(created).toHaveLength(1);
  });
});
