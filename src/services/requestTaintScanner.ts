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

type TaintedIdentifier = {
  index: number;
  line: number;
};

function identifierReference(
  identifier: string,
  language: "javascript" | "python",
): string {
  const escaped = escapeRegex(identifier);
  return language === "javascript"
    ? "(?<![\\w$])" + escaped + "(?![\\w$])"
    : "(?<![A-Za-z0-9_])" + escaped + "(?![A-Za-z0-9_])";
}

function collectTainted(
  content: string,
  language: "javascript" | "python",
): Map<string, TaintedIdentifier> {
  const tainted = new Map<string, TaintedIdentifier>();
  const add = (name: string | undefined, index: number): boolean => {
    if (!name || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) return false;
    const existing = tainted.get(name);
    if (existing && existing.index <= index) return false;
    tainted.set(name, {
      index,
      line: lineNumberAt(content, index),
    });
    return true;
  };

  if (language === "javascript") {
    const assignment =
      /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:(?:req|request)\.(?:body|query|params)(?:\??\.[A-Za-z_$][\w$]*|\[[^\]\n]+\])?|(?:body|query|params)(?:\??\.[A-Za-z_$][\w$]*|\[[^\]\n]+\]))/g;
    let match: RegExpExecArray | null;
    while ((match = assignment.exec(content)) !== null) {
      add(match[1], match.index);
    }

    const destructuring =
      /\b(?:const|let|var)\s*\{([^}\n]+)\}\s*=\s*(?:req|request)\.(?:body|query|params)\b/g;
    while ((match = destructuring.exec(content)) !== null) {
      for (const raw of match[1].split(",")) {
        const part = raw.trim().replace(/=.*$/, "").trim();
        if (!part) continue;
        const pieces = part.split(":").map((item) => item.trim());
        add(pieces[1] || pieces[0], match.index);
      }
    }
  } else {
    const assignment =
      /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:request\.(?:args|form|json|query_params|path_params)(?:\[[^\]\n]+\]|\.[A-Za-z_][A-Za-z0-9_]*)?|(?:query_params|path_params)(?:\[[^\]\n]+\]|\.[A-Za-z_][A-Za-z0-9_]*)?)/gm;
    let match: RegExpExecArray | null;
    while ((match = assignment.exec(content)) !== null) {
      add(match[1], match.index);
    }
  }

  let changed = true;
  for (let pass = 0; changed && pass < 8; pass += 1) {
    changed = false;
    for (const [source, sourceDetail] of Array.from(tainted.entries())) {
      const sourceReference = identifierReference(source, language);
      const aliasPattern =
        language === "javascript"
          ? new RegExp(
              "\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*" +
                sourceReference,
              "g",
            )
          : new RegExp(
              "^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*" + sourceReference,
              "gm",
            );
      let match: RegExpExecArray | null;
      while ((match = aliasPattern.exec(content)) !== null) {
        if (match.index < sourceDetail.index) continue;
        if (add(match[1], match.index)) changed = true;
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
    minIndex: number,
  ) => {
    const matcher = new RegExp(
      pattern.source,
      pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
    );
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(content)) !== null) {
      if (match.index < minIndex) continue;
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
      return;
    }
  };

  for (const [identifier, detail] of tainted.entries()) {
    const id = identifierReference(
      identifier,
      isPython ? "python" : "javascript",
    );
    if (isJavaScript) {
      addMatch(
        "ssrf.tainted-alias",
        "Server-side network requests must not use request-controlled URL aliases without explicit validation/allowlisting.",
        new RegExp(
          "\\b(?:fetch|axios\\.(?:get|post|put|patch|delete)|new\\s+URL)\\s*\\(\\s*" +
            id,
          "i",
        ),
        identifier + " -> network request",
        detail.index,
      );
      addMatch(
        "command.tainted-alias",
        "Generated code must not pass request-controlled aliases to command execution APIs.",
        new RegExp(
          "\\b(?:exec|execSync|spawn|spawnSync|execFile|execFileSync)\\s*\\(\\s*" +
            id,
          "i",
        ),
        identifier + " -> command execution",
        detail.index,
      );
      addMatch(
        "path.tainted-alias",
        "Generated code must not pass request-controlled aliases directly to filesystem operations.",
        new RegExp(
          "\\b(?:readFile|readFileSync|writeFile|writeFileSync|appendFile|appendFileSync|rm|rmSync|unlink|unlinkSync|sendFile|createReadStream|createWriteStream)\\s*\\(\\s*" +
            id,
          "i",
        ),
        identifier + " -> filesystem operation",
        detail.index,
      );
      addMatch(
        "web.open-redirect-alias",
        "Redirect targets must not come from request-controlled aliases without allowlisting.",
        new RegExp("\\b(?:res\\.)?redirect\\s*\\(\\s*" + id, "i"),
        identifier + " -> redirect",
        detail.index,
      );
      addMatch(
        "sql.tainted-alias",
        "SQL execution must not use request-controlled SQL text.",
        new RegExp(
          "\\b(?:query|execute)\\s*\\(\\s*(?:" +
            id +
            "|[^;\\n]*(?:\\+\\s*" +
            id +
            "|" +
            id +
            "\\s*\\+))",
          "i",
        ),
        identifier + " -> SQL execution",
        detail.index,
      );
      addMatch(
        "web.xss-tainted-alias",
        "Request-controlled aliases must not be assigned to raw HTML sinks.",
        new RegExp(
          "(?:\\.innerHTML\\s*=\\s*" +
            id +
            "|dangerouslySetInnerHTML\\s*=\\s*\\{\\{\\s*__html\\s*:\\s*" +
            id +
            ")",
          "i",
        ),
        identifier + " -> raw HTML sink",
        detail.index,
      );
    } else {
      addMatch(
        "ssrf.python-tainted-alias",
        "Python network requests must not use request-controlled URL aliases without explicit validation/allowlisting.",
        new RegExp(
          "\\b(?:requests|httpx)\\.(?:get|post|put|patch|delete)\\s*\\(\\s*" +
            id,
          "i",
        ),
        identifier + " -> network request",
        detail.index,
      );
      addMatch(
        "command.python-tainted-alias",
        "Python command execution must not receive request-controlled aliases.",
        new RegExp(
          "(?:\\bos\\.system\\s*\\(\\s*" +
            id +
            "|\\bsubprocess\\.(?:run|Popen|call|check_call|check_output)\\s*\\(\\s*" +
            id +
            ")",
          "i",
        ),
        identifier + " -> command execution",
        detail.index,
      );
      addMatch(
        "path.python-tainted-alias",
        "Python file operations must not receive request-controlled aliases directly.",
        new RegExp(
          "\\b(?:open|Path|send_file|FileResponse)\\s*\\(\\s*" + id,
          "i",
        ),
        identifier + " -> filesystem operation",
        detail.index,
      );
      addMatch(
        "web.python-open-redirect-alias",
        "Python redirect targets must not come from request-controlled aliases without allowlisting.",
        new RegExp(
          "\\b(?:RedirectResponse|redirect)\\s*\\(\\s*" + id,
          "i",
        ),
        identifier + " -> redirect",
        detail.index,
      );
      addMatch(
        "sql.python-tainted-alias",
        "Python SQL execution must not use request-controlled SQL text.",
        new RegExp(
          "\\b(?:execute|executemany)\\s*\\(\\s*" + id,
          "i",
        ),
        identifier + " -> SQL execution",
        detail.index,
      );
      addMatch(
        "web.python-xss-tainted-alias",
        "Request-controlled aliases must not be rendered as trusted HTML.",
        new RegExp(
          "\\b(?:Markup|mark_safe|render_template_string)\\s*\\(\\s*" +
            id,
          "i",
        ),
        identifier + " -> trusted HTML sink",
        detail.index,
      );
    }
  }

  return findings;
}
