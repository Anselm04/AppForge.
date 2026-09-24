import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  scanProjectFiles,
  validateGeneratedSecurityPosture,
} from "../services/projectSecurityScanner.js";
import { getStackScaffold } from "../services/stackScaffolds.js";

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

  it("keeps the Node service scaffold on the secure baseline", () => {
    const files = getStackScaffold("api-service", "api");
    expect(scanProjectFiles(files).passed).toBe(true);
    expect(validateGeneratedSecurityPosture(files, "api-service")).toEqual([]);
    expect(files["src/server.ts"]).toContain("helmet");
    expect(files["src/server.ts"]).toContain("rateLimit");
  });
});
