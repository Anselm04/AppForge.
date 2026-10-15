import { parse } from "yaml";
import { get } from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import {
  getStackScaffold,
  mergeScaffoldWithGenerated,
} from "../../services/stackScaffolds.js";
import { validateGeneratedProjectStructure } from "../generatedProjectStructure.js";

function request(
  url: string,
): Promise<{ status: number | undefined; body: unknown }> {
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve({ status: response.statusCode, body: JSON.parse(body) });
        } catch (error) {
          reject(error);
        }
      });
      response.on("error", reject);
    }).on("error", reject);
  });
}

describe("connected Flutter Node scaffold", () => {
  it("connects both components to one public API contract", () => {
    const files = getStackScaffold("flutter-node");
    expect(files["lib/api_client.dart"]).toContain(
      "shared/contracts/product-api.json",
    );
    expect(files["server/src/api-contract.ts"]).toContain(
      "shared/contracts/product-api.json",
    );
    expect(
      JSON.parse(files["shared/contracts/product-api.json"]),
    ).toMatchObject({
      version: 1,
      health: { live: "/health/live", ready: "/health/ready" },
    });
    expect(files["pubspec.yaml"]).toContain(
      "shared/contracts/product-api.json",
    );
    expect(validateGeneratedProjectStructure(files, "flutter-node")).toEqual(
      [],
    );
  });

  it("adds real Supabase auth and owner-scoped persistence only when the canonical contract requires them", () => {
    const contract = {
      version: 2,
      originalPrompt:
        "Build a mobile app with secure accounts and saved watches",
      productType: "mobile_app",
      productFamilies: ["frontend", "backend", "database", "mobile", "auth"],
      targetUsers: ["customers"],
      userRoles: ["user"],
      coreWorkflows: ["sign up and save a watch"],
      functionalRequirements: [
        {
          id: "REQ-001",
          text: "Users must create secure accounts",
          category: "security",
          priority: "must",
        },
        {
          id: "REQ-002",
          text: "Users must persist saved watches",
          category: "workflow",
          priority: "must",
        },
      ],
      nonFunctionalRequirements: ["secure"],
      dataModels: ["Watch"],
      integrations: ["Supabase"],
      securityRequirements: ["owner scoped records"],
      deploymentRequirements: ["mobile and backend"],
      monetizationRequirements: [],
      selectedTechnologyStack: "flutter-node",
      researchRequirements: [],
      runtimeRequirements: ["Flutter client", "Node backend"],
      secondaryCapabilities: ["authentication", "database"],
      intentConfidence: 1,
      canonicalInterpretation:
        "Authenticated mobile app with persisted user watches",
    };
    const contractAwareScaffold = getStackScaffold as unknown as (
      stack: string,
      productType: "mobile_app",
      productContract: typeof contract,
    ) => Record<string, string>;
    const files = contractAwareScaffold("flutter-node", "mobile_app", contract);
    const apiContract = JSON.parse(files["shared/contracts/product-api.json"]);
    const manifest = parse(files["pubspec.yaml"]);

    expect(apiContract.authentication).toMatchObject({
      provider: "supabase",
      implemented: true,
      verification: "backend",
    });
    expect(manifest.dependencies).toHaveProperty("supabase_flutter");
    expect(files["lib/auth/session.dart"]).toContain("signUp");
    expect(files["lib/auth/session.dart"]).toContain("signInWithPassword");
    expect(files["server/src/auth.ts"]).toContain("getClaims");
    expect(files["database/migrations/001_user_data.sql"]).toContain(
      "enable row level security",
    );
    expect(files["database/migrations/001_user_data.sql"]).toContain(
      "grant select, insert, update, delete to authenticated",
    );
    expect(files["database/migrations/001_user_data.sql"]).toContain(
      "(select auth.uid()) = user_id",
    );
    expect(
      [files["lib/auth/session.dart"], files["lib/main.dart"]].join("\n"),
    ).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE/i);
  });

  it("merges mandatory Flutter dependencies and assets without dropping product configuration", () => {
    const files = mergeScaffoldWithGenerated(
      getStackScaffold("flutter-node"),
      {
        "pubspec.yaml":
          "name: customer_app\ndependencies:\n  custom_package: ^1.0.0\nflutter:\n  assets:\n    - assets/brand.png\n",
        "lib/main.dart": "void main() {}",
        "server/src/server.ts": "export const app = true;",
      },
      "flutter-node",
    );
    const manifest = parse(files["pubspec.yaml"]);
    expect(manifest.name).toBe("customer_app");
    expect(manifest.dependencies).toMatchObject({
      custom_package: "^1.0.0",
      http: "^1.2.0",
      flutter: { sdk: "flutter" },
    });
    expect(manifest.flutter.assets).toEqual(
      expect.arrayContaining([
        "assets/brand.png",
        "shared/contracts/product-api.json",
      ]),
    );
    expect(files["lib/main.dart"]).toBe("void main() {}");
  });
  it("rejects a Flutter manifest that disconnects the injected client", () => {
    const files = getStackScaffold("flutter-node");
    files["pubspec.yaml"] = "name: disconnected\n";
    expect(validateGeneratedProjectStructure(files, "flutter-node")).toContain(
      "Flutter manifest must declare http and the shared API contract asset",
    );
  });
  it("rejects an invalid shared API contract before runtime", () => {
    const files = getStackScaffold("flutter-node");
    files["shared/contracts/product-api.json"] = '{"version":99}';
    expect(validateGeneratedProjectStructure(files, "flutter-node")).toContain(
      "invalid shared API contract shared/contracts/product-api.json",
    );
  });
});

