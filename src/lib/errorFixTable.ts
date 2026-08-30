/**
 * Deterministic error-class patches — fix common compile failures without an LLM round-trip.
 */

export function applyDeterministicErrorFixes(
  files: Record<string, string>,
  errors: string[],
): { files: Record<string, string>; applied: string[] } {
  const out = { ...files };
  const applied: string[] = [];
  const blob = errors.join("\n");

  // Missing React import when JSX present
  for (const [path, content] of Object.entries(out)) {
    if (!/\.(tsx|jsx)$/.test(path)) continue;
    if (/<[A-Za-z]/.test(content) && !/from\s+["']react["']/.test(content)) {
      out[path] = `import React from "react";\n${content}`;
      applied.push(`react-import:${path}`);
    }
  }

  // Cannot find module './X' with extension — strip .tsx from imports (also in harden)
  for (const [path, content] of Object.entries(out)) {
    if (!/\.(tsx?|jsx?)$/.test(path)) continue;
    const next = content.replace(
      /(from\s+["'])(\.[^"']+)\.(tsx?|jsx?)(["'])/g,
      "$1$2$4",
    );
    if (next !== content) {
      out[path] = next;
      applied.push(`strip-ext:${path}`);
    }
  }

  // App export mismatch vs main
  const main = out["src/main.tsx"] ?? out["src/main.ts"] ?? "";
  let app = out["src/App.tsx"] ?? out["src/App.jsx"] ?? "";
  if (main && app) {
    const wantsNamed = /import\s*\{\s*App\s*\}\s*from\s*["']\.\/App/.test(main);
    const wantsDefault =
      /import\s+App\s+from\s*["']\.\/App/.test(main) && !wantsNamed;
    const hasNamed = /export\s+(function|const)\s+App\b/.test(app);
    const hasDefault =
      /export\s+default\s+(function\s+)?App\b/.test(app) ||
      /export\s+default\s+function\b/.test(app);
    if (wantsNamed && !hasNamed && hasDefault) {
      out["src/App.tsx"] = `${app}\nexport { default as App };\n`;
      applied.push("export-named-alias");
    } else if (wantsDefault && !hasDefault && hasNamed) {
      out["src/App.tsx"] = `${app}\nexport default App;\n`;
      applied.push("export-default");
    }
  }

  // TS6133 unused — ignore (non-blocking)
  // "Module has no default export" on css — ensure side-effect import only
  if (/has no default export/.test(blob) && /index\.css/.test(blob)) {
    for (const key of ["src/main.tsx", "src/main.ts"]) {
      if (!out[key]) continue;
      out[key] = out[key].replace(
        /import\s+\w+\s+from\s+["']\.\/index\.css["']/,
        `import "./index.css"`,
      );
      applied.push("css-side-effect-import");
    }
  }

  // Duplicate identifier React
  for (const [path, content] of Object.entries(out)) {
    if (!path.endsWith(".tsx")) continue;
    const dup = content.match(/import React from ["']react["']/g);
    if (dup && dup.length > 1) {
      let once = false;
      out[path] = content.replace(/import React from ["']react["'];?\n?/g, () => {
        if (once) return "";
        once = true;
        return `import React from "react";\n`;
      });
      applied.push(`dedupe-react:${path}`);
    }
  }

  return { files: out, applied: [...new Set(applied)] };
}
