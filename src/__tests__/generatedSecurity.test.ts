import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  scanProjectFiles,
  validateGeneratedSecurityPosture,
} from "../services/projectSecurityScanner.js";
import { getStackScaffold } from "../services/stackScaffolds.js";
import type { ProductContract } from "../lib/productContract.js";
import { validateGeneratedBuild } from "../agents/buildValidator.js";
import { deployValidatedProject } from "../services/productionAutoDeploy.js";
import { sanitizeSentryEvent } from "../middleware/sentryHandler.js";

describe("#16 generated security", () => {
  it("blocks high-risk generated source patterns", () => {
    const scan = scanProjectFiles({
      "src/server.ts": [
        "const target = req.query.url;",
        "fetch(req.query.url);",
        "res.redirect(req.query.next);",
        "execSync(`echo ${req.body.value}`);",
      ].join("\n"),
      "src/auth.ts": [
        "const userId = req.body.userId;",
        "console.log(process.env.OPENAI_API_KEY);",
        "element.innerHTML = req.body.html;",
      ].join("\n"),
      "package.json": JSON.stringify({
        dependencies: {
          unsafe: "*",
          remote: "https://example.com/pkg.tgz",
        },
      }),
    });

    expect(scan.passed).toBe(false);
    expect(scan.findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        "ssrf.untrusted-fetch",
        "web.open-redirect",
        "code.shell-exec-interpolation",
        "dependency.unpinned",
        "dependency.unsafe-source",
        "auth.client-controlled-identity",
        "secret.logged-env",
        "web.inner-html-assignment",
      ]),
    );
  });

  it("requires secure HTTP service defaults", () => {
    const findings = validateGeneratedSecurityPosture(
      {
        "src/server.ts":
          'import express from "express"; const app=express(); app.get("/",(_req,res)=>res.send("ok"));',
      },
      "api-service",
    );
    expect(findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        "service.secure-headers",
        "service.rate-limiting",
      ]),
    );
  });

  it("requires CSRF boundaries for cookie-authenticated mutations", () => {
    const findings = validateGeneratedSecurityPosture(
      {
        "src/server.ts":
          'res.cookie("session","x",{httpOnly:true,sameSite:"strict"}); app.post("/account", handler);',
      },
      "api-service",
    );
    expect(findings.map((finding) => finding.ruleId)).toContain(
      "web.csrf-protection",
    );
  });

  it("requires file-upload constraints and AI tool permissions", () => {
    const findings = validateGeneratedSecurityPosture(
      {
        "src/server.ts":
          'const upload = multer(); app.post("/upload", upload.single("file"), handler); const agent={tools:[deleteFileTool]};',
      },
      "api-service",
    );
    expect(findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining(["upload.unbounded", "ai.unrestricted-tools"]),
    );
  });

  it("wires mandatory security gates into validation, isolated builds and production deploy", () => {
    const validator = readFileSync("src/agents/buildValidator.ts", "utf8");
    const deployer = readFileSync("src/services/productionAutoDeploy.ts", "utf8");
    const isolated = readFileSync("src/services/isolatedBuildRunner.ts", "utf8");
    expect(validator).toContain("scanProjectFiles(files)");
    expect(validator).toContain('stage: "security"');
    expect(deployer).toContain("Production deployment blocked by generated-project security findings");
    expect(isolated).toContain('"security"');
    expect(isolated).toContain("dependencyAudit: true");
    expect(isolated).toContain("blockNetworkToPrivateRanges: true");
    expect(isolated).toContain("blockShellExecution: true");
  });


  it("blocks server/service credentials in browser code and secret logging", () => {
    const scan = scanProjectFiles({
      "src/App.tsx":
        'export const config={key:process.env.SUPABASE_SERVICE_ROLE_KEY};',
      "src/server.ts":
        'console.log(process.env.STRIPE_SECRET_KEY);',
    });
    expect(scan.findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        "secret.client-service-role",
        "secret.logged-env",
      ]),
    );
    expect(scan.passed).toBe(false);
  });

  it("enforces auth, tenant and admin boundaries required by the product contract", () => {
    const contract: ProductContract = {
      version: 2,
      originalPrompt: "Build a multi-tenant admin SaaS with login",
      productType: "saas_application",
      productFamilies: ["frontend", "backend", "database", "auth"],
      targetUsers: ["customers", "admins"],
      userRoles: ["member", "admin"],
      coreWorkflows: ["sign in", "manage workspace"],
      functionalRequirements: [
        {
          id: "REQ-001",
          text: "Authenticated users manage their own workspace",
          category: "security",
          priority: "must",
        },
      ],
      nonFunctionalRequirements: ["secure by default"],
      dataModels: ["User", "Workspace"],
      integrations: [],
      securityRequirements: [
        "Require authentication, tenant isolation, and admin authorization",
      ],
      deploymentRequirements: ["deploy securely"],
      monetizationRequirements: [],
      selectedTechnologyStack: "api-service",
      researchRequirements: [],
      runtimeRequirements: ["HTTP service"],
      secondaryCapabilities: [
        "authentication",
        "database",
        "administration",
        "teams",
      ],
      intentConfidence: 1,
      canonicalInterpretation: "Multi-tenant admin SaaS",
    };

    const findings = validateGeneratedSecurityPosture(
      {
        "src/server.ts": [
          'import express from "express";',
          'import helmet from "helmet";',
          'import { rateLimit } from "express-rate-limit";',
          "const app=express(); app.use(helmet()); app.use(rateLimit({windowMs:1000,limit:10}));",
        ].join("\n"),
      },
      "api-service",
      contract,
    );

    expect(findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        "auth.missing-server-enforcement",
        "tenant.missing-isolation",
        "auth.missing-admin-separation",
      ]),
    );
  });

  it("accepts explicit server-side auth, tenant and admin authorization evidence", () => {
    const contract: ProductContract = {
      version: 2,
      originalPrompt: "Build a secure team admin API",
      productType: "api",
      productFamilies: ["backend", "database", "auth"],
      targetUsers: ["members", "admins"],
      userRoles: ["member", "admin"],
      coreWorkflows: ["access tenant resources"],
      functionalRequirements: [
        {
          id: "REQ-001",
          text: "Enforce authenticated tenant access",
          category: "security",
          priority: "must",
        },
      ],
      nonFunctionalRequirements: ["secure"],
      dataModels: ["User", "Workspace"],
      integrations: [],
      securityRequirements: ["authentication tenant role-based access control"],
      deploymentRequirements: ["deploy"],
      monetizationRequirements: [],
      selectedTechnologyStack: "api-service",
      researchRequirements: [],
      runtimeRequirements: ["HTTP service"],
      secondaryCapabilities: ["authentication", "database", "administration", "teams"],
      intentConfidence: 1,
      canonicalInterpretation: "Secure team admin API",
    };

    const findings = validateGeneratedSecurityPosture(
      {
        "src/server.ts": [
          'import helmet from "helmet";',
          'import { rateLimit } from "express-rate-limit";',
          "app.use(helmet()); app.use(rateLimit({windowMs:1000,limit:10}));",
          "app.use(requireAuth);",
          "const tenantId=req.user.tenantId;",
          'if(req.user.role === "admin"){ next(); }',
        ].join("\n"),
      },
      "api-service",
      contract,
    );

    expect(
      findings.filter((finding) =>
        [
          "auth.missing-server-enforcement",
          "tenant.missing-isolation",
          "auth.missing-admin-separation",
        ].includes(finding.ruleId),
      ),
    ).toEqual([]);
  });

  it("does not treat client-only auth, membership, or admin UI as server enforcement", () => {
    const contract: ProductContract = {
      version: 2,
      originalPrompt: "Build a multi-tenant admin SaaS with login",
      productType: "saas_application",
      productFamilies: ["frontend", "backend", "database", "auth"],
      targetUsers: ["members", "admins"],
      userRoles: ["member", "admin"],
      coreWorkflows: ["sign in", "manage workspace"],
      functionalRequirements: [
        {
          id: "REQ-001",
          text: "Authenticated users can access only their workspace",
          category: "security",
          priority: "must",
        },
      ],
      nonFunctionalRequirements: ["secure by default"],
      dataModels: ["User", "Workspace"],
      integrations: [],
      securityRequirements: [
        "Require authentication, workspace isolation, and admin authorization",
      ],
      deploymentRequirements: ["deploy securely"],
      monetizationRequirements: [],
      selectedTechnologyStack: "react-node",
      researchRequirements: [],
      runtimeRequirements: ["web application"],
      secondaryCapabilities: [
        "authentication",
        "database",
        "administration",
        "teams",
      ],
      intentConfidence: 1,
      canonicalInterpretation: "Multi-tenant admin SaaS",
    };

    const findings = validateGeneratedSecurityPosture(
      {
        "src/App.tsx": [
          "const currentUser = useCurrentUser();",
          "const membership = currentUser.workspaceMembership;",
          "const isAdmin = currentUser.role === \"admin\";",
          "export function App(){ return isAdmin ? <AdminPanel /> : <MemberPanel />; }",
        ].join("\n"),
        "server/index.ts": [
          'import express from "express";',
          'import helmet from "helmet";',
          'import { rateLimit } from "express-rate-limit";',
          "const app=express();",
          "app.use(helmet());",
          "app.use(rateLimit({windowMs:1000,limit:10}));",
          'app.use(express.json({limit:"1mb"}));',
        ].join("\n"),
      },
      "react-node",
      contract,
    );

    expect(findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        "auth.missing-server-enforcement",
        "tenant.missing-isolation",
        "auth.missing-admin-separation",
      ]),
    );
  });

  it("blocks Python command injection, SSRF, path traversal, SQL interpolation and open redirects", () => {
    const scan = scanProjectFiles({
      "app/main.py": [
        "import os, subprocess, requests",
        "os.system(request.query_params['cmd'])",
        "subprocess.run(request.query_params['cmd'], shell=True)",
        "requests.get(request.query_params['url'])",
        "open(request.path_params['file'])",
        "cursor.execute(f\"SELECT * FROM users WHERE id={request.path_params['id']}\")",
        "RedirectResponse(request.query_params['next'])",
      ].join("\n"),
    });

    expect(scan.passed).toBe(false);
    expect(scan.findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        "command.python-shell",
        "ssrf.python-untrusted-request",
        "path.python-untrusted-file-operation",
        "sql.python-interpolation",
        "web.python-open-redirect",
      ]),
    );
  });

  it("blocks persisted secret-bearing env files and unsafe dependency sources", () => {
    const scan = scanProjectFiles({
      ".env.production": "DATABASE_URL=postgres://real-user:real-pass@db/prod\n",
      "requirements.txt": "git+https://github.com/example/private-package.git\n",
      "pubspec.yaml": "dependencies:\n  custom_pkg:\n    path: ../custom_pkg\n",
      "package.json": JSON.stringify({
        dependencies: {
          localpkg: "file:../localpkg",
          "flatmap-stream": "0.1.1",
        },
      }),
    });

    expect(scan.passed).toBe(false);
    expect(scan.findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        "secret.env-artifact",
        "dependency.python-unsafe-source",
        "dependency.dart-unsafe-source",
        "dependency.unsafe-source",
        "dependency.known-malicious",
      ]),
    );
  });

  it("requires explicit abuse controls on generated HTTP services", () => {
    const findings = validateGeneratedSecurityPosture(
      {
        "src/server.ts": [
          'import helmet from "helmet";',
          'import { rateLimit } from "express-rate-limit";',
          "app.use(helmet()); app.use(rateLimit({windowMs:1000,limit:10}));",
        ].join("\n"),
      },
      "api-service",
    );

    expect(findings.map((finding) => finding.ruleId)).toContain(
      "service.abuse-controls",
    );
  });

  it("keeps the Python service scaffold on the secure baseline", () => {
    const files = getStackScaffold("python-service", "api");
    expect(scanProjectFiles(files).passed).toBe(true);
    expect(validateGeneratedSecurityPosture(files, "python-service")).toEqual([]);
    expect(files["app/main.py"]).toContain("SlowAPIMiddleware");
    expect(files["app/main.py"]).toContain("MAX_BODY_BYTES");
    expect(files["app/main.py"]).toContain("X-Content-Type-Options");
  });

  it("makes Docker fallback audit dependencies and execute generated code without network", () => {
    const docker = readFileSync("src/lib/dockerValidator.ts", "utf8");
    expect(docker).toContain("npm audit --audit-level=high");
    expect(docker).toContain("pip-audit -r requirements.txt");
    expect(docker).toContain('"--network=none"');
    expect(docker).toContain("--ignore-scripts");
  });

  it("redacts detected credentials from security evidence", () => {
    const rawSecret =
      "sk_test_1234567890ABCDEFGHIJ1234567890";
    const scan = scanProjectFiles({
      "src/server.ts":
        'const stripeSecret = "' + rawSecret + '"; console.error(process.env.OPENAI_API_KEY);',
    });
    expect(scan.passed).toBe(false);
    expect(scan.findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining(["secret.stripe-key", "secret.logged-env"]),
    );
    expect(
      scan.findings.some((finding) => finding.evidence.includes(rawSecret)),
    ).toBe(false);
  });

  it("blocks hard-coded model-provider credentials and Python secret logging", () => {
    const scan = scanProjectFiles({
      "app/main.py": [
        'MODEL_KEY = "sk-ant-1234567890abcdefghijklmnopqrstuv"',
        'print(os.getenv("OPENAI_API_KEY"))',
      ].join("\n"),
    });
    expect(scan.passed).toBe(false);
    expect(scan.findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        "secret.model-provider-key",
        "secret.python-logging",
      ]),
    );
  });

  it("rejects insecure cookie defaults and accepts explicit safe cookie flags", () => {
    const unsafe = validateGeneratedSecurityPosture(
      {
        "src/server.ts":
          'res.cookie("session", token, { secure: true }); app.post("/change", handler);',
      },
      "api-service",
    );
    expect(unsafe.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        "auth.insecure-cookie-defaults",
        "web.csrf-protection",
      ]),
    );

    const pythonSafe = validateGeneratedSecurityPosture(
      {
        "app/main.py": [
          'response.set_cookie("session", token, httponly=True, secure=True, samesite="strict")',
          "csrf_token = verify_csrf(request)",
        ].join("\n"),
      },
      "python-service",
    );
    expect(
      pythonSafe.filter((finding) =>
        [
          "auth.insecure-cookie-defaults",
          "web.csrf-protection",
        ].includes(finding.ruleId),
      ),
    ).toEqual([]);
  });

  it("rejects missing auth and tenant enforcement through the actual build validator", async () => {
    const contract: ProductContract = {
      version: 2,
      originalPrompt: "Build a multi-tenant admin API with login",
      productType: "api",
      productFamilies: ["backend", "database", "auth"],
      targetUsers: ["members", "admins"],
      userRoles: ["member", "admin"],
      coreWorkflows: ["sign in", "manage tenant records"],
      functionalRequirements: [
        {
          id: "REQ-001",
          text: "Authenticated users can access only their tenant",
          category: "security",
          priority: "must",
        },
      ],
      nonFunctionalRequirements: ["secure by default"],
      dataModels: ["User", "Tenant"],
      integrations: [],
      securityRequirements: [
        "Require authentication, tenant isolation, and admin authorization",
      ],
      deploymentRequirements: ["deploy securely"],
      monetizationRequirements: [],
      selectedTechnologyStack: "api-service",
      researchRequirements: [],
      runtimeRequirements: ["HTTP service"],
      secondaryCapabilities: [
        "authentication",
        "database",
        "administration",
        "teams",
      ],
      intentConfidence: 1,
      canonicalInterpretation: "Secure multi-tenant admin API",
    };
    const files = getStackScaffold("api-service", "api");

    const result = await validateGeneratedBuild(files, "api-service", {
      productContract: contract,
    });

    expect(result.passed).toBe(false);
    expect(result.stage).toBe("security");
    expect(result.errors.join("\n")).toContain(
      "auth.missing-server-enforcement",
    );
    expect(result.errors.join("\n")).toContain("tenant.missing-isolation");
    expect(result.errors.join("\n")).toContain(
      "auth.missing-admin-separation",
    );
  });

  it("rechecks contract-aware security before production deployment", async () => {
    const contract: ProductContract = {
      version: 2,
      originalPrompt: "Build a multi-tenant admin API with login",
      productType: "api",
      productFamilies: ["backend", "database", "auth"],
      targetUsers: ["members", "admins"],
      userRoles: ["member", "admin"],
      coreWorkflows: ["sign in", "manage tenant records"],
      functionalRequirements: [
        {
          id: "REQ-001",
          text: "Authenticated users can access only their tenant",
          category: "security",
          priority: "must",
        },
      ],
      nonFunctionalRequirements: ["secure by default"],
      dataModels: ["User", "Tenant"],
      integrations: [],
      securityRequirements: [
        "Require authentication, tenant isolation, and admin authorization",
      ],
      deploymentRequirements: ["deploy securely"],
      monetizationRequirements: [],
      selectedTechnologyStack: "api-service",
      researchRequirements: [],
      runtimeRequirements: ["HTTP service"],
      secondaryCapabilities: [
        "authentication",
        "database",
        "administration",
        "teams",
      ],
      intentConfidence: 1,
      canonicalInterpretation: "Secure multi-tenant admin API",
    };

    await expect(
      deployValidatedProject({
        projectId: 777,
        projectName: "security-gate-test",
        files: getStackScaffold("api-service", "api"),
        productContract: contract,
      }),
    ).rejects.toThrow(
      "Production deployment blocked by generated-project security findings",
    );
  });

  it("redacts secrets from Sentry telemetry", () => {
    const bearer = ["abc", "def", "ghi"].join(".");
    const modelKey = ["sk", "proj", "syntheticcredentialvalue1234567890"].join("-");
    const stripeKey = ["sk", "live", "synthetickeyvalue1234567890"].join("_");
    const databaseUrl = ["postgres://user", "pass@db/prod"].join(":");

    const event = sanitizeSentryEvent({
      authorization: "Bearer " + bearer,
      nested: {
        apiKey: "synthetic-sensitive-value",
        message:
          "provider=" + modelKey + " DATABASE_URL=" + databaseUrl,
      },
      stripe: stripeKey,
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(bearer);
    expect(serialized).not.toContain("synthetic-sensitive-value");
    expect(serialized).not.toContain(modelKey);
    expect(serialized).not.toContain(stripeKey);
    expect(serialized).not.toContain(databaseUrl);
    expect(serialized).toContain("redacted");
  });

  it("keeps the Node service scaffold on the secure baseline", () => {
    const files = getStackScaffold("api-service", "api");
    expect(scanProjectFiles(files).passed).toBe(true);
    expect(validateGeneratedSecurityPosture(files, "api-service")).toEqual([]);
    expect(files["src/server.ts"]).toContain("helmet");
    expect(files["src/server.ts"]).toContain("rateLimit");
  });
});
