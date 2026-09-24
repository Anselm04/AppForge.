import type { ProductContract } from "../lib/productContract.js";

export type SecuritySeverity = "critical" | "high" | "medium" | "low";

export type ProjectSecurityFinding = {
  ruleId: string;
  severity: SecuritySeverity;
  path: string;
  line: number;
  message: string;
  evidence: string;
};

type SecurityRule = {
  id: string;
  severity: SecuritySeverity;
  message: string;
  pattern: RegExp;
  paths?: RegExp;
};

const RULES: SecurityRule[] = [
  {
    id: "secret.private-key",
    severity: "critical",
    message: "Private key material is present in generated source.",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  },
  {
    id: "secret.stripe-live-key",
    severity: "critical",
    message: "A live Stripe secret appears to be hard-coded.",
    pattern: /\bsk_live_[A-Za-z0-9]{12,}\b/,
  },
  {
    id: "secret.github-token",
    severity: "critical",
    message: "A GitHub access token appears to be hard-coded.",
    pattern: /\b(?:github_pat_[A-Za-z0-9_]{12,}|ghp_[A-Za-z0-9]{20,})\b/,
  },
  {
    id: "secret.aws-access-key",
    severity: "critical",
    message: "An AWS access key ID appears to be hard-coded.",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    id: "secret.openai-key",
    severity: "critical",
    message: "An OpenAI API key appears to be hard-coded.",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: "secret.google-api-key",
    severity: "critical",
    message: "A Google API key appears to be hard-coded.",
    pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/,
  },
  {
    id: "secret.client-service-role",
    severity: "critical",
    message:
      "Server/service credentials must never be exposed in generated browser code.",
    pattern:
      /(?:SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|DATABASE_URL|OPENAI_API_KEY|GITHUB_TOKEN|FLY_API_TOKEN|VERCEL_TOKEN|NETLIFY_AUTH_TOKEN)/i,
    paths:
      /(?:^|\/)(?:public|components|pages|client|frontend|ui)\/.*\.(?:js|jsx|ts|tsx|html)$|(?:^|\/)(?:src\/)?(?:App|main)\.(?:js|jsx|ts|tsx)$/i,
  },
  {
    id: "code.dynamic-eval",
    severity: "high",
    message: "Dynamic eval() can enable code injection.",
    pattern: /\beval\s*\(/,
    paths: /\.(?:js|jsx|ts|tsx|mjs|cjs)$/i,
  },
  {
    id: "code.dynamic-function",
    severity: "high",
    message: "Dynamic Function construction can enable code injection.",
    pattern: /\bnew\s+Function\s*\(/,
    paths: /\.(?:js|jsx|ts|tsx|mjs|cjs)$/i,
  },
  {
    id: "code.shell-exec-interpolation",
    severity: "high",
    message:
      "Shell command execution contains template interpolation and needs strict validation.",
    pattern: /\b(?:exec|execSync)\s*\(\s*\x60[^\x60]*\$\{/,
    paths: /\.(?:js|ts|mjs|cjs)$/i,
  },
  {
    id: "command.shell-enabled",
    severity: "high",
    message:
      "Child process enables shell execution; generated services must use fixed executable/argument arrays.",
    pattern: /(?:spawn|execFile)\s*\([^;\n]+\{[^}]*shell\s*:\s*true/i,
    paths: /\.(?:js|ts|mjs|cjs)$/i,
  },
  {
    id: "sql.string-interpolation",
    severity: "high",
    message:
      "SQL query appears to contain template interpolation; parameterize database input.",
    pattern:
      /(?:query|execute)\s*\(\s*\x60[^\x60]*(?:SELECT|INSERT|UPDATE|DELETE)[^\x60]*\$\{/i,
    paths: /\.(?:js|ts|mjs|cjs)$/i,
  },
  {
    id: "ssrf.untrusted-fetch",
    severity: "high",
    message:
      "Server-side network request appears to use request-controlled input without an allowlist.",
    pattern:
      /(?:fetch|axios\.(?:get|post|put|patch|delete)|new\s+URL)\s*\(\s*(?:req\.(?:body|query|params)|request\.(?:body|query|params)|body\.|query\.|params\.)/i,
    paths: /\.(?:js|ts|mjs|cjs)$/i,
  },
  {
    id: "path.untrusted-file-operation",
    severity: "high",
    message:
      "Filesystem operation appears to use request-controlled input and may permit path traversal.",
    pattern:
      /(?:readFile|writeFile|appendFile|rm|unlink|sendFile|createReadStream|createWriteStream)\s*\([^\n;]*(?:req\.(?:body|query|params)|request\.(?:body|query|params)|body\.|query\.|params\.)/i,
    paths: /\.(?:js|ts|mjs|cjs)$/i,
  },
  {
    id: "web.dangerous-html",
    severity: "high",
    message: "dangerouslySetInnerHTML requires trusted and sanitized input.",
    pattern: /dangerouslySetInnerHTML\s*=/,
    paths: /\.(?:jsx|tsx)$/i,
  },
  {
    id: "web.inner-html-assignment",
    severity: "high",
    message:
      "Direct innerHTML assignment can enable XSS; render text safely or sanitize trusted HTML.",
    pattern: /\.innerHTML\s*=\s*(?!["'\x60][^"'\x60]*["'\x60])/i,
    paths: /\.(?:js|jsx|ts|tsx|mjs|cjs)$/i,
  },
  {
    id: "web.open-redirect",
    severity: "high",
    message:
      "Redirect target appears to come directly from request-controlled input.",
    pattern:
      /(?:res\.redirect|redirect)\s*\(\s*(?:req\.(?:body|query|params)|request\.(?:body|query|params)|body\.|query\.|params\.)/i,
    paths: /\.(?:js|ts|mjs|cjs)$/i,
  },
  {
    id: "web.cors-wildcard",
    severity: "high",
    message:
      "Wildcard CORS is not allowed for generated authenticated/server applications.",
    pattern:
      /(?:origin\s*:\s*["']\*["']|Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*)/i,
    paths: /\.(?:js|ts|mjs|cjs|json)$/i,
  },
  {
    id: "auth.token-in-url",
    severity: "high",
    message:
      "Authentication token appears to be placed in a URL or query string.",
    pattern:
      /(?:\?|&)(?:token|access_token|jwt|api_key)=\$?\{?[A-Za-z0-9_.-]+/i,
    paths: /\.(?:js|jsx|ts|tsx|mjs|cjs)$/i,
  },
  {
    id: "auth.client-controlled-identity",
    severity: "high",
    message:
      "Authorization identity appears to be accepted directly from request-controlled user/tenant fields.",
    pattern:
      /(?:const|let|var)\s+(?:userId|tenantId|organizationId|orgId)\s*=\s*(?:req\.(?:body|query|params)|request\.(?:body|query|params)|body\.|query\.|params\.)/i,
    paths: /\.(?:js|ts|mjs|cjs)$/i,
  },
  {
    id: "auth.insecure-cookie",
    severity: "high",
    message:
      "Authentication/session cookie is missing HttpOnly, Secure, or SameSite protections.",
    pattern:
      /(?:res\.)?cookie\s*\([^;\n]+\{(?!(?=[^}]*httpOnly\s*:\s*true)(?=[^}]*sameSite\s*:\s*["'](?:strict|lax)["'])(?=[^}]*secure\s*:\s*(?:true|process\.env\.NODE_ENV\s*===\s*["']production["']))[^}]*\})/i,
    paths: /\.(?:js|ts|mjs|cjs)$/i,
  },
  {
    id: "secret.logging",
    severity: "high",
    message:
      "Generated code logs a sensitive environment value; secrets must never be written to logs.",
    pattern:
      /console\.(?:log|info|warn|error|debug)\s*\([^\n;]*process\.env(?:\.|\[)[^\n;]*(?:SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY|AUTH|DATABASE_URL)/i,
    paths: /\.(?:js|ts|mjs|cjs)$/i,
  },
  {
    id: "code.python-dynamic-exec",
    severity: "high",
    message: "Python eval()/exec() can enable code injection.",
    pattern: /\b(?:eval|exec)\s*\(/,
    paths: /\.py$/i,
  },
  {
    id: "command.python-shell",
    severity: "high",
    message:
      "Python shell execution is unsafe; use fixed executable and argument arrays.",
    pattern:
      /(?:\bos\.system\s*\(|\bsubprocess\.(?:run|Popen|call|check_call|check_output)\s*\([^)]*shell\s*=\s*True)/i,
    paths: /\.py$/i,
  },
  {
    id: "ssrf.python-untrusted-request",
    severity: "high",
    message:
      "Python server-side network request appears to use request-controlled input without an allowlist.",
    pattern:
      /(?:requests|httpx)\.(?:get|post|put|patch|delete)\s*\([^\n]*(?:request\.(?:args|form|json|query_params|path_params)|query_params|path_params)/i,
    paths: /\.py$/i,
  },
  {
    id: "path.python-untrusted-file-operation",
    severity: "high",
    message:
      "Python file operation appears to use request-controlled input and may permit path traversal.",
    pattern:
      /(?:\bopen|Path|send_file|FileResponse)\s*\([^\n]*(?:request\.(?:args|form|json|query_params|path_params)|query_params|path_params)/i,
    paths: /\.py$/i,
  },
  {
    id: "sql.python-interpolation",
    severity: "high",
    message:
      "Python SQL execution appears to interpolate values into SQL; use bound parameters.",
    pattern:
      /(?:execute|executemany)\s*\(\s*f["'][^"']*(?:SELECT|INSERT|UPDATE|DELETE)[^"']*\{/i,
    paths: /\.py$/i,
  },
  {
    id: "web.python-open-redirect",
    severity: "high",
    message:
      "Python redirect target appears to come directly from request-controlled input.",
    pattern:
      /(?:RedirectResponse|redirect)\s*\([^\n]*(?:request\.(?:args|form|json|query_params|path_params)|query_params|path_params)/i,
    paths: /\.py$/i,
  },
  {
    id: "web.python-unsafe-html",
    severity: "high",
    message:
      "Python HTML rendering appears to mark request-controlled content as trusted.",
    pattern:
      /(?:Markup|mark_safe|render_template_string)\s*\([^\n]*(?:request\.(?:args|form|json|query_params|path_params)|query_params|path_params)/i,
    paths: /\.py$/i,
  },
  {
    id: "auth.python-client-controlled-identity",
    severity: "high",
    message:
      "Python authorization identity appears to be accepted directly from request-controlled fields.",
    pattern:
      /(?:user_id|tenant_id|organization_id|org_id)\s*=\s*(?:request\.(?:args|form|json|query_params|path_params)|query_params|path_params)/i,
    paths: /\.py$/i,
  },
  {
    id: "python.secret-logging",
    severity: "high",
    message:
      "Python generated code logs a secret-bearing environment variable.",
    pattern:
      /(?:print|logger\.(?:debug|info|warning|error|critical))\s*\([^\n]*(?:os\.(?:getenv|environ)[^\n]*(?:SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY|DATABASE_URL|AUTH))/i,
    paths: /\.py$/i,
  },
  {
    id: "python.insecure-cookie",
    severity: "high",
    message:
      "Python authentication/session cookie is missing Secure, HttpOnly, or SameSite protection.",
    pattern:
      /set_cookie\s*\([^\n]*(?!(?:[^\n]*httponly\s*=\s*True)(?:[^\n]*secure\s*=\s*True)(?:[^\n]*samesite\s*=\s*["'](?:lax|strict)["']))/i,
    paths: /\.py$/i,
  },
  {
    id: "dependency.install-script",
    severity: "high",
    message:
      "Generated package lifecycle scripts may execute arbitrary commands during dependency installation.",
    pattern: /"(?:preinstall|install|postinstall)"\s*:\s*"[^"]+"/i,
    paths: /(?:^|\/)package\.json$/i,
  },
  {
    id: "crypto.weak-hash",
    severity: "medium",
    message: "MD5 or SHA-1 should not be used for security-sensitive hashing.",
    pattern: /createHash\s*\(\s*["'](?:md5|sha1)["']\s*\)/i,
    paths: /\.(?:js|ts|mjs|cjs)$/i,
  },
];

const SKIP_PATHS =
  /(?:^|\/)(?:node_modules|dist|build|coverage|\.git)(?:\/|$)/i;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FINDINGS = 250;

function lineNumberAt(content: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (content.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function evidenceAround(content: string, offset: number): string {
  const lineStart = content.lastIndexOf("\n", offset) + 1;
  const nextLine = content.indexOf("\n", offset);
  const lineEnd = nextLine === -1 ? content.length : nextLine;
  return content
    .slice(lineStart, lineEnd)
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 240);
}

function makeFinding(
  ruleId: string,
  severity: SecuritySeverity,
  path: string,
  message: string,
  evidence: string,
  line = 1,
): ProjectSecurityFinding {
  return {
    ruleId,
    severity,
    path,
    line,
    message,
    evidence: evidence.slice(0, 240),
  };
}

function scanEnvironmentSecrets(
  path: string,
  content: string,
): ProjectSecurityFinding[] {
  const normalized = path.replace(/\\/g, "/");
  if (
    !/(?:^|\/)\.env(?:\.[A-Za-z0-9_-]+)?$/i.test(normalized) ||
    /\.(?:example|sample|template)$/i.test(normalized)
  ) {
    return [];
  }

  const findings: ProjectSecurityFinding[] = [];
  content.split(/\r?\n/).forEach((raw, index) => {
    const match = raw.match(
      /^\s*([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|SERVICE_ROLE|API_KEY|DATABASE_URL)[A-Z0-9_]*)\s*=\s*(.+?)\s*$/i,
    );
    if (!match) return;
    const value = match[2].replace(/^["']|["']$/g, "").trim();
    if (
      !value ||
      /^\$\{[^}]+\}$/.test(value) ||
      /^(?:changeme|replace-me|example|placeholder|your[-_].+|<.+>)$/i.test(
        value,
      )
    ) {
      return;
    }
    findings.push(
      makeFinding(
        "secret.env-artifact",
        "critical",
        path,
        "Generated artifact contains a non-placeholder secret-bearing .env value.",
        match[1] + "=<redacted>",
        index + 1,
      ),
    );
  });
  return findings;
}

function scanDependencies(
  path: string,
  content: string,
): ProjectSecurityFinding[] {
  const findings: ProjectSecurityFinding[] = [];

  if (/(?:^|\/)package\.json$/i.test(path)) {
    try {
      const manifest = JSON.parse(content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };
      for (const [name, version] of Object.entries({
        ...(manifest.dependencies ?? {}),
        ...(manifest.devDependencies ?? {}),
      })) {
        if (version === "*" || /^latest$/i.test(version)) {
          findings.push(
            makeFinding(
              "dependency.unpinned",
              "high",
              path,
              "Dependency " + name + " is not version constrained.",
              name + ": " + version,
            ),
          );
        }
        if (/^(?:git\+|https?:\/\/|file:|link:)/i.test(version)) {
          findings.push(
            makeFinding(
              "dependency.unsafe-source",
              "high",
              path,
              "Dependency " +
                name +
                " uses a direct/local source instead of a registry version.",
              name + ": " + version,
            ),
          );
        }
        if (
          name === "flatmap-stream" ||
          (name === "event-stream" &&
            /(?:^|[^\d])3\.3\.6(?:[^\d]|$)/.test(version))
        ) {
          findings.push(
            makeFinding(
              "dependency.known-malicious",
              "critical",
              path,
              "Dependency " +
                name +
                " matches a known malicious package/version and is blocked.",
              name + ": " + version,
            ),
          );
        }
      }

      for (const [scriptName, script] of Object.entries(
        manifest.scripts ?? {},
      )) {
        if (
          /(?:^|[;&|])\s*(?:curl|wget|nc|netcat|ssh|scp|sudo|chmod|chown|mkfifo|mount|umount)\b|\$\(|\x60/i.test(
            script,
          )
        ) {
          findings.push(
            makeFinding(
              "dependency.unsafe-script",
              "high",
              path,
              "Generated package script contains a dangerous shell/network primitive.",
              scriptName + ": " + script,
            ),
          );
        }
      }
    } catch {
      findings.push(
        makeFinding(
          "dependency.invalid-manifest",
          "high",
          path,
          "package.json could not be parsed.",
          "Invalid JSON",
        ),
      );
    }
    return findings;
  }

  if (/(?:^|\/)requirements(?:-[^/]+)?\.txt$/i.test(path)) {
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      if (
        /^(?:-e\s+|--editable\s+|--(?:extra-)?index-url\b|git\+|https?:\/\/|file:|svn\+|hg\+|\.\.?\/)/i.test(
          line,
        )
      ) {
        findings.push(
          makeFinding(
            "dependency.python-unsafe-source",
            "high",
            path,
            "Python dependency uses an editable, alternate-index, remote, VCS, or local source.",
            line,
          ),
        );
      }
    }
    return findings;
  }

  if (/(?:^|\/)pubspec\.ya?ml$/i.test(path)) {
    if (/^\s*(?:git|path)\s*:/im.test(content)) {
      findings.push(
        makeFinding(
          "dependency.dart-unsafe-source",
          "high",
          path,
          "Dart/Flutter dependency uses a git or local path source.",
          "git/path dependency source",
        ),
      );
    }
  }

  return findings;
}

export function scanProjectFiles(
  files: Record<string, string>,
): {
  findings: ProjectSecurityFinding[];
  scannedFiles: number;
  skippedFiles: number;
  severityCounts: Record<SecuritySeverity, number>;
  passed: boolean;
} {
  const findings: ProjectSecurityFinding[] = [];
  let scannedFiles = 0;
  let skippedFiles = 0;

  for (const [path, content] of Object.entries(files)) {
    if (SKIP_PATHS.test(path) || path.endsWith(".pdf.base64")) {
      skippedFiles += 1;
      continue;
    }
    if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
      findings.push(
        makeFinding(
          "security.unscanned-oversize-file",
          "high",
          path,
          "Generated file exceeds the security scanner per-file limit and cannot be accepted unscanned.",
          "file size > " + MAX_FILE_BYTES,
        ),
      );
      continue;
    }

    scannedFiles += 1;
    findings.push(...scanEnvironmentSecrets(path, content));
    findings.push(...scanDependencies(path, content));

    for (const rule of RULES) {
      if (rule.paths && !rule.paths.test(path)) continue;
      const flags = rule.pattern.flags.includes("g")
        ? rule.pattern.flags
        : rule.pattern.flags + "g";
      const matcher = new RegExp(rule.pattern.source, flags);
      let match: RegExpExecArray | null;
      while ((match = matcher.exec(content)) !== null) {
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          path,
          line: lineNumberAt(content, match.index),
          message: rule.message,
          evidence: evidenceAround(content, match.index),
        });
        if (findings.length >= MAX_FINDINGS) break;
        if (match[0].length === 0) matcher.lastIndex += 1;
      }
      if (findings.length >= MAX_FINDINGS) break;
    }
    if (findings.length >= MAX_FINDINGS) break;
  }

  const severityCounts: Record<SecuritySeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const item of findings) severityCounts[item.severity] += 1;

  return {
    findings,
    scannedFiles,
    skippedFiles,
    severityCounts,
    passed: severityCounts.critical === 0 && severityCounts.high === 0,
  };
}

export function validateGeneratedSecurityPosture(
  files: Record<string, string>,
  techStack: string,
  productContract?: ProductContract,
): ProjectSecurityFinding[] {
  const findings: ProjectSecurityFinding[] = [];
  const source = Object.entries(files)
    .filter(([path]) => /\.(?:[cm]?[jt]sx?|py|sql)$/i.test(path))
    .map(([, file]) => file)
    .join("\n");

  const isNodeService = [
    "api-service",
    "node-service",
    "ai-agent-node",
    "browser-automation",
  ].includes(techStack);
  const isPythonService = [
    "python-service",
    "ai-agent-python",
  ].includes(techStack);
  const isHttpService = isNodeService || isPythonService;

  const add = (ruleId: string, message: string, evidence: string) => {
    findings.push(
      makeFinding(
        ruleId,
        "high",
        "appforge.security",
        message,
        evidence,
      ),
    );
  };

  if (isHttpService) {
    if (
      !/(?:helmet\s*\(|Content-Security-Policy|X-Content-Type-Options|contentSecurityPolicy|X-Frame-Options|Referrer-Policy)/i.test(
        source,
      )
    ) {
      add(
        "service.secure-headers",
        "Generated HTTP service must configure secure default response headers.",
        "No Helmet or equivalent secure-header policy detected.",
      );
    }
    if (
      !/(?:express-rate-limit|rateLimit\s*\(|createRateLimiter|rateLimiter|slowapi|Limiter\s*\()/i.test(
        source,
      )
    ) {
      add(
        "service.rate-limiting",
        "Generated HTTP service must enforce server-side rate limiting.",
        "No rate-limiting middleware detected.",
      );
    }
    if (
      !/(?:express\.json\s*\(\s*\{[^}]*limit\s*:|MAX_BODY_BYTES|content-length|max_request_size|client_max_body_size)/i.test(
        source,
      )
    ) {
      add(
        "service.abuse-controls",
        "Generated HTTP services must enforce bounded request payloads in addition to rate limiting.",
        "No explicit request body/payload size boundary was detected.",
      );
    }
  }

  const usesCookies =
    /(?:res\.)?cookie\s*\(|set-cookie|cookies\(\)|\.set_cookie\s*\(/i.test(
      source,
    );
  const hasSecureCookieDefaults =
    /(?:(?:httpOnly|httponly)\s*[:=]\s*(?:true|True))(?=[\s\S]{0,400}(?:sameSite|samesite)\s*[:=]\s*["'](?:strict|lax)["'])(?=[\s\S]{0,400}secure\s*[:=]\s*(?:true|True|process\.env\.NODE_ENV\s*===\s*["']production["']))|(?:secure\s*[:=]\s*(?:true|True))(?=[\s\S]{0,400}(?:httpOnly|httponly)\s*[:=]\s*(?:true|True))(?=[\s\S]{0,400}(?:sameSite|samesite)\s*[:=]\s*["'](?:strict|lax)["'])/i.test(
      source,
    );
  if (usesCookies && !hasSecureCookieDefaults) {
    add(
      "auth.insecure-cookie-defaults",
      "Authentication/session cookies must be Secure, HttpOnly, and SameSite=Lax/Strict.",
      "Cookie usage detected without all required cookie protections.",
    );
  }

  const mutatesState =
    /\.(?:post|put|patch|delete)\s*\(|export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\b|@(?:app|router)\.(?:post|put|patch|delete)\s*\(/i.test(
      source,
    );
  if (
    usesCookies &&
    mutatesState &&
    !/(?:csrf|xsrf|same-origin|same origin|origin\s*check|verifyOrigin|allowedOrigins)/i.test(
      source,
    )
  ) {
    add(
      "web.csrf-protection",
      "Cookie-authenticated state-changing routes must include CSRF or strict same-origin protection.",
      "Cookies and mutating HTTP routes detected without CSRF/same-origin enforcement.",
    );
  }

  const uploadSurface =
    /(?:multer|formidable|busboy|fileUpload|upload\.single|upload\.array|UploadFile|File\s*\()/i.test(
      source,
    );
  if (
    uploadSurface &&
    !/(?:fileSize|limits\s*:|mimetype|mime|allowedTypes|content-type|maxFileSize|max_file_size|content_type)/i.test(
      source,
    )
  ) {
    add(
      "upload.unbounded",
      "Generated file-upload handlers must enforce size and type restrictions.",
      "Upload handling detected without visible size/type validation.",
    );
  }

  const aiToolSurface =
    /(?:tools\s*:|toolDefinitions|executeTool|functionCalling|tool_calls|invoke_tool|execute_tool)/i.test(
      source,
    );
  if (
    aiToolSurface &&
    !/(?:allowedTools|toolAllowlist|toolPermissions|requiresApproval|humanApproval|permission|allowed_tools|requires_approval|human_approval)/i.test(
      source,
    )
  ) {
    add(
      "ai.unrestricted-tools",
      "Generated AI tools must use explicit permissions/allowlists or human approval boundaries.",
      "AI tool execution detected without a permission boundary.",
    );
  }

  const capabilities = new Set(productContract?.secondaryCapabilities ?? []);
  const securityText = [
    ...(productContract?.securityRequirements ?? []),
    ...(productContract?.functionalRequirements
      ?.filter((item) => item.category === "security")
      .map((item) => item.text) ?? []),
  ]
    .join("\n")
    .toLowerCase();

  const authRequired =
    capabilities.has("authentication") ||
    /\b(auth|authentication|login|session|oauth|sso|jwt|access control)\b/i.test(
      securityText,
    );
  const authEvidence =
    /(?:authenticate|requireAuth|authMiddleware|verifyToken|verifyJwt|jwt\.verify|supabase\.auth\.getUser|session\.(?:user|account)|getServerSession|currentUser|current_user|Depends\s*\(\s*(?:get_current_user|require_auth)|request\.state\.user|auth\.uid\(\))/i.test(
      source,
    );
  if (authRequired && !authEvidence) {
    add(
      "auth.missing-server-enforcement",
      "Products requiring authentication must enforce identity on the server/database boundary, not only in client UI.",
      "Authentication is required by the canonical product contract but no server/database auth enforcement was detected.",
    );
  }

  const tenantRequired =
    capabilities.has("teams") ||
    (productContract?.userRoles?.length ?? 0) > 1 ||
    /\b(tenant|organization|organisation|workspace|ownership|role[- ]based|rbac)\b/i.test(
      securityText,
    );
  const tenantEvidence =
    /(?:req\.user\.(?:tenantId|organizationId|orgId|workspaceId|id)|current_user\.(?:tenant_id|organization_id|org_id|workspace_id|id)|request\.state\.user|membership|requireRole|hasRole|row level security|\bRLS\b|auth\.uid\(\)|owner_id\s*=\s*auth\.uid\(\))/i.test(
      source,
    );
  if (tenantRequired && !tenantEvidence) {
    add(
      "tenant.missing-isolation",
      "Multi-user/team products must enforce ownership, membership, role, or tenant isolation in server/database logic.",
      "Tenant/team/role boundaries are required by the canonical product contract but no authenticated isolation enforcement was detected.",
    );
  }

  if (
    capabilities.has("administration") &&
    !/(?:requireAdmin|isAdmin|req\.user\.role\s*===?\s*["']admin["']|current_user\.role\s*==\s*["']admin["']|hasRole\s*\([^)]*admin|adminOnly|authorize\s*\([^)]*admin|require_role\s*\([^)]*admin)/i.test(
      source,
    )
  ) {
    add(
      "auth.missing-admin-separation",
      "Administrative functionality must be protected by explicit server-side authorization.",
      "Administration is required by the canonical product contract but no explicit admin authorization boundary was detected.",
    );
  }

  return findings;
}
