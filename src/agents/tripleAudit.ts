import { logger } from "../_core/logger.js";

// ── Triple Auto-Audit: Accessibility + Security + Performance ──
// Runs against generated file text. No browser or build step needed.
// Integrates into buildValidator.ts and seniorDevAgent.ts validation stage.

export type AuditCategory = "a11y" | "security" | "perf";

export type AuditFinding = {
  category: AuditCategory;
  severity: "critical" | "warning" | "info";
  file: string;
  line?: number;
  rule: string; // e.g. "WCAG-1.1.1", "npm-audit-high", "bundle-oversized"
  message: string;
  fixHint: string;
};

export type TripleAuditResult = {
  a11y: { score: number; max: number; findings: AuditFinding[] };
  security: { score: number; max: number; findings: AuditFinding[] };
  perf: { score: number; max: number; findings: AuditFinding[] };
  overallScore: number; // 0-100
  passed: boolean; // overallScore >= 70 and no critical security
};

// ── WCAG Quick Scanner (static code patterns) ──
function scanA11y(files: Record<string, string>): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const imgWithoutAlt = /<(img|Image)\b[^>]*>(?!.*alt=)/gi;
  const noAriaLabel = /<(button|a|input)\b[^>]*>(?!.*aria-label)(?!.*aria-labelledby)/gi;
  const noFormLabels = /<input\b[^>]*>(?!.*label)/gi;
  const noLangAttr = /<html\b(?!.*lang=)/gi;
  const lowContrastTailwind = /(text-gray-\d00).*(bg-gray-\d00)/gi; // same shade text/bg
  const missingFocus = /:focus-visible|focus:outline/gi; // absence of focus styles

  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith(".tsx") && !path.endsWith(".ts") && !path.endsWith(".jsx")) continue;

    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      if (imgWithoutAlt.test(line)) {
        findings.push({
          category: "a11y",
          severity: "critical",
          file: path,
          line: idx + 1,
          rule: "WCAG-1.1.1",
          message: "Image without alt attribute — screen readers cannot describe it.",
          fixHint: 'Add alt="description" or alt="" for decorative images.',
        });
      }
      if (noAriaLabel.test(line)) {
        findings.push({
          category: "a11y",
          severity: "warning",
          file: path,
          line: idx + 1,
          rule: "WCAG-4.1.2",
          message: "Interactive element missing accessible name.",
          fixHint: "Add aria-label, aria-labelledby, or visible text content.",
        });
      }
      if (noLangAttr.test(line)) {
        findings.push({
          category: "a11y",
          severity: "warning",
          file: path,
          line: idx + 1,
          rule: "WCAG-3.1.1",
          message: "HTML element missing lang attribute.",
          fixHint: 'Add lang="en" (or appropriate language) to <html>.',
        });
      }
      if (lowContrastTailwind.test(line)) {
        findings.push({
          category: "a11y",
          severity: "warning",
          file: path,
          line: idx + 1,
          rule: "WCAG-1.4.3",
          message: "Potential low-contrast color combination detected.",
          fixHint: "Use Tailwind contrast utilities (e.g. text-white on bg-slate-900).",
        });
      }
    });

    // Whole-file checks
    const hasFocusStyles = missingFocus.test(content);
    if (!hasFocusStyles && (path.includes(".css") || path.includes("index.css"))) {
      findings.push({
        category: "a11y",
        severity: "warning",
        file: path,
        rule: "WCAG-2.4.7",
        message: "No keyboard focus styles found in stylesheet.",
        fixHint: "Add :focus-visible { outline: 2px solid ... } styles.",
      });
    }
  }

  return findings;
}

