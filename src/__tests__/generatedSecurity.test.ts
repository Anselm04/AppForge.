import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  scanProjectFiles,
  validateGeneratedSecurityPosture,
} from "../services/projectSecurityScanner.js";
import { getStackScaffold } from "../services/stackScaffolds.js";
import type { ProductContract } from "../lib/productContract.js";

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
        "dependency.remote-source",
        "auth.client-controlled-identity",
        "secret.logging",
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

  it("keeps the Node service scaffold on the secure baseline", () => {
    const files = getStackScaffold("api-service", "api");
    expect(scanProjectFiles(files).passed).toBe(true);
    expect(validateGeneratedSecurityPosture(files, "api-service")).toEqual([]);
    expect(files["src/server.ts"]).toContain("helmet");
    expect(files["src/server.ts"]).toContain("rateLimit");
  });
});
