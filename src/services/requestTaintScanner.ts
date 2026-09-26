export type RequestTaintFinding = {
  ruleId: string;
  severity: "high";
  path: string;
  line: number;
  message: string;
  evidence: string;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
}

function lineNumberAt(content: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (content.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function collectTainted(
  content: string,
  language: "javascript" | "python",
): Set<string> {
  const tainted = new Set<string>();
  const add = (name?: string) => {
    if (name && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) tainted.add(name);
  };

  if (language === "javascript") {
    const assignment =
      /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:(?:req|request)\.(?:body|query|params)(?:\??\.[A-Za-z_$][\w$]*|\[[^\]\n]+\])?|(?:body|query|params)(?:\??\.[A-Za-z_$][\w$]*|\[[^\]\n]+\]))/g;
    let match: RegExpExecArray | null;
    while ((match = assignment.exec(content)) !== null) add(match[1]);

    const destructuring =
      /\b(?:const|let|var)\s*\{([^}\n]+)\}\s*=\s*(?:req|request)\.(?:body|query|params)\b/g;
    while ((match = destructuring.exec(content)) !== null) {
      for (const raw of match[1].split(",")) {
        const part = raw.trim().replace(/=.*$/, "").trim();
        if (!part) continue;
        const pieces = part.split(":").map((item) => item.trim());
        add(pieces[1] || pieces[0]);
      }
    }
  } else {
    const assignment =
      /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:request\.(?:args|form|json|query_params|path_params)(?:\[[^\]\n]+\]|\.[A-Za-z_][A-Za-z0-9_]*)?|(?:query_params|path_params)(?:\[[^\]\n]+\]|\.[A-Za-z_][A-Za-z0-9_]*)?)/gm;
    let match: RegExpExecArray | null;
    while ((match = assignment.exec(content)) !== null) add(match[1]);
  }

  let changed = true;
  for (let pass = 0; changed && pass < 8; pass += 1) {
    changed = false;
    for (const source of Array.from(tainted)) {
      const escaped = escapeRegex(source);
      const aliasPattern =
        language === "javascript"
          ? new RegExp(
              "\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*" +
                escaped +
                "\\b",
              "g",
            )
          : new RegExp(
              "^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*" +
                escaped +
                "\\b",
              "gm",
            );
      let match: RegExpExecArray | null;
      while ((match = aliasPattern.exec(content)) !== null) {
        if (!tainted.has(match[1])) {
          tainted.add(match[1]);
          changed = true;
        }
      }
    }
  }

  return tainted;
}