// ── Security Quick Scanner ──
function scanSecurity(files: Record<string, string>): AuditFinding[] {
  const findings: AuditFinding[] = [];

  const secretPatterns = [
    { regex: /sk-[a-zA-Z0-9]{20,}/gi, name: "Stripe secret key leak" },
    { regex: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/gi, name: "JWT token hardcoded" },
    { regex: /password\s*=\s*["'][^"']{4,}["']/gi, name: "Hardcoded password" },
    { regex: /api[_-]?key\s*=\s*["'][^"']{8,}["']/gi, name: "Hardcoded API key" },
    { regex: /AKIA[0-9A-Z]{16}/gi, name: "AWS access key leak" },
  ];

  const unsafePatterns = [
    { regex: /dangerouslySetInnerHTML/gi, name: "dangerouslySetInnerHTML usage" },
    { regex: /eval\s*\(/gi, name: "eval() usage" },
    { regex: /innerHTML\s*=/gi, name: "innerHTML assignment" },
    { regex: /window\.location\.href\s*=\s*[^;]*\+/gi, name: "Unsanitized redirect" },
    { regex: /\.exec\s*\(/gi, name: "Shell exec in frontend" },
  ];

  for (const [path, content] of Object.entries(files)) {
    for (const p of secretPatterns) {
      const matches = content.match(p.regex);
      if (matches) {
        findings.push({
          category: "security",
          severity: "critical",
          file: path,
          rule: "secret-leak",
          message: `${p.name}: ${matches.length} occurrence(s) found in source code.`,
          fixHint: "Move secrets to environment variables. Never commit API keys.",
        });
      }
    }
    for (const p of unsafePatterns) {
      const matches = content.match(p.regex);
      if (matches) {
        findings.push({
          category: "security",
          severity: "critical",
          file: path,
          rule: "unsafe-pattern",
          message: `${p.name}: potential XSS or injection vector.`,
          fixHint: "Use safe alternatives (textContent, sanitized DOM insertion, parameterized queries).",
        });
      }
    }
  }

  // Check for missing security middleware indicators
  const serverFile = files["src/server.ts"] || files["server.ts"];
  if (serverFile) {
    if (!serverFile.includes("helmet")) {
      findings.push({
        category: "security",
        severity: "warning",
        file: "server.ts",
        rule: "missing-helmet",
        message: "Helmet security headers not imported in server file.",
        fixHint: "import helmet from 'helmet' and app.use(helmet()).",
      });
    }
    if (!serverFile.includes("rateLimit") && !serverFile.includes("rate-limit")) {
      findings.push({
        category: "security",
        severity: "warning",
        file: "server.ts",
        rule: "missing-rate-limit",
        message: "No rate limiting found on API routes.",
        fixHint: "Add express-rate-limit to prevent brute force and abuse.",
      });
    }
  }

  return findings;
}

// ── Performance Quick Scanner ──
function scanPerf(files: Record<string, string>): AuditFinding[] {
  const findings: AuditFinding[] = [];

  let totalSize = 0;
  let jsSize = 0;
  let cssSize = 0;
  let imageCount = 0;

  for (const [path, content] of Object.entries(files)) {
    totalSize += content.length;
    if (path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js")) jsSize += content.length;
    if (path.endsWith(".css")) cssSize += content.length;
    if (path.match(/\.(png|jpg|jpeg|gif|svg|webp)/i)) imageCount++;
  }

  // Bundle size estimate (very rough: source chars ~= 1/3 minified bytes)
  const estMinifiedKB = Math.round(jsSize / 3 / 1024);
  if (estMinifiedKB > 500) {
    findings.push({
      category: "perf",
      severity: "warning",
      file: "(overall)",
      rule: "bundle-oversized",
      message: `Estimated JS bundle ~${estMinifiedKB}KB. Likely too large for fast load.`,
      fixHint: "Split with dynamic imports (React.lazy), trim unused deps, use tree-shaking.",
    });
  }

  // Check for missing lazy loading
  const allContent = Object.values(files).join("\n");
  if (!allContent.includes("React.lazy") && !allContent.includes("lazy") && jsSize > 200_000) {
    findings.push({
      category: "perf",
      severity: "warning",
      file: "(overall)",
      rule: "no-code-splitting",
      message: "No code splitting (React.lazy / dynamic imports) found.",
      fixHint: "Lazy load heavy pages/components with React.lazy() and Suspense.",
    });
  }

  // Check for missing compression
  const serverFile = files["src/server.ts"] || files["server.ts"];
  if (serverFile && !serverFile.includes("compression")) {
    findings.push({
      category: "perf",
      severity: "info",
      file: "server.ts",
      rule: "no-compression",
      message: "No gzip/brotli compression middleware found.",
      fixHint: "Add compression() middleware or enable at CDN/reverse proxy level.",
    });
  }

  // Check for unoptimized images
  if (imageCount > 0 && !allContent.includes("next/image") && !allContent.includes("lazyLoad") && !allContent.includes("loading=\"lazy\"")) {
    findings.push({
      category: "perf",
      severity: "warning",
      file: "(overall)",
      rule: "unoptimized-images",
      message: `${imageCount} image(s) without lazy loading or optimization.`,
      fixHint: "Add loading='lazy' to <img>, use WebP where possible, or a CDN image optimizer.",
    });
  }

  return findings;
}

// ── Scoring ──
function scoreCategory(findings: AuditFinding[], maxScore: number): number {
  let score = maxScore;
  for (const f of findings) {
    if (f.severity === "critical") score -= 15;
    if (f.severity === "warning") score -= 7;
    if (f.severity === "info") score -= 2;
  }
  return Math.max(0, score);
}

// ── Main Entry ──
export async function runTripleAudit(
  files: Record<string, string>
): Promise<TripleAuditResult> {
  logger.info({ fileCount: Object.keys(files).length }, "triple_audit_start");

  const a11yFindings = scanA11y(files);
  const securityFindings = scanSecurity(files);
  const perfFindings = scanPerf(files);

  const a11yScore = scoreCategory(a11yFindings, 100);
  const securityScore = scoreCategory(securityFindings, 100);
  const perfScore = scoreCategory(perfFindings, 100);

  const overallScore = Math.round((a11yScore + securityScore + perfScore) / 3);
  const hasCriticalSecurity = securityFindings.some(f => f.severity === "critical");

  const result: TripleAuditResult = {
    a11y: { score: a11yScore, max: 100, findings: a11yFindings },
    security: { score: securityScore, max: 100, findings: securityFindings },
    perf: { score: perfScore, max: 100, findings: perfFindings },
    overallScore,
    passed: overallScore >= 70 && !hasCriticalSecurity,
  };

  logger.info(
    { overallScore, a11y: a11yScore, security: securityScore, perf: perfScore },
    "triple_audit_complete"
  );

  return result;
}

// ── Markdown Report ──
export function auditReportMarkdown(r: TripleAuditResult): string {
  const lines: string[] = [];
  lines.push("## Build Quality Report");
  lines.push("");
  lines.push(`**Overall Score:** ${r.overallScore}/100 ${r.passed ? "✅ PASS" : "❌ FAIL"}`);
  lines.push("");
  lines.push(`- Accessibility: ${r.a11y.score}/100 (${r.a11y.findings.length} findings)`);
  lines.push(`- Security: ${r.security.score}/100 (${r.security.findings.length} findings)`);
  lines.push(`- Performance: ${r.perf.score}/100 (${r.perf.findings.length} findings)`);
  lines.push("");

  const allFindings = [...r.a11y.findings, ...r.security.findings, ...r.perf.findings];
  if (allFindings.length === 0) {
    lines.push("No issues found. Clean build.");
    return lines.join("\n");
  }

  for (const f of allFindings) {
    const icon = f.severity === "critical" ? "🔴" : f.severity === "warning" ? "🟡" : "🟢";
    lines.push(`${icon} **[${f.category.toUpperCase()}]** ${f.rule} — ${f.message}`);
    if (f.file) lines.push(`   File: \`${f.file}\`${f.line ? `:${f.line}` : ""}`);
    lines.push(`   Fix: ${f.fixHint}`);
    lines.push("");
  }

  return lines.join("\n");
}

export default runTripleAudit;