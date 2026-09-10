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
    severity: "medium",
    message: "dangerouslySetInnerHTML requires trusted or sanitized input.",
    pattern: /dangerouslySetInnerHTML\s*=/,
    paths: /\.(?:jsx|tsx)$/i,
  },
  {
    id: "web.cors-wildcard",
    severity: "medium",
    message: "Wildcard CORS can expose authenticated APIs to untrusted origins.",
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
    message: "Authentication token appears to be placed in a URL or query string.",
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
          severity: "medium",
          path,
          line: 1,
          message: `Dependency ${name} is not version constrained.`,
          evidence: `${name}: ${version}`,
        });
      }
      if (/^(?:git\+|https?:\/\/)/i.test(version)) {
        findings.push({
          ruleId: "dependency.remote-source",
          severity: "medium",
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
