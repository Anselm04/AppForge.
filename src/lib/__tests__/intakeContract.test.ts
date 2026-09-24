import { describe, expect, it } from "vitest";
import {
  classifyProductIntent,
  resolveIntakeContract,
} from "../productContract.js";
import { buildJobSchema } from "../buildJob.js";

describe("intake contract resolution (#1 prompt understanding, #4 stack selection)", () => {
  it.each([
    ["Make a snake game", "game", "phaser-html5"],
    ["iPhone app to track workouts", "mobile_app", "react-native-expo"],
    ["A REST API for a bookstore", "api", "api-service"],
    ["An AI agent that triages my Gmail inbox", "ai_agent", "ai-agent-node"],
    [
      "Chrome extension that blocks distracting sites",
      "browser_extension",
      "chrome-extension",
    ],
    ["A landing page for my bakery", "website", "react-node"],
  ])(
    "derives the stack for %j from the contract when no stack is requested",
    (prompt, productType, stack) => {
      const intake = resolveIntakeContract(prompt, undefined);
      expect(intake.ok).toBe(true);
      if (!intake.ok) return;
      expect(intake.productContract.productType).toBe(productType);
      expect(intake.productContract.selectedTechnologyStack).toBe(stack);
      expect(intake.productContract.originalPrompt).toBe(prompt);
    },
  );

  it("treats auto/default as no explicit stack", () => {
    for (const requested of ["auto", "default", "  "]) {
      const intake = resolveIntakeContract("Make a snake game", requested);
      expect(intake.ok && intake.productContract.selectedTechnologyStack).toBe(
        "phaser-html5",
      );
    }
  });

  it("preserves a compatible explicit stack exactly", () => {
    const intake = resolveIntakeContract(
      "A landing page for my bakery",
      "next-node",
    );
    expect(intake.ok && intake.productContract.selectedTechnologyStack).toBe(
      "next-node",
    );
  });

  it("rejects an incompatible explicit stack as a user error instead of converting it", () => {
    const intake = resolveIntakeContract("Make a snake game", "next-node");
    expect(intake.ok).toBe(false);
    if (intake.ok) return;
    expect(intake.reason).toBe("unsupported_stack");
    expect(intake.message).toContain("next-node");
    expect(intake.message).toContain("phaser-html5");
  });

  it("still asks for clarification when there is no product evidence", () => {
    const intake = resolveIntakeContract("Build me something cool", undefined);
    expect(intake.ok).toBe(false);
    if (intake.ok) return;
    expect(intake.reason).toBe("clarification_required");
    expect(intake.clarificationQuestions.length).toBeGreaterThan(0);
  });

  it("produces a contract that a queued build job accepts without disagreement", () => {
    const intake = resolveIntakeContract("iPhone app to track workouts");
    expect(intake.ok).toBe(true);
    if (!intake.ok) return;
    const job = buildJobSchema.safeParse({
      projectId: 1,
      userId: 1,
      description: "iPhone app to track workouts",
      techStack: intake.productContract.selectedTechnologyStack,
      promptIntent: intake.promptIntent,
      productContract: intake.productContract,
      createdAt: new Date(0).toISOString(),
      reservationCharged: false,
    });
    expect(job.success).toBe(true);
  });
});

describe("product intent classifier coverage for common prompts", () => {
  it.each([
    ["Build a todo app", "saas_application"],
    [
      "CRM for plumbers with Stripe billing and team accounts",
      "saas_application",
    ],
    ["Booking system for a hair salon", "saas_application"],
    ["Dashboard that visualizes CSV sales data", "data_product"],
    ["Discord bot that posts daily weather", "automation_tool"],
  ])("classifies %j as %s without asking for clarification", (prompt, type) => {
    const intent = classifyProductIntent(prompt);
    expect(intent.ambiguous).toBe(false);
    expect(intent.primaryProductType).toBe(type);
    expect(intent.originalPrompt).toBe(prompt);
  });

  it("keeps specific product types ahead of generic business nouns", () => {
    expect(
      classifyProductIntent("Mobile app for a booking system")
        .primaryProductType,
    ).toBe("mobile_app");
    expect(
      classifyProductIntent("Browser game with a leaderboard dashboard")
        .primaryProductType,
    ).toBe("game");
  });
});

