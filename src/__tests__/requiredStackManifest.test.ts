import { describe, expect, it } from "vitest";
import { ensureEssentialFiles } from "../services/multiFileCoder.js";

describe("required generated stack manifests", () => {
  it("does not mistake Python requirements for a Node manifest", () => {
    const generated = {
      "requirements.txt": "requests==2.32.0",
      "README.md": "# Customer product",
      "index.html": "<main>Customer product</main>",
      "src/App.tsx": "export const App = () => <main>Customer</main>;",
    };
    const files = ensureEssentialFiles(generated, "react-node");
    expect(files["package.json"]).toContain('"build"');
    expect(files["requirements.txt"]).toBe(generated["requirements.txt"]);
    expect(files["src/App.tsx"]).toBe(generated["src/App.tsx"]);
  });

  it("requires both Flutter and Node backend manifests", () => {
    const generated = {
      "pubspec.yaml": "name: customer_mobile",
      "README.md": "# Customer mobile product",
      "index.html": "<main>Documentation</main>",
      "lib/main.dart": "void main() {}",
    };
    const files = ensureEssentialFiles(generated, "flutter-node");
    expect(files["package.json"]).toContain("appforge-mobile-backend");
    expect(files["pubspec.yaml"]).toBe(generated["pubspec.yaml"]);
    expect(files["lib/main.dart"]).toBe(generated["lib/main.dart"]);
  });
});
