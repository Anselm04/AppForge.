import { execFileSync } from "node:child_process";
import { Script } from "node:vm";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

async function inspectHost(payload) {
  const reviewedFixture = payload.fixture;
  const fs = require("node:fs");
  const execFile = require("node:util").promisify(
    require("node:child_process").execFile,
  );
  const exists = (p) => fs.existsSync(p);
  const result = {
    uid: process.getuid(),
    gid: process.getgid(),
    node: process.version,
    capabilities: fs
      .readFileSync("/proc/self/status", "utf8")
      .match(/^CapEff:.*$/m)?.[0],
    memoryAvailable: fs
      .readFileSync("/proc/meminfo", "utf8")
      .match(/^MemAvailable:.*$/m)?.[0],
    docker: exists("/usr/bin/docker"),
    dockerd: exists("/usr/bin/dockerd"),
    bubblewrap: exists("/usr/bin/bwrap"),
    resourceControls: {},
    sandbox: null,
    appFilesPresent: exists("/app/dist/server.js"),
  };
  const groups = [];
  for (const [controller, settings] of [
    ["memory", { "memory.limit_in_bytes": "268435456" }],
    [
      "cpu,cpuacct",
      { "cpu.cfs_period_us": "100000", "cpu.cfs_quota_us": "50000" },
    ],
    ["pids", { "pids.max": "64" }],
  ]) {
    const group =
      "/sys/fs/cgroup/" + controller + "/appforge-qualification-" + process.pid;
    try {
      fs.mkdirSync(group);
      for (const [name, value] of Object.entries(settings))
        fs.writeFileSync(group + "/" + name, value);
      result.resourceControls[controller] = true;
      groups.push(group);
    } catch {
      result.resourceControls[controller] = false;
    }
  }
  // Reviewed fixture only. The trusted shell attaches itself before the
  // sandbox starts; every descendant inherits all three resource limits.
  if (groups.length !== 3) {
    for (const group of groups) fs.rmdirSync(group);
    throw new Error("Required resource controls are unavailable");
  }
  const fixture = reviewedFixture;
  const gatewayDirectory = fs.mkdtempSync(
    "/tmp/appforge-qualification-gateway-",
  );
  fs.chownSync(gatewayDirectory, 1001, 1001);
  fs.chmodSync(gatewayDirectory, 0o700);
  fs.writeFileSync(gatewayDirectory + "/registry-relay.cjs", payload.relay, {
    mode: 0o444,
  });
  const { createRegistryGateway } = await import(
    "data:text/javascript;base64," +
      Buffer.from(payload.gateway).toString("base64")
  );
  const gateway = await createRegistryGateway(
    gatewayDirectory + "/registry.sock",
  );
  fs.chownSync(gatewayDirectory + "/registry.sock", 1001, 1001);
  fs.chmodSync(gatewayDirectory + "/registry.sock", 0o600);
  const sandboxArgs = [
    "/usr/bin/bwrap",
    "--unshare-all",
    "--die-with-parent",
    "--new-session",
    "--cap-drop",
    "ALL",
    "--clearenv",
    "--ro-bind",
    "/usr",
    "/usr",
    "--ro-bind",
    "/bin",
    "/bin",
    "--ro-bind",
    "/lib",
    "/lib",
    "--ro-bind",
    gatewayDirectory,
    "/gateway",
    "--tmpfs",
    "/tmp",
    "--tmpfs",
    "/proc",
    "--dev",
    "/dev",
    "--setenv",
    "PATH",
    "/usr/local/bin:/usr/bin:/bin",
    "--setenv",
    "HOME",
    "/tmp",
    "--chdir",
    "/tmp",
    process.execPath,
    "--max-old-space-size=64",
    "-e",
    fixture,
  ];
  try {
    const { stdout: output } = await execFile(
      "/bin/sh",
      [
        "-c",
        groups
          .map((group) => "echo $$ > " + group + "/cgroup.procs")
          .join(" && ") + ' && exec "$@"',
        "appforge-qualification",
        "/bin/su",
        "-s",
        "/bin/sh",
        "appforge",
        "-c",
        "exec " +
          sandboxArgs
            .map((argument) => "'" + argument.replaceAll("'", "'\\''") + "'")
            .join(" "),
      ],
      {
        encoding: "utf8",
        timeout: 28000,
        maxBuffer: 32768,
        env: {
          PATH: "/usr/local/bin:/usr/bin:/bin",
          APPFORGE_HOST_SENTINEL: "synthetic-only",
        },
      },
    );
    result.sandbox = output.includes("SANDBOX_QUALIFIED");
    result.resourceUsage = {
      memoryPeakBytes: Number(
        fs.readFileSync(groups[0] + "/memory.max_usage_in_bytes", "utf8"),
      ),
      cpuNanoseconds: Number(
        fs.readFileSync(groups[1] + "/cpuacct.usage", "utf8"),
      ),
    };
  } catch (error) {
    result.sandbox = false;
    result.sandboxError = String(error.stderr ?? error.message).slice(0, 1000);
  }
  await gateway.close();
  fs.rmSync(gatewayDirectory, { recursive: true, force: true });
  result.cleanup = true;
  const staleGroups = [];
  for (const controller of ["memory", "cpu,cpuacct", "pids"]) {
    const root = "/sys/fs/cgroup/" + controller;
    for (const name of fs.readdirSync(root)) {
      if (/^appforge-qualification-\d+$/.test(name))
        staleGroups.push(root + "/" + name);
    }
  }
  for (const group of [...new Set([...groups, ...staleGroups])]) {
    const readPids = () =>
      fs
        .readFileSync(group + "/cgroup.procs", "utf8")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    // Stale groups are removed only when empty; only this run's groups may
    // have their reviewed fixture processes terminated.
    if (!groups.includes(group) && readPids().length) continue;
    for (const pid of readPids()) {
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {}
    }
    let removed = false;
    for (let retry = 0; retry < 20; retry++) {
      try {
        if (!readPids().length && group.includes("/memory/")) {
          try {
            fs.writeFileSync(group + "/memory.force_empty", "0");
          } catch {}
        }
        fs.rmdirSync(group);
        removed = true;
        break;
      } catch {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
      }
    }
    if (!removed) {
      result.cleanup = false;
      result.cleanupProcesses = readPids().length;
      result.cleanupChildren = fs
        .readdirSync(group)
        .filter((name) => fs.statSync(group + "/" + name).isDirectory());
    }
  }
  console.log("APPFORGE_HOST_PROBE " + JSON.stringify(result));
}

