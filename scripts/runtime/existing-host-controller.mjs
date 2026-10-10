import { randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  statSync,
  statfsSync,
  existsSync,
  readFileSync,
  openSync,
  closeSync,
} from "node:fs";
import {
  mkdir,
  writeFile,
  readFile,
  rm,
  chmod,
  lstat,
  readdir,
  rmdir,
} from "node:fs/promises";
import { posix, join } from "node:path";
import { request } from "node:http";
import { fileURLToPath } from "node:url";
import { createRegistryGateway } from "./registry-gateway.mjs";

const WORKSPACE = "/var/lib/appforge-builds";
const TOOLING = fileURLToPath(new URL(".", import.meta.url));
const CONTROLLERS = ["memory", "cpu,cpuacct", "pids"];
const ROOTS = CONTROLLERS.map(
  (name) => "/sys/fs/cgroup/" + name + "/appforge-builds",
);
let active = false;
let cleanupFailed = false;

export function existingHostReady() {
  if (
    process.env.EXISTING_HOST_SANDBOX_ENABLED !== "true" ||
    process.env.APPFORGE_SANDBOX_PREPARED !== "true" ||
    process.getuid?.() !== 1001 ||
    cleanupFailed
  )
    return false;
  try {
    const fs = statfsSync(WORKSPACE);
    return (
      process.arch === "x64" &&
      existsSync(TOOLING + "namespace-seccomp.bpf") &&
      existsSync("/usr/bin/bwrap") &&
      statSync(WORKSPACE).uid === 1001 &&
      fs.type === 0x01021994 &&
      fs.blocks * fs.bsize <= 512 * 1024 * 1024 &&
      Number(readFileSync(ROOTS[0] + "/memory.limit_in_bytes", "utf8")) <=
        805306368 &&
      Number(readFileSync(ROOTS[0] + "/memory.use_hierarchy", "utf8")) === 1 &&
      Number(readFileSync(ROOTS[1] + "/cpu.cfs_quota_us", "utf8")) === 50000 &&
      Number(readFileSync(ROOTS[1] + "/cpu.cfs_period_us", "utf8")) ===
        100000 &&
      Number(readFileSync(ROOTS[2] + "/pids.max", "utf8")) <= 256
    );
  } catch {
    return false;
  }
}

export function inspectSandboxInput(files, techStack) {
  if (
    ![
      "react-node",
      "next-node",
      "api-service",
      "node-service",
      "phaser-html5",
    ].includes(techStack)
  )
    throw Error(
      "Selected stack requires an independently qualified native runtime",
    );
  if (
    !files ||
    typeof files !== "object" ||
    Array.isArray(files) ||
    Object.keys(files).length > 1024 ||
    Buffer.byteLength(JSON.stringify(files)) > 5000000
  )
    throw Error("Invalid or oversized generated project");
  for (const [path, content] of Object.entries(files)) {
    if (
      typeof content !== "string" ||
      !path ||
      path.length > 240 ||
      path.includes("\\") ||
      path.includes("\0") ||
      path.startsWith("/") ||
      posix.normalize(path) !== path ||
      path === "." ||
      /^[A-Za-z]:/.test(path) ||
      path === ".." ||
      path.startsWith("../") ||
      path.split("/").includes("node_modules")
    )
      throw Error("Generated path is not a safe canonical source path");
  }
  const nested = !files["package.json"] && Boolean(files["src/package.json"]);
  const prefix = nested ? "src/" : "";
  const pkg = JSON.parse(files[prefix + "package.json"] ?? "null");
  if (
    !pkg ||
    typeof pkg !== "object" ||
    !["test", "build"].every(
      (name) =>
        typeof pkg.scripts?.[name] === "string" && pkg.scripts[name].trim(),
    ) ||
    !["start", "preview"].some(
      (name) =>
        typeof pkg.scripts?.[name] === "string" && pkg.scripts[name].trim(),
    )
  )
    throw Error("Node test, build and runtime scripts are required");
  if (Object.keys(files).some((path) => path.split("/").includes(".npmrc")))
    throw Error(
      "Project npm configuration is not allowed in the qualified registry profile",
    );
  if (pkg.workspaces)
    throw Error("Workspace dependency installation is not qualified");
  for (const section of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    for (const [name, value] of Object.entries(pkg[section] ?? {})) {
      if (
        !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name) ||
        typeof value !== "string" ||
        value.length > 100 ||
        !(
          /^[~^]?\d+(?:\.\d+){0,2}(?:-[a-z0-9.-]+)?$/i.test(value) ||
          /^[a-z][a-z0-9-]{0,40}$/i.test(value)
        )
      )
        throw Error("Only public registry package versions are qualified");
    }
  }
  if (pkg.overrides || pkg.resolutions)
    throw Error("Dependency overrides require separate qualification");
  const lock = files[prefix + "package-lock.json"];
  if (lock) {
    const parsed = JSON.parse(lock);
    if (![2, 3].includes(parsed.lockfileVersion))
      throw Error("Only modern registry lockfiles are qualified");
    for (const item of Object.values(parsed.packages ?? {})) {
      if (
        item?.link ||
        (item?.resolved &&
          !/^https:\/\/registry\.npmjs\.org\//.test(item.resolved))
      )
        throw Error("Lockfile includes a non-registry dependency");
    }
  }
  return {
    prefix,
    locked: Boolean(lock),
    start: pkg.scripts.start ? "start" : "preview",
  };
}