it("compiles the trusted backend scaffold and serves its actual contract", async () => {
  const directory = await mkdtemp(join(tmpdir(), "appforge-composite-"));
  let child: ReturnType<typeof spawn> | undefined;
  try {
    const files = getStackScaffold("flutter-node");
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(directory, path)), { recursive: true });
      await writeFile(join(directory, path), content);
    }
    execFileSync(
      process.execPath,
      [
        resolve("node_modules/typescript/bin/tsc"),
        "-p",
        join(directory, "server/tsconfig.json"),
        "--typeRoots",
        resolve("node_modules/@types"),
      ],
      { cwd: directory, env: { PATH: process.env.PATH }, timeout: 30000 },
    );
    child = spawn(process.execPath, ["build/server/server.js"], {
      cwd: directory,
      env: { PATH: process.env.PATH, PORT: "0", HOST: "127.0.0.1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output = await Promise.race([
      once(child.stdout!, "data"),
      once(child, "exit").then(() => {
        throw new Error("Backend exited before listening");
      }),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Backend startup timed out")),
          5000,
        );
        timer.unref();
      }),
    ]);
    const { port } = JSON.parse(String(output[0]));
    const base = `http://127.0.0.1:${port}`;
    for (const route of ["/health/live", "/health/ready"]) {
      const response = await request(base + route);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "ok",
        apiVersion: 1,
        scope: "infrastructure-only",
      });
    }
    const missing = await request(base + "/private");
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
    child.kill("SIGTERM");
    await once(child, "exit");
    child = undefined;
    await writeFile(
      join(directory, "shared/contracts/product-api.json"),
      '{"version":99}',
    );
    expect(() =>
      execFileSync(process.execPath, ["build/server/server.js"], {
        cwd: directory,
        env: { PATH: process.env.PATH, PORT: "0" },
        timeout: 5000,
        stdio: "pipe",
      }),
    ).toThrow();
  } finally {
    if (child && child.exitCode === null) {
      child.kill("SIGKILL");
      await once(child, "exit");
    }
    await rm(directory, { recursive: true, force: true });
  }
}, 40000);