describe("section 1: ordinary prompts get a sensible default type with confidence", () => {
  it.each([
    ["Build a todo app", "saas_application"],
    [
      "CRM for plumbers with Stripe billing and team accounts",
      "saas_application",
    ],
    ["Dashboard that visualizes CSV sales data", "data_product"],
    ["Discord bot that reminds my team about standups", "automation_tool"],
    ["a 2D platformer game", "game"],
    ["iPhone habit tracker app", "mobile_app"],
    ["REST API for bookings", "api"],
    ["Chrome extension that saves recipes from any page", "browser_extension"],
  ])("resolves %j to %s without clarification", (prompt, type) => {
    const intent = classifyProductIntent(prompt);
    expect(intent.ambiguous).toBe(false);
    expect(intent.primaryProductType).toBe(type);
    expect(intent.confidence).toBeGreaterThan(0.6);
    expect(intent.clarificationQuestions).toEqual([]);
  });

  it("falls back to a low-confidence SaaS guess for generic app wording instead of erroring", () => {
    const intent = classifyProductIntent(
      "Build an app to manage my plumbing jobs",
    );
    expect(intent.ambiguous).toBe(false);
    expect(intent.primaryProductType).toBe("saas_application");
    expect(intent.confidence).toBeLessThan(0.6);
    expect(intent.canonicalInterpretation).toMatch(/default guess/);
  });

  it("detects secondary capabilities alongside the primary type", () => {
    const intent = classifyProductIntent(
      "CRM for plumbers with Stripe billing and team accounts",
    );
    expect(intent.secondaryCapabilities).toEqual(
      expect.arrayContaining(["billing", "teams", "external_integrations"]),
    );
  });

  it("returns a structured clarification (question + choices) only for unresolvable prompts", () => {
    const intake = resolveIntakeContract("Build me something cool");
    expect(intake.ok).toBe(false);
    if (intake.ok || intake.reason !== "clarification_required") return;
    expect(intake.clarification.reason).toBe("clarification_required");
    const [question] = intake.clarification.questions;
    expect(question.id).toBe("primary_product_type");
    expect(question.choices).toHaveLength(12);
    for (const choice of question.choices) {
      expect(choice.label.length).toBeGreaterThan(0);
      expect(choice.description.length).toBeGreaterThan(0);
    }
  });

  it("offers the tied types first when a prompt names two products equally", () => {
    const intake = resolveIntakeContract(
      "Build a browser extension and a developer tool for VSCode",
    );
    expect(intake.ok).toBe(false);
    if (intake.ok || intake.reason !== "clarification_required") return;
    const values = intake.clarification.questions[0].choices.map(
      (choice) => choice.value,
    );
    expect(values.slice(0, 2).sort()).toEqual([
      "browser_extension",
      "developer_tool",
    ]);
  });

  it("builds the user's chosen type after a clarification answer without rewriting the prompt", () => {
    const prompt = "Build me something cool";
    const intake = resolveIntakeContract(prompt, undefined, {
      productType: "game",
    });
    expect(intake.ok).toBe(true);
    if (!intake.ok) return;
    expect(intake.promptIntent.primaryProductType).toBe("game");
    expect(intake.promptIntent.confidence).toBe(1);
    expect(intake.promptIntent.canonicalInterpretation).toMatch(
      /confirmed by the user/,
    );
    expect(intake.productContract.selectedTechnologyStack).toBe("phaser-html5");
    expect(intake.productContract.originalPrompt).toBe(prompt);
  });
});