export function scanRequestTaintFlows(
  path: string,
  content: string,
): RequestTaintFinding[] {
  const isJavaScript = /\.(?:js|jsx|ts|tsx|mjs|cjs)$/i.test(path);
  const isPython = /\.py$/i.test(path);
  if (!isJavaScript && !isPython) return [];

  const tainted = collectTainted(content, isPython ? "python" : "javascript");
  const findings: RequestTaintFinding[] = [];
  const seen = new Set<string>();

  const addMatch = (
    ruleId: string,
    message: string,
    pattern: RegExp,
    evidence: string,
  ) => {
    const match = pattern.exec(content);
    if (!match) return;
    const line = lineNumberAt(content, match.index);
    const key = ruleId + ":" + line;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({
      ruleId,
      severity: "high",
      path,
      line,
      message,
      evidence,
    });
  };

  for (const identifier of tainted) {
    const name = escapeRegex(identifier);
    if (isJavaScript) {
      addMatch(
        "ssrf.tainted-alias",
        "Server-side network requests must not use request-controlled URL aliases without explicit validation/allowlisting.",
        new RegExp(
          "\\b(?:fetch|axios\\.(?:get|post|put|patch|delete)|new\\s+URL)\\s*\\(\\s*" +
            name +
            "\\b",
          "i",
        ),
        identifier + " -> network request",
      );
      addMatch(
        "command.tainted-alias",
        "Generated code must not pass request-controlled aliases to command execution APIs.",
        new RegExp(
          "\\b(?:exec|execSync|spawn|spawnSync|execFile|execFileSync)\\s*\\(\\s*" +
            name +
            "\\b",
          "i",
        ),
        identifier + " -> command execution",
      );
      addMatch(
        "path.tainted-alias",
        "Generated code must not pass request-controlled aliases directly to filesystem operations.",
        new RegExp(
          "\\b(?:readFile|readFileSync|writeFile|writeFileSync|appendFile|appendFileSync|rm|rmSync|unlink|unlinkSync|sendFile|createReadStream|createWriteStream)\\s*\\(\\s*" +
            name +
            "\\b",
          "i",
        ),
        identifier + " -> filesystem operation",
      );
      addMatch(
        "web.open-redirect-alias",
        "Redirect targets must not come from request-controlled aliases without allowlisting.",
        new RegExp("\\b(?:res\\.)?redirect\\s*\\(\\s*" + name + "\\b", "i"),
        identifier + " -> redirect",
      );
      addMatch(
        "sql.tainted-alias",
        "SQL execution must not use request-controlled SQL text.",
        new RegExp("\\b(?:query|execute)\\s*\\(\\s*" + name + "\\b", "i"),
        identifier + " -> SQL execution",
      );
      addMatch(
        "web.xss-tainted-alias",
        "Request-controlled aliases must not be assigned to raw HTML sinks.",
        new RegExp(
          "(?:\\.innerHTML\\s*=\\s*" +
            name +
            "\\b|dangerouslySetInnerHTML\\s*=\\s*\\{\\{\\s*__html\\s*:\\s*" +
            name +
            "\\b)",
          "i",
        ),
        identifier + " -> raw HTML sink",
      );
    } else {
      addMatch(
        "ssrf.python-tainted-alias",
        "Python network requests must not use request-controlled URL aliases without explicit validation/allowlisting.",
        new RegExp(
          "\\b(?:requests|httpx)\\.(?:get|post|put|patch|delete)\\s*\\(\\s*" +
            name +
            "\\b",
          "i",
        ),
        identifier + " -> network request",
      );
      addMatch(
        "command.python-tainted-alias",
        "Python command execution must not receive request-controlled aliases.",
        new RegExp(
          "(?:\\bos\\.system\\s*\\(\\s*" +
            name +
            "\\b|\\bsubprocess\\.(?:run|Popen|call|check_call|check_output)\\s*\\(\\s*" +
            name +
            "\\b)",
          "i",
        ),
        identifier + " -> command execution",
      );
      addMatch(
        "path.python-tainted-alias",
        "Python file operations must not receive request-controlled aliases directly.",
        new RegExp(
          "\\b(?:open|Path|send_file|FileResponse)\\s*\\(\\s*" +
            name +
            "\\b",
          "i",
        ),
        identifier + " -> filesystem operation",
      );
      addMatch(
        "web.python-open-redirect-alias",
        "Python redirect targets must not come from request-controlled aliases without allowlisting.",
        new RegExp(
          "\\b(?:RedirectResponse|redirect)\\s*\\(\\s*" +
            name +
            "\\b",
          "i",
        ),
        identifier + " -> redirect",
      );
      addMatch(
        "sql.python-tainted-alias",
        "Python SQL execution must not use request-controlled SQL text.",
        new RegExp(
          "\\b(?:execute|executemany)\\s*\\(\\s*" + name + "\\b",
          "i",
        ),
        identifier + " -> SQL execution",
      );
      addMatch(
        "web.python-xss-tainted-alias",
        "Request-controlled aliases must not be rendered as trusted HTML.",
        new RegExp(
          "\\b(?:Markup|mark_safe|render_template_string)\\s*\\(\\s*" +
            name +
            "\\b",
          "i",
        ),
        identifier + " -> trusted HTML sink",
      );
    }
  }

  return findings;
}
