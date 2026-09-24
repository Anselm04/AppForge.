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
    id: "code.dynamic-eval",
    severity: "high",
    message: "Dynamic code execution with eval() can enable code injection.",
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
    pattern: /\b(?:exec|execSync)\s*\(\s*`[^`]*\$\{/,
    paths: /\.(?:js|ts|mjs|cjs)$/i,
  },
  {
    id: "web.dangerous-html",
    severity: "high",
    message: "dangerouslySetInnerHTML requires trusted or sanitized input.",
    pattern: /dangerouslySetInnerHTML\s*=/,
    paths: /\.(?:jsx|tsx)$/i,
  },
  {
    id: "web.cors-wildcard",
    severity: "medium",
    message:
      "Wildcard CORS can expose authenticated APIs to untrusted origins.",
    pattern:
      /(?:origin\s*:\s*["']\*["']|Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*)/i,
    paths: /\.(?:js|ts|mjs|cjs|json)$/i,
  },
  {
    id: "crypto.weak-hash",
    severity: "medium",
    message: "MD5 or SHA-1 should not be used for security-sensitive hashing.",
    pattern: /createHash\s*\(\s*["'](?:md5|sha1)["']\s*\)/i,
    paths: /\.(?:js|ts|mjs|cjs)$/i,
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
    id: "sql.string-interpolation",
    severity: "high",
    message:
      "SQL query appears to contain template interpolation; parameterize database input.",
    pattern:
      /(?:query|execute)\s*\(\s*`[^`]*(?:SELECT|INSERT|UPDATE|DELETE)[^`]*\$\{/i,
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
    id: "command.shell-enabled",
    severity: "high",
    message:
      "Child process enables shell execution; generated services must use fixed executable/argument arrays.",
    pattern: /(?:spawn|execFile)\s*\([^;\n]+\{[^}]*shell\s*:\s*true/i,
    paths: /\.(?:js|ts|mjs|cjs)$/i,
  },
  {
    id: "web.inner-html-assignment",
    severity: "high",
    message:
      "Direct innerHTML assignment can enable XSS; render text safely or sanitize trusted HTML.",
    pattern: /\.innerHTML\s*=\s*(?!["'`][^"'`]*["'`])/i,
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
    id: "secret.logging",
    severity: "high",
    message:
      "Generated code logs a sensitive environment value; secrets must never be written to logs.",
    pattern:
      /console\.(?:log|info|warn|error|debug)\s*\([^\n;]*(?:process\.env\.(?:[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY|AUTH)[A-Z0-9_]*)|os\.getenv\s*\(\s*["'][^"']*(?:SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY|AUTH)[^"']*["'])/i,
    paths: /\.(?:js|ts|mjs|cjs|py)$/i,
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
      "Authentication/session cookie is missing secure HttpOnly/SameSite protections.",
    pattern:
      /(?:res\.)?cookie\s*\([^;\n]+\{(?!(?=[^}]*httpOnly\s*:\s*true)(?=[^}]*sameSite\s*:\s*["'](?:strict|lax)["'])[^}]*\})/i,
    paths: /\.(?:js|ts|mjs|cjs)$/i,
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
    id: "secret.client-service-role",
    severity: "critical",
    message:
      "Server/service credentials must never be exposed in generated browser code.",
    pattern:
      /(?:SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|DATABASE_URL|OPENAI_API_KEY|GITHUB_TOKEN|FLY_API_TOKEN)/i,
    paths: /(?:^|\/)(?:src|app|pages|components|public)\/.*\.(?:js|jsx|ts|tsx|html)$/i,
  },
  {
    id: "secret.logged-env",
    severity: "high",
    message:
      "Generated code appears to log a secret-bearing environment variable.",
    pattern:
      /console\.(?:log|info|warn|error)\s*\([^\n;]*(?:process\.env\.(?:[A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD|DATABASE_URL))|process\.env\[[\"'][A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD|DATABASE_URL)[\"']\])/i,
    paths: /\.(?:js|jsx|ts|tsx|mjs|cjs)$/i,
  },
];

const SKIP_PATHS =
  /(?:^|\/)(?:node_modules|dist|build|coverage|\.git)(?:\/|$)/i;
const MAX_FILE_BYTES = 750_000;
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

function scanDependencyManifest(
  path: string,
  content: string,
): ProjectSecurityFinding[] {
  if (!/(?:^|\/)package\.json$/i.test(path)) return [];

  try {
    const manifest = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const findings: ProjectSecurityFinding[] = [];
    for (const [name, version] of Object.entries({
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
    })) {
      if (version === "*" || /^latest$/i.test(version)) {
        findings.push({
          ruleId: "dependency.unpinned",
          severity: "high",
          path,
          line: 1,
          message: `Dependency ${name} is not version constrained.`,
          evidence: `${name}: ${version}`,
        });
      }
      if (/^(?:git\+|https?:\/\/)/i.test(version)) {
        findings.push({
          ruleId: "dependency.remote-source",
          severity: "high",
          path,
          line: 1,
          message: `Dependency ${name} installs directly from a remote source.`,
          evidence: `${name}: ${version}`.slice(0, 240),
        });
      }
    }
    return findings;
  } catch {
    return [
      {
        ruleId: "dependency.invalid-manifest",
        severity: "high",
        path,
        line: 1,
        message: "package.json could not be parsed.",
        evidence: "Invalid JSON",
      },
    ];
  }
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
    if (
      SKIP_PATHS.test(path) ||
      Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES ||
      path.endsWith(".pdf.base64")
    ) {
      skippedFiles += 1;
      continue;
    }

    scannedFiles += 1;
    findings.push(...scanDependencyManifest(path, content));

    for (const rule of RULES) {
      if (rule.paths && !rule.paths.test(path)) continue;
      const flags = rule.pattern.flags.includes("g")
        ? rule.pattern.flags
        : `${rule.pattern.flags}g`;
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
  for (const finding of findings) severityCounts[finding.severity] += 1;

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
    .filter(([path]) => /\.(?:[cm]?[jt]sx?|py)$/i.test(path))
    .map(([, content]) => content)
    .join("\n");
  const isNodeService = [
    "api-service",
    "node-service",
    "ai-agent-node",
    "browser-automation",
  ].includes(techStack);

  const add = (ruleId: string, message: string, evidence: string) => {
    findings.push({
      ruleId,
      severity: "high",
      path: "appforge.security",
      line: 1,
      message,
      evidence,
    });
  };

  if (isNodeService) {
    if (!/(?:helmet\s*\(|Content-Security-Policy|X-Content-Type-Options|contentSecurityPolicy)/i.test(source)) {
      add(
        "service.secure-headers",
        "Generated HTTP service must configure secure default response headers.",
        "No Helmet or equivalent secure-header policy detected.",
      );
    }
    if (!/(?:express-rate-limit|rateLimit\s*\(|createRateLimiter|rateLimiter)/i.test(source)) {
      add(
        "service.rate-limiting",
        "Generated HTTP service must enforce server-side rate limiting.",
        "No rate-limiting middleware detected.",
      );
    }
  }

  const usesCookies = /(?:res\.)?cookie\s*\(|set-cookie|cookies\(\)/i.test(source);
  const mutatesState = /\.(?:post|put|patch|delete)\s*\(|export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\b/i.test(source);
  if (usesCookies && mutatesState && !/(?:csrf|xsrf|same-origin|origin\s*check)/i.test(source)) {
    add(
      "web.csrf-protection",
      "Cookie-authenticated state-changing routes must include CSRF or strict same-origin protection.",
      "Cookies and mutating HTTP routes detected without CSRF/same-origin enforcement.",
    );
  }

  const uploadSurface = /(?:multer|formidable|busboy|fileUpload|upload\.single|upload\.array)/i.test(source);
  if (
    uploadSurface &&
    !/(?:fileSize|limits\s*:|mimetype|mime|allowedTypes|content-type|maxFileSize)/i.test(source)
  ) {
    add(
      "upload.unbounded",
      "Generated file-upload handlers must enforce size and type restrictions.",
      "Upload handling detected without visible size/type validation.",
    );
  }

  const aiToolSurface = /(?:tools\s*:|toolDefinitions|executeTool|functionCalling|tool_calls)/i.test(source);
  if (
    aiToolSurface &&
    !/(?:allowedTools|toolAllowlist|toolPermissions|requiresApproval|humanApproval|permission)/i.test(source)
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
  if (
    authRequired &&
    !/(?:authenticate|requireAuth|authMiddleware|verifyToken|verifyJwt|jwt\.verify|supabase\.auth\.getUser|session\.(?:user|account)|getServerSession|currentUser)/i.test(
      source,
    )
  ) {
    add(
      "auth.missing-server-enforcement",
      "Products requiring authentication must enforce identity on the server, not only in client UI.",
      "Authentication is required by the canonical product contract but no server-side auth enforcement was detected.",
    );
  }

  const tenantRequired =
    capabilities.has("teams") ||
    (productContract?.userRoles?.length ?? 0) > 1 ||
    /\b(tenant|organization|organisation|workspace|ownership|role[- ]based|rbac)\b/i.test(
      securityText,
    );
  if (
    tenantRequired &&
    !/(?:tenantId|tenant_id|organizationId|organization_id|workspaceId|workspace_id|ownerId|owner_id|userId|user_id|membership|role\s*===|hasRole|requireRole|row level security|\bRLS\b|auth\.uid\(\))/i.test(
      source,
    )
  ) {
    add(
      "tenant.missing-isolation",
      "Multi-user/team products must enforce ownership, membership, role, or tenant isolation in server/database logic.",
      "Tenant/team/role boundaries are required by the canonical product contract but no isolation enforcement was detected.",
    );
  }

  if (
    capabilities.has("administration") &&
    !/(?:requireAdmin|isAdmin|role\s*===\s*[\"']admin[\"']|hasRole\s*\([^)]*admin|adminOnly|authorize\s*\([^)]*admin)/i.test(
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