describe("section 2: the contract is derived from the actual prompt", () => {
  const OLD_GENERIC_REQUIREMENTS = [
    "Implement the complete primary workflow in the original prompt.",
    "Provide functional loading, empty, success, and error states.",
    "Enforce security boundaries and keep credentials server-side.",
  ];

  function contractFor(prompt: string) {
    const intake = resolveIntakeContract(prompt);
    if (!intake.ok) throw new Error(intake.message);
    return intake.productContract;
  }

  it("extracts audience, features, roles, data models, integrations, monetization and security for a CRM", () => {
    const contract = contractFor(
      "CRM for plumbers with Stripe billing and team accounts",
    );
    const requirements = contract.functionalRequirements.map((r) => r.text);
    expect(requirements[0]).toContain('"CRM for plumbers"');
    expect(
      requirements.some((text) => text.startsWith("Stripe billing:")),
    ).toBe(true);
    expect(requirements.some((text) => text.startsWith("Team accounts:"))).toBe(
      true,
    );
    expect(contract.targetUsers).toContain("Plumbers");
    expect(contract.userRoles).toEqual(
      expect.arrayContaining(["team_member", "plumber"]),
    );
    expect(contract.dataModels).toEqual(
      expect.arrayContaining([
        "Organization",
        "Membership",
        "Contact",
        "Deal",
        "Subscription",
      ]),
    );
    expect(contract.integrations).toEqual(["Stripe"]);
    expect(contract.monetizationRequirements[0]).toBe(
      "Revenue model: per seat subscription via Stripe",
    );
    expect(contract.securityRequirements.join("\n")).toMatch(
      /tenant isolation/i,
    );
    expect(contract.contractDerivation).toBe("prompt_deterministic");
  });

  it("gives a platformer gameplay requirements and no invented monetization", () => {
    const contract = contractFor("a 2D platformer game");
    const requirements = contract.functionalRequirements.map((r) => r.text);
    expect(
      requirements.some((text) => /^Platformer mechanics/.test(text)),
    ).toBe(true);
    expect(requirements.some((text) => /2D/.test(text))).toBe(true);
    expect(contract.dataModels).toEqual(["Player", "Level", "Score"]);
    expect(contract.userRoles).toEqual(["player"]);
    expect(contract.monetizationRequirements).toEqual([]);
    expect(requirements.join("\n")).not.toMatch(/Stripe|billing/i);
  });

  it("carries the schedule and integrations a bot prompt asks for", () => {
    const contract = contractFor(
      "Discord bot that posts daily weather updates to a channel",
    );
    const requirements = contract.functionalRequirements.map((r) => r.text);
    expect(requirements.join("\n")).toMatch(/requested schedule \(daily\)/);
    expect(contract.integrations).toEqual(
      expect.arrayContaining(["Discord", "Weather data API"]),
    );
    expect(contract.securityRequirements.join("\n")).toMatch(/Bot token/);
  });

  it("never falls back to the old generic five requirements", () => {
    const prompts = [
      "Build a todo app",
      "REST API for bookings",
      "iPhone habit tracker app",
      "Dashboard that visualizes CSV sales data",
    ];
    const lists = prompts.map((prompt) =>
      contractFor(prompt).functionalRequirements.map((r) => r.text),
    );
    for (const list of lists) {
      for (const generic of OLD_GENERIC_REQUIREMENTS) {
        expect(list).not.toContain(generic);
      }
    }
    expect(new Set(lists.map((list) => JSON.stringify(list))).size).toBe(
      prompts.length,
    );
  });

  it("numbers requirements sequentially and validates against the schema", () => {
    const contract = contractFor(
      "Online store selling handmade candles with cart and checkout",
    );
    contract.functionalRequirements.forEach((requirement, index) => {
      expect(requirement.id).toBe(`REQ-${String(index + 1).padStart(3, "0")}`);
    });
    expect(
      contract.functionalRequirements.some((r) => r.priority === "must"),
    ).toBe(true);
  });

  it("records the classifier's own confidence for auto-classified prompts", () => {
    const intake = resolveIntakeContract("iPhone habit tracker app");
    expect(intake.ok).toBe(true);
    if (!intake.ok) return;
    expect(intake.productContract.intentConfidence).toBe(
      intake.promptIntent.confidence,
    );
    expect(intake.productContract.intentConfidence).toBeLessThan(1);
    expect(intake.productContract.canonicalInterpretation).not.toMatch(
      /confirmed by the user/,
    );
  });

  it("keeps the original prompt verbatim and one canonical interpretation", () => {
    const prompt = "  REST API   for bookings\n with   webhooks ";
    const contract = contractFor(prompt);
    expect(contract.originalPrompt).toBe(prompt);
    expect(contract.canonicalInterpretation).toMatch(
      /^Primary product type: API\./,
    );
    expect(contract.canonicalInterpretation).toMatch(/Interpreted product:/);
  });
});
