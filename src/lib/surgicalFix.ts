/**
 * Surgical fix helpers — leaders (Bolt/Lovable) do not regenerate the whole app
 * on every type error. They patch the failing files with error context.
 */

/** Pull likely project file paths from compiler / bundler error text. */
export function extractErrorPaths(
  errors: string[],
  knownFiles: Record<string, string>,
): string[] {
  const found = new Set<string>();
  const keys = Object.keys(knownFiles);

  for (const line of errors) {
    // src/App.tsx(12,5): error TS...
    const m1 = line.match(/([\w./-]+\.(?:tsx?|jsx?|css|json))\s*[(:]/);
    if (m1) found.add(m1[1].replace(/^\.\//, ""));

    // at src/App.tsx:12:5
    const m2 = line.match(/\b([\w./-]+\.(?:tsx?|jsx?))\b/);
    if (m2) found.add(m2[1].replace(/^\.\//, ""));
  }

  // Only keep paths that exist in the tree (or close basename match)
  const resolved: string[] = [];
  for (const p of found) {
    if (knownFiles[p]) {
      resolved.push(p);
      continue;
    }
    const base = p.split("/").pop() ?? p;
    const hit = keys.find((k) => k === p || k.endsWith(`/${base}`) || k === base);
    if (hit) resolved.push(hit);
  }

  // Cap — keep prompt small
  return [...new Set(resolved)].slice(0, 8);
}

/** Build a single-shot surgical fix user prompt. */
export function buildSurgicalFixPrompt(opts: {
  appTitle: string;
  techStack: string;
  errors: string[];
  files: Record<string, string>;
}): string {
  const paths = extractErrorPaths(opts.errors, opts.files);
  const errorBlock = opts.errors.slice(0, 12).join("\n");

  const bodies =
    paths.length > 0
      ? paths
          .map((p) => {
            const body = opts.files[p] ?? "";
            const clipped =
              body.length > 4000 ? `${body.slice(0, 4000)}\n/* …truncated… */` : body;
            return `// filename: ${p}\n${clipped}`;
          })
          .join("\n\n")
      : Object.entries(opts.files)
          .filter(([p]) => /\.(tsx?|jsx?)$/.test(p))
          .slice(0, 6)
          .map(([p, body]) => {
            const clipped =
              body.length > 2500 ? `${body.slice(0, 2500)}\n/* …truncated… */` : body;
            return `// filename: ${p}\n${clipped}`;
          })
          .join("\n\n");

  return `App: ${opts.appTitle}
Stack: ${opts.techStack}

COMPILATION / BUILD ERRORS (fix THESE — do not rewrite unrelated files):
${errorBlock}

CURRENT FILE CONTENTS (edit only what is needed):
${bodies}

Output ONLY the corrected files using // filename: path markers.
Keep the existing UI and behavior. Minimal surgical edits.`;
}

export function mergeSurgicalPatches(
  current: Record<string, string>,
  patches: Record<string, string>,
): Record<string, string> {
  const out = { ...current };
  for (const [path, content] of Object.entries(patches)) {
    if (!path || path.includes("..")) continue;
    if (typeof content === "string" && content.trim().length > 0) {
      out[path] = content;
    }
  }
  return out;
}
