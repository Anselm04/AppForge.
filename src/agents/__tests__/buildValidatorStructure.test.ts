import { describe, expect, it } from "vitest";
import { validateGeneratedBuild } from "../buildValidator.js";
import { getStackScaffold } from "../../services/stackScaffolds.js";

describe("build validator project structure gate", () => {
  it("blocks unsafe generated paths before install or execution", async () => {
    const files = {
      ...getStackScaffold("react-node", "saas_application"),
      "../escape.txt": "must never be written outside the sandbox",
    };

    const result = await validateGeneratedBuild(files, "react-node");

    expect(result.passed).toBe(false);
    expect(result.stage).toBe("structure");
    expect(result.errors).toContain(
      "unsafe project path escapes project directory: ../escape.txt",
    );
  });

  it("blocks undeclared runtime dependencies before running generated code", async () => {
    const files = {
      ...getStackScaffold("react-node", "saas_application"),
      "src/App.tsx":
        'import axios from "axios"; export function App(){return <main>{String(axios)}</main>}',
    };

    const result = await validateGeneratedBuild(files, "react-node");

    expect(result.passed).toBe(false);
    expect(result.stage).toBe("structure");
    expect(result.errors).toContain(
      "src/App.tsx: missing runtime dependency axios",
    );
  });
});