const payload = {
  fixture: readFileSync(
    new URL("./fixtures/existing-host-node.cjs", import.meta.url),
    "utf8",
  ),
  gateway: readFileSync(
    new URL("./runtime/registry-gateway.mjs", import.meta.url),
    "utf8",
  ),
  relay: readFileSync(
    new URL("./runtime/registry-relay.cjs", import.meta.url),
    "utf8",
  ),
};
new Script(payload.fixture);
new Script(payload.relay);
const probe =
  "(" +
  inspectHost.toString() +
  ")(" +
  JSON.stringify(payload) +
  ").catch(error => {console.error(error.message);process.exitCode=1})";
new Script(probe);
if (process.argv.includes("--syntax-only")) process.exit(0);
const app = "appforge-unfurling-moon-9058";
const machines = JSON.parse(
  execFileSync("flyctl", ["machines", "list", "--app", app, "--json"], {
    encoding: "utf8",
    timeout: 30000,
  }),
);
const started = machines.filter(
  (m) =>
    m.state === "started" &&
    (m.config?.metadata?.fly_process_group ?? "app") === "app",
);
if (started.length !== 2)
  throw new Error("Expected exactly two running production machines");
console.log(
  JSON.stringify(
    started.map((m) => ({
      id: m.id,
      memoryMb: m.config?.guest?.memory_mb,
      cpus: m.config?.guest?.cpus,
    })),
  ),
);
const encoded = gzipSync(Buffer.from(probe)).toString("base64");
const command =
  'node -e \'eval(require("node:zlib").gunzipSync(Buffer.from("' +
  encoded +
  '","base64")).toString())\'';
const output = execFileSync(
  "flyctl",
  ["machine", "exec", started[0].id, command, "--app", app, "--timeout", "40"],
  { encoding: "utf8", timeout: 50000 },
);
const marker = "APPFORGE_HOST_PROBE ";
const line = output.split("\n").find((line) => line.startsWith(marker));
if (!line)
  throw new Error(
    "Remote probe did not produce its required result: " + output.slice(-600),
  );
const result = JSON.parse(line.slice(marker.length));
if (!result.node || typeof result.uid !== "number")
  throw new Error("Incomplete remote probe");
console.log(JSON.stringify(result));

if (
  !result.cleanup ||
  !result.sandbox ||
  !Object.values(result.resourceControls).every(Boolean) ||
  !(result.resourceUsage?.memoryPeakBytes > 0) ||
  !(result.resourceUsage?.cpuNanoseconds > 0)
)
  throw new Error("Existing host did not pass bounded sandbox qualification");
