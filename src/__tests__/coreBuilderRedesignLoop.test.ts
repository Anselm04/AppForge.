import { afterEach, describe, expect, it } from "vitest";
import {
  buildFailureDossier,
  resolveMaxFixRetries,
} from "../lib/neverGiveUp.js";

const originalRetries = process.env.BUILD_MAX_FIX_RETRIES;
const originalNeverGiveUp = process.env.BUILD_NEVER_GIVE_UP;

afterEach(() => {
  if (originalRetries === undefined) delete process.env.BUILD_MAX_FIX_RETRIES;
  else process.env.BUILD_MAX_FIX_RETRIES = originalRetries;
  if (originalNeverGiveUp === undefined) delete process.env.BUILD_NEVER_GIVE_UP;
  else process.env.BUILD_NEVER_GIVE_UP = originalNeverGiveUp;
});

describe("Core Builder redesign loop", () => {
  it("uses a short bounded repair burst before redesign", () => {
    delete process.env.BUILD_MAX_FIX_RETRIES;
    process.env.BUILD_NEVER_GIVE_UP = "true";
    expect(resolveMaxFixRetries("react-node")).toBe(3);
  });

  it("creates a failure dossier that prevents blind plan repetition", () => {
    const dossier = buildFailureDossier({
      outerAttempt: 2,
      techStack: "react-node",
      stage: "typecheck",
      errors: ["src/App.tsx: syntax error", "missing API contract"],
      previousTasks: [
        {
          id: "1",
          module: "Core UI",
          description: "single-file implementation",
        },
      ],
      provider: "primary",
      model: "coder-model",
    });
    expect(dossier).toContain("REDESIGN REQUIRED");
    expect(dossier).toContain("typecheck");
    expect(dossier).toContain("single-file implementation");
    expect(dossier).toContain("Do NOT simply return the same task breakdown");
  });
});