const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
async function killGroups(groups) {
  for (const group of groups) {
    let pids = [];
    try {
      pids = (await readFile(group + "/cgroup.procs", "utf8"))
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    } catch {}
    for (const pid of pids) {
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {}
    }
  }
}

function sandboxArgs(job, args, gateway = false, channel = false) {
  const result = [
    "--unshare-all",
    "--die-with-parent",
    "--new-session",
    "--cap-drop",
    "ALL",
    "--clearenv",
    "--seccomp",
    "3",
  ];
  for (const path of ["/usr", "/bin", "/lib", "/lib64"])
    if (existsSync(path)) result.push("--ro-bind", path, path);
  result.push(
    "--bind",
    job.source,
    "/app",
    "--ro-bind",
    TOOLING,
    "/controller",
    "--tmpfs",
    "/tmp",
    "--tmpfs",
    "/proc",
    "--dev",
    "/dev",
  );
  if (gateway) result.push("--ro-bind", job.gateway, "/gateway");
  if (channel) result.push("--bind", job.channel, "/channel");
  for (const [key, value] of Object.entries({
    PATH: "/usr/local/bin:/usr/bin:/bin",
    HOME: "/tmp",
    CI: "true",
    NODE_ENV: "production",
    PORT: "3000",
    NODE_OPTIONS: "--max-old-space-size=384 --disable-sigusr1",
    npm_config_cache: "/tmp/npm-cache",
    npm_config_update_notifier: "false",
  }))
    result.push("--setenv", key, value);
  result.push("--chdir", "/app/" + job.input.prefix, ...args);
  return result;
}

function startSandbox(job, args, options = {}) {
  const command =
    job.groups
      .map((group) => "echo $$ > " + quote(group + "/cgroup.procs"))
      .join(" && ") + ' && exec "$@"';
  const filterFd = openSync(TOOLING + "namespace-seccomp.bpf", "r");
  const child = spawn(
    "/bin/sh",
    [
      "-c",
      command,
      "appforge-isolation",
      "/usr/bin/bwrap",
      ...sandboxArgs(job, args, options.gateway, options.channel),
    ],
    {
      env: { PATH: "/usr/local/bin:/usr/bin:/bin" },
      stdio: ["ignore", "pipe", "pipe", filterFd],
    },
  );
  closeSync(filterFd);
  let output = "";
  let overflow = false;
  let bytes = 0;
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (chunk) => {
      bytes += chunk.length;
      output = (output + chunk.toString()).slice(-4000);
      if (bytes > 32768 && !overflow) {
        overflow = true;
        void killGroups(job.groups);
      }
    });
  const timer = setTimeout(() => {
    void killGroups(job.groups);
  }, options.timeout ?? 120000);
  const finished = new Promise((resolve) => {
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ passed: false, error: error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ passed: code === 0 && !overflow, error: output });
    });
  });
  return { child, finished };
}

async function removeOwnedTree(path) {
  // Called only after the complete cgroup has been killed; no symlink following.
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    await rm(path, { force: true });
    return;
  }
  await chmod(path, 0o700);
  for (const name of await readdir(path))
    await removeOwnedTree(join(path, name));
  await rmdir(path);
}

