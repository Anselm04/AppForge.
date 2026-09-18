import { describe, expect, it } from "vitest";
import { createRequirementContract } from "../agents/testingAgent";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("requirement-linked behavioral test contract", () => {
  it("assigns stable requirement IDs and removes duplicate requirements", () => {
    expect(
      createRequirementContract([
        "User can save",
        "User can save",
        "User can search",
      ]),
    ).toEqual([
      { id: "REQ-001", text: "User can save" },
      { id: "REQ-002", text: "User can search" },
    ]);
  });

  it("passes the product description and planned behaviors into test generation", () => {
    const pipeline = readFileSync(
      resolve(process.cwd(), "src/agents/.pipeline_parts/part3.txt"),
      "utf8",
    );
    expect(pipeline).toContain(
      "attachGeneratedTests(generatedFiles, techStack, [",
    );
    expect(pipeline).toContain("description,");
    expect(pipeline).toContain("...tasks.map((task) => task.description)");
  });

  it("fails full validation when requirement markers are absent", () => {
    const validator = readFileSync(
      resolve(process.cwd(), "src/agents/buildValidator.ts"),
      "utf8",
    );
    expect(validator).toContain("validateRequirementTestCoverage");
    expect(validator).toContain("has no linked executable behavioral test");
    expect(validator).toContain('stage: "requirements"');
  });
});
