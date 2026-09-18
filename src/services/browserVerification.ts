import { spawn } from "child_process";
import { existsSync } from "fs";

export type BrowserVerificationResult = {
  ok: boolean;
  renderedHtmlLength: number;
  runtimeErrors: string[];
  error?: string;
};

const CHROMIUM_CANDIDATES = [
  process.env.APPFORGE_CHROMIUM_PATH,
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter((value): value is string => Boolean(value));

export function isAllowedBrowserVerificationUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      (
        /^af-[a-z0-9-]+\.fly\.dev$/i.test(url.hostname) ||
        /^[a-z0-9-]+\.vercel\.app$/i.test(url.hostname) ||
        /^[a-z0-9-]+\.netlify\.app$/i.test(url.hostname)
      ) &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

export function extractBrowserRuntimeErrors(stderr: string): string[] {
  return stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        /CONSOLE.*(?:Uncaught|ReferenceError|TypeError|SyntaxError|Error:)/i.test(
          line,
        ) ||
        /Uncaught (?:ReferenceError|TypeError|SyntaxError|Error)/i.test(line),
    )
    .slice(0, 20);
}

export function analyzeRenderedDom(html: string): {
  ok: boolean;
  error?: string;
} {
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) {
    return { ok: false, error: "Browser did not return a rendered document body" };
  }

  const bodyMarkup = bodyMatch[1]
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .trim();
  const visibleText = bodyMarkup
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/<vite-error-overlay\b/i.test(html)) {
    return { ok: false, error: "Vite runtime error overlay detected" };
  }

  if (
    /(?:application error|internal server error|cannot get \/|this site can(?:'|’)t be reached)/i.test(
      visibleText,
    )
  ) {
    return { ok: false, error: "Rendered page contains a fatal application error" };
  }

  const hasRenderedMarkup = bodyMarkup.length >= 40;
  const hasVisibleContent = visibleText.length > 0;
  if (!hasRenderedMarkup && !hasVisibleContent) {
    return {
      ok: false,
      error: "Browser rendered an empty application body",
    };
  }

  return { ok: true };
}

function chromiumBinary(): string | null {
  return CHROMIUM_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

export async function verifyGeneratedAppInBrowser(
  deployUrl: string,
  timeoutMs = 30_000,
): Promise<BrowserVerificationResult> {
  if (!isAllowedBrowserVerificationUrl(deployUrl)) {
    return {
      ok: false,
      renderedHtmlLength: 0,
      runtimeErrors: [],
      error: "Browser verification rejected an untrusted production deployment URL",
    };
  }

  const binary = chromiumBinary();
  if (!binary) {
    return {
      ok: false,
      renderedHtmlLength: 0,
      runtimeErrors: [],
      error: "Chromium is not installed on the AppForge runtime",
    };
  }

  const target = new URL(deployUrl);
  const hostResolverRules = `MAP * ~NOTFOUND, EXCLUDE ${target.hostname}`;

  return new Promise((resolve) => {
    const child = spawn(
      binary,
      [
        "--headless=new",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-sync",
        "--no-first-run",
        `--host-resolver-rules=${hostResolverRules}`,
        "--enable-logging=stderr",
        "--log-level=1",
        "--virtual-time-budget=8000",
        "--dump-dom",
        deployUrl,
      ],
      {
        shell: false,
        env: {
          ...process.env,
          HOME: process.env.HOME || "/tmp",
        },
      },
    );

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: BrowserVerificationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({
        ok: false,
        renderedHtmlLength: stdout.length,
        runtimeErrors: extractBrowserRuntimeErrors(stderr),
        error: "Browser verification timed out",
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 2_000_000) {
        child.kill("SIGKILL");
        finish({
          ok: false,
          renderedHtmlLength: stdout.length,
          runtimeErrors: extractBrowserRuntimeErrors(stderr),
          error: "Browser verification DOM exceeded safety limit",
        });
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 250_000) stderr = stderr.slice(-250_000);
    });
    child.on("error", (err) => {
      finish({
        ok: false,
        renderedHtmlLength: stdout.length,
        runtimeErrors: extractBrowserRuntimeErrors(stderr),
        error: `Chromium launch failed: ${err.message}`,
      });
    });
    child.on("close", (code) => {
      const runtimeErrors = extractBrowserRuntimeErrors(stderr);
      if (code !== 0) {
        finish({
          ok: false,
          renderedHtmlLength: stdout.length,
          runtimeErrors,
          error: `Chromium exited with code ${code ?? "unknown"}`,
        });
        return;
      }

      const dom = analyzeRenderedDom(stdout);
      finish({
        ok: dom.ok && runtimeErrors.length === 0,
        renderedHtmlLength: stdout.length,
        runtimeErrors,
        error:
          dom.error ??
          (runtimeErrors.length > 0
            ? "Browser detected an uncaught JavaScript runtime error"
            : undefined),
      });
    });
  });
}
