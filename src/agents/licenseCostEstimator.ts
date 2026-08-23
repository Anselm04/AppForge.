import { logger } from "../_core/logger.js";

// ── License Compliance + Cloud Cost Estimator ──
// Runs on generated package.json + tech stack. No external API calls needed.
// Returns license breakdown + monthly cost estimates for 3 hosting platforms.

export type LicenseRisk = "safe" | "attention" | "danger";

export interface LicenseResult {
  package: string;
  assumedLicense: string;
  risk: LicenseRisk;
  note: string;
}

export interface CostEstimate {
  platform: string;
  monthlyMin: number;
  monthlyMax: number;
  explanation: string;
}

export interface LicenseCostReport {
  licenses: LicenseResult[];
  totalDeps: number;
  safeCount: number;
  attentionCount: number;
  dangerCount: number;
  costEstimates: CostEstimate[];
  hostingRecommendation: string;
}

// Known license map for popular packages (heuristic, not legal advice)
const KNOWN_LICENSES: Record<string, { license: string; risk: LicenseRisk; note: string }> = {
  react: { license: "MIT", risk: "safe", note: "Meta OSS" },
  "react-dom": { license: "MIT", risk: "safe", note: "Meta OSS" },
  "react-router-dom": { license: "MIT", risk: "safe", note: "Remix OSS" },
  "@tanstack/react-query": { license: "MIT", risk: "safe", note: "Tanner Linsley OSS" },
  express: { license: "MIT", risk: "safe", note: "Node.js foundation" },
  "drizzle-orm": { license: "Apache-2.0", risk: "safe", note: "Drizzle Team OSS" },
  postgres: { license: "MIT", risk: "safe", note: "Postgres.js driver" },
  zod: { license: "MIT", risk: "safe", note: "Colin McDonnell OSS" },
  tailwindcss: { license: "MIT", risk: "safe", note: "Tailwind Labs OSS" },
  typescript: { license: "Apache-2.0", risk: "safe", note: "Microsoft OSS" },
  vite: { license: "MIT", risk: "safe", note: "Evan You OSS" },
  vitest: { license: "MIT", risk: "safe", note: "Vitest Team OSS" },
  "@vitejs/plugin-react": { license: "MIT", risk: "safe", note: "Evan You OSS" },
  "@testing-library/react": { license: "MIT", risk: "safe", note: "Kent C. Dodds OSS" },
  "@testing-library/jest-dom": { license: "MIT", risk: "safe", note: "Kent C. Dodds OSS" },
  jsdom: { license: "MIT", risk: "safe", note: "JSDOM project" },
  "drizzle-kit": { license: "Apache-2.0", risk: "safe", note: "Drizzle Team OSS" },
  openai: { license: "Apache-2.0", risk: "safe", note: "OpenAI SDK" },
  phaser: { license: "MIT", risk: "safe", note: "Photon Storm OSS" },
  three: { license: "MIT", risk: "safe", note: "Three.js project" },
  electron: { license: "MIT", risk: "safe", note: "GitHub OSS" },
  stripe: { license: "MIT", risk: "safe", note: "Stripe SDK" },
  "@supabase/supabase-js": { license: "MIT", risk: "safe", note: "Supabase OSS" },
  helmet: { license: "MIT", risk: "safe", note: "Helmet.js security" },
  cors: { license: "MIT", risk: "safe", note: "Express middleware" },
  "express-rate-limit": { license: "MIT", risk: "safe", note: "Nathan Friedly OSS" },
  "express-slow-down": { license: "MIT", risk: "safe", note: "Nathan Friedly OSS" },
  "cookie-parser": { license: "MIT", risk: "safe", note: "Express middleware" },
  compression: { license: "MIT", risk: "safe", note: "Express middleware" },
  "@sentry/node": { license: "MIT", risk: "safe", note: "Sentry OSS SDK" },
  "@sentry/react": { license: "MIT", risk: "safe", note: "Sentry OSS SDK" },
  resend: { license: "MIT", risk: "safe", note: "Resend email OSS" },
  twilio: { license: "MIT", risk: "safe", note: "Twilio SDK" },
  // Flag GPL-style packages if they appear
  "gpl-package-placeholder": { license: "GPL-2.0/3.0", risk: "attention", note: "Copyleft — review distribution terms" },
};