async function dispose(job) {
  await killGroups(job.groups);
  for (let retry = 0; retry < 40; retry++) {
    const counts = await Promise.all(
      job.groups.map((group) =>
        readFile(group + "/cgroup.procs", "utf8")
          .then((value) => value.trim().length)
          .catch(() => 0),
      ),
    );
    if (counts.every((count) => count === 0)) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await removeOwnedTree(job.directory);
  for (const group of job.groups) {
    let removed = false;
    for (let retry = 0; retry < 20; retry++) {
      try {
        if (group.includes("/memory/"))
          await writeFile(group + "/memory.force_empty", "0").catch(() => {});
        await rmdir(group);
        removed = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    if (!removed) throw Error("Sandbox cgroup cleanup failed");
  }
}

async function prepare(files, input) {
  const name = "appforge-build-" + randomUUID();
  const directory = join(WORKSPACE, name);
  const job = {
    directory,
    source: join(directory, "source"),
    gateway: join(directory, "gateway"),
    channel: join(directory, "channel"),
    groups: [],
    input,
  };
  try {
    for (const path of [directory, job.source, job.gateway, job.channel])
      await mkdir(path, { mode: 0o700 });
    for (const root of ROOTS) {
      const group = root + "/" + name;
      await mkdir(group);
      job.groups.push(group);
    }
    for (const [path, content] of Object.entries(files)) {
      const target = join(job.source, path);
      await mkdir(join(target, ".."), { recursive: true, mode: 0o700 });
      await writeFile(target, content, { mode: 0o600, flag: "wx" });
    }
    return job;
  } catch (error) {
    await dispose(job).catch(() => {
      cleanupFailed = true;
    });
    throw error;
  }
}

async function httpProbe(socketPath, path) {
  return new Promise((resolve) => {
    const req = request(
      { socketPath, path, method: "GET", timeout: 1500 },
      (res) => {
        let bytes = 0;
        res.on("data", (chunk) => {
          bytes += chunk.length;
          if (bytes > 1000000) res.destroy();
        });
        res.on("end", () =>
          resolve(res.statusCode >= 200 && res.statusCode < 300),
        );
        res.on("error", () => resolve(false));
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(false));
    req.end();
  });
}

export async function validateExistingHost(
  files,
  techStack,
  { sourceSecurityVerified = false } = {},
) {
  const started = Date.now();
  const proof = {
    passed: false,
    stage: "isolation",
    errors: [],
    durationMs: 0,
    isolationId: "",
    artifactSha256: createHash("sha256")
      .update(JSON.stringify(files) ?? "")
      .digest("hex"),
    techStack,
    steps: {},
  };
  if (!existingHostReady() || active) {
    proof.errors = ["Existing-host isolation is unavailable or busy"];
    return proof;
  }
  let input;
  try {
    input = inspectSandboxInput(files, techStack);
    if (!sourceSecurityVerified)
      throw Error("Source security review has not passed");
  } catch (error) {
    proof.errors = [error.message];
    return proof;
  }
  active = true;
  let job;
  let gateway;
  try {
    job = await prepare(files, input);
    proof.isolationId = job.directory.split("/").pop();
    gateway = await createRegistryGateway(job.gateway + "/registry.sock");
    await chmod(job.gateway + "/registry.sock", 0o600);
    const config = [
      "--registry=https://registry.npmjs.org",
      "--https-proxy=http://127.0.0.1:4873",
      "--userconfig=/tmp/empty-config",
      "--globalconfig=/tmp/empty-global-config",
      "--cache=/tmp/npm-cache",
      "--maxsockets=4",
      "--strict-ssl=true",
    ];
    const run = async (stage, args, options = {}) => {
      proof.stage = stage;
      const result = await startSandbox(job, args, options).finished;
      proof.steps[stage] = { passed: result.passed };
      if (!result.passed) throw Error(result.error || stage + " failed");
    };
    await run(
      "install",
      [
        process.execPath,
        "/controller/registry-relay.cjs",
        input.locked ? "ci" : "install",
        "--include=dev",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        ...config,
      ],
      { gateway: true },
    );
    await run(
      "security",
      [
        process.execPath,
        "/controller/registry-relay.cjs",
        "audit",
        "--audit-level=high",
        ...config,
      ],
      { gateway: true },
    );
    await gateway.close();
    gateway = null;
    await run("tests", ["npm", "test"]);
    await run("build", ["npm", "run", "build"]);
    proof.stage = "runtime";
    const running = startSandbox(
      job,
      [process.execPath, "/controller/runtime-relay.cjs", input.start],
      { channel: true, timeout: 35000 },
    );
    let exited = false;
    void running.finished.then(() => {
      exited = true;
    });
    const deadline = Date.now() + 30000;
    let healthy = false;
    while (Date.now() < deadline && !exited && !healthy) {
      for (const path of ["/api/health", "/health", "/"])
        if (await httpProbe(job.channel + "/http.sock", path)) {
          healthy = true;
          break;
        }
      if (!healthy) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    proof.steps.runtime = { passed: healthy && !exited };
    if (!proof.steps.runtime.passed)
      throw Error("Built product did not produce a successful HTTP response");
    proof.passed = true;
    proof.stage = "complete";
  } catch (error) {
    proof.errors = [String(error.message).slice(0, 1200)];
  } finally {
    if (gateway) await gateway.close().catch(() => {});
    if (job)
      await dispose(job).catch(() => {
        cleanupFailed = true;
        proof.passed = false;
        proof.errors.push("Sandbox cleanup failed");
      });
    active = false;
    proof.durationMs = Date.now() - started;
  }
  return proof;
}
