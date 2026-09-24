import { describe, expect, it } from "vitest";
import {
  ensureGeneratedProjectStructure,
  getGeneratedProjectStructurePolicy,
  isSafeProjectPath,
  validateGeneratedProjectStructure,
} from "../generatedProjectStructure.js";
import { getStackScaffold } from "../../services/stackScaffolds.js";

describe("generated project structure", () => {
  it("defines routing, API/database, asset, docs, scripts and lockfile policy per stack", () => {
    const policy = getGeneratedProjectStructurePolicy("react-node");
    expect(policy).toMatchObject({
      stack: "react-node",
      runtime: "node",
      packageManager: "npm",
      lockfile: "package-lock.json",
      lockfileRequiredAfterInstall: true,
      routingBoundary: "src/",
      apiBoundary: "src/server/",
      databaseBoundary: "src/db/",
      requiredDocumentation: ["README.md", "SECURITY.md", "LICENSE"],
      buildCommand: "npm run build",
      startCommand: "npm run start",
    });
    expect(policy.assetRoots).toContain("public/");
  });

  it("generates mandatory project documentation and structure metadata", () => {
    const files = ensureGeneratedProjectStructure(
      {
        "package.json": JSON.stringify({
          name: "demo-app",
          version: "1.0.0",
          scripts: { build: "vite build", start: "vite preview" },
          dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
          devDependencies: {
            "@types/react": "^18.2.0",
            "@vitejs/plugin-react": "^4.2.1",
            typescript: "^5.3.0",
            vite: "^5.0.0",
          },
        }),
      },
      "react-node",
    );

    expect(files["README.md"]).toContain("Project boundaries");
    expect(files["SECURITY.md"]).toContain("Do not commit production secrets");
    expect(files["LICENSE"]).toContain("All rights reserved");
    const structure = JSON.parse(files["appforge.structure.json"]);
    expect(structure.routingBoundary).toBe("src/");
    expect(structure.apiBoundary).toBe("src/server/");
    expect(structure.databaseBoundary).toBe("src/db/");
  });

  it("accepts every canonical stack scaffold as structurally valid", () => {
    for (const stack of [
      "react-node",
      "static-html",
      "next-node",
      "phaser-html5",
      "three-js-3d",
      "react-native-expo",
      "flutter-firebase",
      "electron-react",
      "tauri-rust",
      "api-service",
      "node-service",
      "python-service",
      "ai-agent-node",
      "ai-agent-python",
      "chrome-extension",
      "browser-automation",
      "data-visualization",
    ]) {
      const scaffold = getStackScaffold(stack);
      expect(validateGeneratedProjectStructure(scaffold, stack), stack).toEqual(
        [],
      );
    }
  });

  it("rejects files that can escape or address outside the generated project", () => {
    for (const path of [
      "../secrets.txt",
      "src/../../secrets.txt",
      "/etc/passwd",
      "C:/Windows/system.ini",
      "src\\escape.ts",
    ]) {
      expect(isSafeProjectPath(path), path).toBe(false);
    }

    const files = {
      ...getStackScaffold("react-node"),
      "../escape.txt": "no",
    };
    expect(validateGeneratedProjectStructure(files, "react-node")).toContain(
      "unsafe project path escapes project directory: ../escape.txt",
    );
  });

  it("rejects conflicting entrypoints", () => {
    const files = {
      ...getStackScaffold("react-node"),
      "src/main.ts": "export const duplicate = true;",
    };
    expect(validateGeneratedProjectStructure(files, "react-node")).toContain(
      "conflicting entrypoints: src/main.tsx, src/main.ts",
    );
  });

  it("rejects broken relative imports before build execution", () => {
    const files = {
      ...getStackScaffold("react-node"),
      "src/App.tsx":
        'import { Missing } from "./missing"; export function App(){return <Missing/>}',
    };
    expect(validateGeneratedProjectStructure(files, "react-node")).toContain(
      "src/App.tsx: broken relative import ./missing",
    );
  });

  it("rejects invalid package names and incompatible React dependency majors", () => {
    const files = getStackScaffold("react-node");
    const pkg = JSON.parse(files["package.json"]);
    pkg.name = "Invalid Package Name";
    pkg.dependencies.react = "^19.0.0";
    pkg.dependencies["react-dom"] = "^18.2.0";
    files["package.json"] = JSON.stringify(pkg);

    const problems = validateGeneratedProjectStructure(files, "react-node");
    expect(problems).toContain("package.json has invalid package name");
    expect(problems).toContain(
      "react and react-dom major versions are incompatible",
    );
  });

  it("rejects missing runtime and undeclared development dependencies", () => {
    const runtimeFiles = {
      ...getStackScaffold("react-node"),
      "src/App.tsx":
        'import dayjs from "dayjs"; export function App(){return <main>{dayjs().year()}</main>}',
    };
    expect(validateGeneratedProjectStructure(runtimeFiles, "react-node")).toContain(
      "src/App.tsx: missing runtime dependency dayjs",
    );

    const devFiles = {
      ...getStackScaffold("react-node"),
      "src/example.test.ts": 'import fc from "fast-check"; export const value=fc;',
    };
    expect(validateGeneratedProjectStructure(devFiles, "react-node")).toContain(
      "src/example.test.ts: undeclared development dependency fast-check",
    );
  });

  it("rejects conflicting or stale npm lockfiles", () => {
    const conflicting = {
      ...getStackScaffold("react-node"),
      "package-lock.json": JSON.stringify({
        name: "appforge-app",
        version: "0.1.0",
        lockfileVersion: 3,
        packages: {
          "": {
            name: "appforge-app",
            version: "0.1.0",
            dependencies: {
              react: "^18.2.0",
              "react-dom": "^18.2.0",
            },
            devDependencies: {
              "@types/react": "^18.2.55",
              "@types/react-dom": "^18.2.19",
              "@vitejs/plugin-react": "^4.2.1",
              typescript: "^5.3.3",
              vite: "^5.1.0",
            },
          },
        },
      }),
      "yarn.lock": "conflict",
    };
    expect(validateGeneratedProjectStructure(conflicting, "react-node")).toContain(
      "conflicting package-manager lockfiles: package-lock.json, yarn.lock",
    );

    const stale = getStackScaffold("react-node");
    stale["package-lock.json"] = JSON.stringify({
      name: "appforge-app",
      version: "0.1.0",
      lockfileVersion: 3,
      packages: {
        "": {
          name: "appforge-app",
          version: "0.1.0",
          dependencies: { react: "^17.0.0" },
          devDependencies: {},
        },
      },
    });
    const staleProblems = validateGeneratedProjectStructure(stale, "react-node");
    expect(staleProblems).toContain(
      "package-lock.json runtime dependencies are stale",
    );
    expect(staleProblems).toContain(
      "package-lock.json development dependencies are stale",
    );
  });

  it("rejects missing build/start scripts and mandatory configuration files", () => {
    const files = getStackScaffold("react-node");
    const pkg = JSON.parse(files["package.json"]);
    delete pkg.scripts.build;
    delete pkg.scripts.start;
    files["package.json"] = JSON.stringify(pkg);
    delete files["vite.config.ts"];

    const problems = validateGeneratedProjectStructure(files, "react-node");
    expect(problems).toContain("package.json missing required build script");
    expect(problems).toContain("package.json missing required start script");
    expect(problems).toContain(
      "missing configuration/environment file vite.config.ts",
    );
  });
});
