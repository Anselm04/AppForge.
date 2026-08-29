import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { getProjectFiles } from "../db.js";

const ALLOWED_COMMANDS = new Set([
  "npm",
  "npx",
  "node",
  "pnpm",
  "yarn",
  "ls",
  "cat",
  "pwd",
  "echo",
  "help",
]);

type SandboxSession = {
  projectId: number;
  userId: number;
  dir: string;
  logs: TerminalLine[];
  devProcess: ChildProcessWithoutNullStreams | null;
  devPort: number | null;
  lastSyncAt: number;
};

export type TerminalLine = {
  id: number;
  text: string;
  kind: "info" | "cmd" | "out" | "err";
  at: number;
};

const sessions = new Map<string, SandboxSession>();
let nextLineId = 1;

function sessionKey(projectId: number, userId: number): string {
  return `${userId}:${projectId}`;
}

function pushLog(
  session: SandboxSession,
  text: string,
  kind: TerminalLine["kind"],
): TerminalLine {
  const line: TerminalLine = {
    id: nextLineId++,
    text,
    kind,
    at: Date.now(),
  };
  session.logs.push(line);
  if (session.logs.length > 500) session.logs.shift();
  return line;
}

async function syncProjectFiles(session: SandboxSession): Promise<void> {
  const files = await getProjectFiles(session.projectId);
  await rm(session.dir, { recursive: true, force: true });
  await mkdir(session.dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const full = join(session.dir, path);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content, "utf-8");
  }
  session.lastSyncAt = Date.now();
}

function parseCommand(raw: string): { cmd: string; args: string[] } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g);
  if (!parts?.length) return null;
  const unquote = (s: string) => s.replace(/^['"]|['"]$/g, "");
  const cmd = unquote(parts[0]);
  const args = parts.slice(1).map(unquote);
  return { cmd, args };
}

function isAllowed(cmd: string, args: string[]): boolean {
  if (!ALLOWED_COMMANDS.has(cmd)) return false;
  const joined = `${cmd} ${args.join(" ")}`.toLowerCase();
  const blocked = [
    "rm -rf /",
    "curl ",
    "wget ",
    "chmod ",
    "chown ",
    "sudo ",
    "kill ",
    "> /etc",
  ];
  return !blocked.some((b) => joined.includes(b));
}

export async function ensureSandboxSession(
  projectId: number,
  userId: number,
): Promise<SandboxSession> {
  const key = sessionKey(projectId, userId);
  let session = sessions.get(key);
  if (!session) {
    const dir = join(tmpdir(), `appforge-sandbox-${userId}-${projectId}`);
    session = {
      projectId,
      userId,
      dir,
      logs: [],
      devProcess: null,
      devPort: null,
      lastSyncAt: 0,
    };
    pushLog(
      session,
      "AppForge micro-VM sandbox ready — npm install / npm run dev supported.",
      "info",
    );
    sessions.set(key, session);
  }
  await syncProjectFiles(session);
  return session;
}

export async function execSandboxCommand(
  projectId: number,
  userId: number,
  command: string,
): Promise<{ lines: TerminalLine[]; exitCode: number | null }> {
  const session = await ensureSandboxSession(projectId, userId);
  const parsed = parseCommand(command);
  const newLines: TerminalLine[] = [];

  if (!parsed) {
    newLines.push(pushLog(session, "Empty command.", "err"));
    return { lines: newLines, exitCode: 1 };
  }

  if (parsed.cmd === "help") {
    newLines.push(
      pushLog(
        session,
        "Commands: npm install, npm run dev, npm run build, npx vite, ls, cat, pwd, help",
        "info",
      ),
    );
    return { lines: newLines, exitCode: 0 };
  }

  if (!isAllowed(parsed.cmd, parsed.args)) {
    newLines.push(
      pushLog(
        session,
        `Command not allowed in sandbox: ${parsed.cmd}. Try npm run dev or npm install.`,
        "err",
      ),
    );
    return { lines: newLines, exitCode: 1 };
  }

  newLines.push(pushLog(session, `$ ${command}`, "cmd"));

  if (
    parsed.cmd === "npm" &&
    parsed.args[0] === "run" &&
    parsed.args[1] === "dev"
  ) {
    await startDevServer(session, newLines);
    return { lines: newLines, exitCode: 0 };
  }

  const result = await runCmd(parsed.cmd, parsed.args, session.dir, 120_000);
  if (result.stdout) {
    for (const line of result.stdout.split("\n").filter(Boolean).slice(-40)) {
      newLines.push(pushLog(session, line, "out"));
    }
  }
  if (result.stderr) {
    for (const line of result.stderr.split("\n").filter(Boolean).slice(-20)) {
      newLines.push(pushLog(session, line, "err"));
    }
  }
  if (result.exitCode !== 0) {
    newLines.push(pushLog(session, `[exit ${result.exitCode}]`, "err"));
  }
  return { lines: newLines, exitCode: result.exitCode };
}

async function startDevServer(
  session: SandboxSession,
  newLines: TerminalLine[],
): Promise<void> {
  if (session.devProcess) {
    newLines.push(pushLog(session, "Dev server already running.", "info"));
    return;
  }

  const port = 5173 + (session.projectId % 100);
  session.devPort = port;

  const child = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: session.dir,
      shell: false,
      env: { ...process.env, FORCE_COLOR: "0" },
    },
  );
  session.devProcess = child;

  child.stdout.on("data", (d) => {
    const text = d.toString().trim();
    if (text) pushLog(session, text, "out");
  });
  child.stderr.on("data", (d) => {
    const text = d.toString().trim();
    if (text) pushLog(session, text, "err");
  });
  child.on("close", (code) => {
    pushLog(session, `Dev server stopped (code ${code ?? 0})`, "info");
    session.devProcess = null;
    session.devPort = null;
  });

  newLines.push(
    pushLog(
      session,
      `Starting dev server on port ${port} (preview iframe refreshes via HMR).`,
      "info",
    ),
  );
}

function runCmd(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: false, env: process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ exitCode: 1, stdout, stderr: stderr + "\n[TIMEOUT]" });
    }, timeoutMs);
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

export function getSandboxLogs(
  projectId: number,
  userId: number,
  sinceId = 0,
): TerminalLine[] {
  const session = sessions.get(sessionKey(projectId, userId));
  if (!session) return [];
  return session.logs.filter((l) => l.id > sinceId);
}

export async function stopSandboxDev(
  projectId: number,
  userId: number,
): Promise<void> {
  const session = sessions.get(sessionKey(projectId, userId));
  if (!session?.devProcess) return;
  session.devProcess.kill("SIGTERM");
  session.devProcess = null;
  session.devPort = null;
}

export function getSandboxDevPort(
  projectId: number,
  userId: number,
): number | null {
  return sessions.get(sessionKey(projectId, userId))?.devPort ?? null;
}
