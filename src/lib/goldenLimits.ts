/** File-count and compliance limits for golden (reliable) builds. */

const KEEP_ALWAYS = new Set([
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "vite.config.js",
  "index.html",
  "src/main.tsx",
  "src/main.ts",
  "src/App.tsx",
  "src/App.jsx",
  "src/index.css",
  "src/vite-env.d.ts",
  "tailwind.config.js",
  "tailwind.config.ts",
  "postcss.config.js",
  "README.md",
  ".gitignore",
]);

/** Drop compliance/* and similar from golden trees (they often break tsc). */
export function stripComplianceFromGolden(
  files: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    if (path.startsWith("compliance/")) continue;
    if (path.includes("cookie-consent")) continue;
    if (path.includes("rate-limit") && path.endsWith(".tsx")) continue;
    out[path] = content;
  }
  return out;
}

/**
 * Cap sprawl: keep essential paths + largest remaining source files up to maxFiles.
 */
export function capGoldenFiles(
  files: Record<string, string>,
  maxFiles = 12,
): Record<string, string> {
  const entries = Object.entries(files);
  if (entries.length <= maxFiles) return { ...files };

  const essential = entries.filter(([p]) => KEEP_ALWAYS.has(p));
  const rest = entries
    .filter(([p]) => !KEEP_ALWAYS.has(p))
    .sort((a, b) => (b[1]?.length ?? 0) - (a[1]?.length ?? 0));

  const out: Record<string, string> = {};
  for (const [p, c] of essential) out[p] = c;
  for (const [p, c] of rest) {
    if (Object.keys(out).length >= maxFiles) break;
    // Prefer src/* over random roots
    if (p.startsWith("src/") || p.endsWith(".css") || p.endsWith(".json")) {
      out[p] = c;
    }
  }
  // Fill remaining slots
  for (const [p, c] of rest) {
    if (Object.keys(out).length >= maxFiles) break;
    if (!(p in out)) out[p] = c;
  }
  return out;
}
