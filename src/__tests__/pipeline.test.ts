import { describe, it, expect } from "vitest";
import { AgentOrchestrator } from "../services/agent-orchestrator.js";

describe("AgentOrchestrator", () => {
  const orchestrator = new AgentOrchestrator();

  it("should return a build plan with an id and prompt", async () => {
    const plan = await orchestrator.runBuild("Build a React CRM app");
    expect(plan.id).toMatch(/^build_\d+$/);
    expect(plan.prompt).toBe("Build a React CRM app");
    expect(plan.createdAt).toBeInstanceOf(Date);
  });

  it("should include all 7 agent results", async () => {
    const plan = await orchestrator.runBuild("todo app");
    expect(plan.agents).toHaveLength(7);
    const roles = plan.agents.map((a) => a.role);
    expect(roles).toContain("architect");
    expect(roles).toContain("backend");
    expect(roles).toContain("frontend");
    expect(roles).toContain("database");
    expect(roles).toContain("devops");
    expect(roles).toContain("security");
    expect(roles).toContain("testing");
  });

  it("should populate architecture from architect agent", async () => {
    const plan = await orchestrator.runBuild("test");
    const architect = plan.agents.find((a) => a.role === "architect");
    expect(architect).toBeDefined();
    expect(plan.architecture).toBeDefined();
    expect(plan.architecture).toEqual(architect!.details);
  });

  it("should populate requirements/decisions with all roles", async () => {
    const plan = await orchestrator.runBuild("test");
    const expectedRoles = [
      "architect",
      "backend",
      "frontend",
      "database",
      "devops",
      "security",
      "testing",
    ];
    expectedRoles.forEach((role) => {
      expect(plan.requirements).toHaveProperty(role);
    });
  });

  it("should run build successfully without throwing", async () => {
    await expect(orchestrator.runBuild("any prompt")).resolves.toBeDefined();
  });
});
