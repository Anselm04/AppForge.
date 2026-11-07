#!/usr/bin/env node
/**
 * AppForge exhaustive tracked-source inventory.
 * This identifies candidate launch defects; it does not certify behaviour.
 * Run: npm run audit:launch
 * Run: npm run audit:launch -- --json
 * Run: npm run audit:launch -- --fail-on-blockers
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative, join, extname } from "node:path";

const root = process.cwd();
const excludedDirs = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", ".cache", ".turbo", "vendor"]);
const scanExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".sh", ".yaml", ".yml", ".json", ".html", ".sql", ".dart"]);
const explicitNames = new Set(["Dockerfile", "fly.toml", "Procfile", ".env.example", ".env.production.example"]);
const rules = [
  { id: "customer-build-production-block", severity: "blocker", re: /assertCustomerComputeLaunchCertified|CUSTOMER_COMPUTE_NOT_CERTIFIED/ },
  { id: "commercial-checkout-production-block", severity: "blocker", re: /assertCommercialCheckoutReleased|COMMERCIAL_CHECKOUT_PAUSED/ },
  { id: "pricing-proposal-mode", severity: "blocker", re: /PRICING_PROPOSAL_MODE\s*=\s*true/ },
  { id: "unimplemented-feature", severity: "review", re: /(?:not implemented|requires an authorised|requires a verified persisted|throw new Error\(["'].*(?:integration|adapter))/i },
  { id: "fake-or-demo-data", severity: "review", re: /(?:mock data only|fake success|stub implementation|coming soon|lorem ipsum)/i },
  { id: "hard-disabled-control", severity: "review", re: /\bdisabled\s*=\s*\{\s*(?:true|PRICING_PROPOSAL_MODE)\b/ },
  { id: "unresolved-code-task", severity: "review", re: /\b(?:TODO|FIXME|HACK)\b/ },
  { id: "test-only-production-branch", severity: "review", re: /NODE_ENV\s*===?\s*["'](?:test|development)["']/ },
];
const sourceDirs = new Set(["src", "api", "scripts", "drizzle", "migrations", "functions", "apps", "packages", "server", "client", ".github"]);
const matches = [];
const files = [];
let errors = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirs.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.isFile()) continue;
    const path = relative(root, full).replaceAll("\\", "/");
    const first = path.split("/")[0];
    if (!scanExtensions.has(extname(entry.name)) && !explicitNames.has(entry.name)) continue;
    if (!sourceDirs.has(first) && !explicitNames.has(entry.name) && !["package.json", "tsconfig.json", "vite.config.ts", "vitest.config.ts"].includes(path)) continue;
    files.push(path);
    try {
      const contents = readFileSync(full, "utf8");
      for (const [i, line] of contents.split(/\r?\n/).entries()) {
        for (const rule of rules) {
          if (rule.re.test(line)) {
            matches.push({ id: rule.id, severity: rule.severity, file: path, line: i + 1, text: line.trim().slice(0, 200) });
          }
        }
      }
    } catch (error) { errors.push({ file: path, error: String(error) }); }
  }
}
walk(root);
files.sort();
matches.sort((a,b) => a.file.localeCompare(b.file) || a.line - b.line || a.id.localeCompare(b.id));
const findings = matches.filter(x => !/(?:^|\/)(?:__tests__|__mocks__|tests?|fixtures)(?:\/|$)|\.(?:test|spec)\.[jt]sx?$/.test(x.file));
const report = {
  revision: process.env.GITHUB_SHA || "local-checkout",
  scannedFiles: files.length,
  files,
  findings,
  testAndFixtureMatches: matches.filter(x => !findings.includes(x)),
  readErrors: errors,
  caveat: "Pattern matches need engineering review; production readiness additionally requires full tests, integration verification and real customer acceptance."
};
if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log("AppForge source inventory: " + files.length + " files; " + findings.length + " production-source matches; " + errors.length + " read errors.");
  for (const f of findings) console.log("[" + f.severity + "] " + f.id + " " + f.file + ":" + f.line + " " + f.text);
  console.log(report.caveat);
}
if (errors.length || (process.argv.includes("--fail-on-blockers") && findings.some(f => f.severity === "blocker"))) process.exitCode = 1;