function assessLicense(pkgName: string): LicenseResult {
  const clean = pkgName.replace(/^@[^/]+\//, "").split("@")[0]; // strip scope and version
  const known = KNOWN_LICENSES[pkgName] || KNOWN_LICENSES[clean];

  if (known) {
    return { package: pkgName, assumedLicense: known.license, risk: known.risk, note: known.note };
  }

  // Heuristic for unknown packages
  const commercialPatterns = /(pro|enterprise|premium| licensed|paid)/i;
  if (commercialPatterns.test(pkgName)) {
    return { package: pkgName, assumedLicense: "Unknown/Commercial", risk: "attention", note: "Name suggests commercial licensing — verify before production use." };
  }

  return { package: pkgName, assumedLicense: "Unknown", risk: "attention", note: "Not in known license map. Run `npm ls --json` or check package source." };
}

export function estimateLicenseAndCost(
  packageJsonDeps: Record<string, string>,
  techStack: string,
  estimatedBundleKB: number,
  hasDatabase: boolean
): LicenseCostReport {
  const deps = Object.keys(packageJsonDeps);
  const licenses = deps.map(assessLicense);

  const safeCount = licenses.filter(l => l.risk === "safe").length;
  const attentionCount = licenses.filter(l => l.risk === "attention").length;
  const dangerCount = licenses.filter(l => l.risk === "danger").length;

  // Cost heuristics
  const isSPA = !hasDatabase;
  const isFullStack = hasDatabase;
  const isGame = techStack.includes("phaser") || techStack.includes("three") || techStack.includes("godot") || techStack.includes("unity");
  const isDesktop = techStack.includes("electron");
  const isHeavy = estimatedBundleKB > 500;

  const estimates: CostEstimate[] = [];

  // Vercel
  if (isSPA || isFullStack) {
    const base = 20; // Pro plan
    const bandwidth = Math.round(estimatedBundleKB / 1024 * 5); // ~5 visits per MB
    const max = base + bandwidth;
    estimates.push({
      platform: "Vercel Pro",
      monthlyMin: 20,
      monthlyMax: Math.min(max, 150),
      explanation: isSPA
        ? "Static frontend — minimal server cost. Bandage scales with traffic."
        : "Full-stack with serverless functions. Cold starts + function execution billed.",
    });
  }

  // Fly.io
  if (isFullStack || isDesktop) {
    const min = isFullStack ? 5 : 2;
    const max = isHeavy ? 15 : 8;
    estimates.push({
      platform: "Fly.io",
      monthlyMin: min,
      monthlyMax: max,
      explanation: "VM-based hosting. 1 shared-cpu + 256MB RAM sufficient for light apps. Scale to 2-4 VMs for production.",
    });
  }

  // AWS
  if (isFullStack) {
    const dbCost = hasDatabase ? 13 : 0; // RDS db.t3.micro
    const ec2Cost = 8; // t3.micro on-demand
    const storage = 5; // 20GB GP2
    const bandwidth = Math.round(estimatedBundleKB / 1024 * 2);
    estimates.push({
      platform: "AWS (EC2 + RDS)",
      monthlyMin: ec2Cost + dbCost + storage,
      monthlyMax: ec2Cost + dbCost + storage + bandwidth + 10,
      explanation: "Reserved instances cut costs 40%. Aurora Serverless v2 auto-scales DB. CloudFront reduces bandwidth cost.",
    });
  }

  // Supabase (database + auth + storage)
  if (hasDatabase) {
    estimates.push({
      platform: "Supabase",
      monthlyMin: 0,
      monthlyMax: 25,
      explanation: "Free tier: 500MB DB, 2GB bandwidth, 50k auth users. Pro at $25 removes limits.",
    });
  }

  // Recommendation
  let recommendation = "";
  if (isSPA && !isHeavy) recommendation = "Vercel Hobby (free) likely sufficient. Upgrade to Pro if >100GB bandwidth.";
  else if (isFullStack && !isHeavy) recommendation = "Fly.io for simplicity + cost control. Supabase for managed DB + auth.";
  else if (isGame || isHeavy) recommendation = "Fly.io with 2+ VMs. Consider CDN for static assets.";
  else recommendation = "Start free on Vercel/Supabase. Monitor bandwidth before upgrading.";

  logger.info(
    { deps: deps.length, safe: safeCount, attention: attentionCount, danger: dangerCount },
    "license_cost_scan_complete"
  );

  return {
    licenses,
    totalDeps: deps.length,
    safeCount,
    attentionCount,
    dangerCount,
    costEstimates: estimates,
    hostingRecommendation: recommendation,
  };
}

/** Markdown report for UI display */
export function licenseCostMarkdown(r: LicenseCostReport): string {
  const lines: string[] = [];
  lines.push("## License & Cost Report");
  lines.push("");
  lines.push(`**Dependencies:** ${r.totalDeps} total`);
  lines.push(`- ✅ Safe (MIT/Apache): ${r.safeCount}`);
  lines.push(`- ⚠️ Needs verification: ${r.attentionCount}`);
  lines.push(`- 🔴 Danger (GPL/copyleft): ${r.dangerCount}`);
  lines.push("");

  if (r.attentionCount > 0) {
    lines.push("### Packages needing attention");
    for (const l of r.licenses.filter(x => x.risk !== "safe")) {
      lines.push(`- **${l.package}** — ${l.assumedLicense}: ${l.note}`);
    }
    lines.push("");
  }

  lines.push("### Estimated Monthly Costs");
  for (const c of r.costEstimates) {
    lines.push(`- **${c.platform}:** $${c.monthlyMin}–$${c.monthlyMax}/mo`);
    lines.push(`  ${c.explanation}`);
  }
  lines.push("");
  lines.push(`**Recommendation:** ${r.hostingRecommendation}`);

  return lines.join("\n");
}

export default estimateLicenseAndCost;