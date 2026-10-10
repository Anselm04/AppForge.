import { execFileSync } from "node:child_process";
import { Script } from "node:vm";
import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import reviewedFiles from "./fixtures/reviewed-node-files.mjs";
import { namespaceFilter } from "./runtime/namespace-filter.mjs";

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
    [
      "memory",
      { "memory.use_hierarchy": "1", "memory.limit_in_bytes": "268435456" },
    ],
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
  result.delegation = false;
  const delegatedGroups = [];
  for (const group of groups) fs.chownSync(group, 1001, 1001);
  const delegatedScript =
    "const fs=require('node:fs');for(const group of " +
    JSON.stringify(groups) +
    "){const child=group+'/delegated';fs.mkdirSync(child);fs.writeFileSync(child+'/cgroup.procs',String(process.pid));}console.log('DELEGATED_CGROUPS_READY');";
  try {
    const { stdout } = await execFile(
      "/bin/su",
      [
        "-s",
        "/bin/sh",
        "appforge",
        "-c",
        "exec node --max-old-space-size=64 -e '" +
          delegatedScript.replaceAll("'", "'\\''") +
          "'",
      ],
      {
        encoding: "utf8",
        timeout: 3000,
        maxBuffer: 32768,
        env: { PATH: "/usr/local/bin:/usr/bin:/bin" },
      },
    );
    result.delegation = stdout.includes("DELEGATED_CGROUPS_READY");
  } catch (error) {
    result.delegationError = String(error.stderr ?? error.message).slice(
      0,
      300,
    );
  }
  for (const group of groups)
    if (fs.existsSync(group + "/delegated"))
      delegatedGroups.push(group + "/delegated");
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
  fs.writeFileSync(
    gatewayDirectory + "/namespace-seccomp.bpf",
    Buffer.from(payload.filter, "base64"),
    { mode: 0o444 },
  );
  const sandboxArgs = [
    "/usr/bin/bwrap",
    "--unshare-all",
    "--die-with-parent",
    "--new-session",
    "--cap-drop",
    "ALL",
    "--clearenv",
    "--seccomp",
    "3",
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
          .join(" && ") +
          " && exec 3< " +
          gatewayDirectory +
          '/namespace-seccomp.bpf && exec "$@"',
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
  // Exercise the actual controller with reviewed fixture sources only.
  const controllerDirectory = fs.mkdtempSync("/tmp/af-ctl-");
  fs.chmodSync(controllerDirectory, 0o755);
  const workspace = controllerDirectory + "/w";
  fs.mkdirSync(workspace);
  let mounted = false;
  try {
    await execFile("/bin/mount", [
      "-t",
      "tmpfs",
      "-o",
      "size=64m,nosuid,nodev,mode=700",
      "tmpfs",
      workspace,
    ]);
    mounted = true;
    fs.chownSync(workspace, 1001, 1001);
    const controller = payload.controller
      .replace(
        'const WORKSPACE = "/var/lib/appforge-builds";',
        "const WORKSPACE = " + JSON.stringify(workspace) + ";",
      )
      .replace(
        'const ROOTS = CONTROLLERS.map(\n  (name) => "/sys/fs/cgroup/" + name + "/appforge-builds",\n);',
        "const ROOTS = " + JSON.stringify(groups) + ";",
      );
    if (controller.includes("const ROOTS = CONTROLLERS.map"))
      throw Error("Qualification controller path substitution failed");
    for (const [name, content] of Object.entries({
      "existing-host-controller.mjs": controller,
      "registry-gateway.mjs": payload.gateway,
      "registry-relay.cjs": payload.relay,
      "runtime-relay.cjs": payload.runtimeRelay,
      "runner.mjs":
        'import {validateExistingHost} from "./existing-host-controller.mjs";const proof=await validateExistingHost(' +
        JSON.stringify(payload.files) +
        ',"node-service",{sourceSecurityVerified:true});console.log("CONTROLLER_PROOF "+JSON.stringify(proof));if(!proof.passed)process.exitCode=1;',
    }))
      fs.writeFileSync(controllerDirectory + "/" + name, content, {
        mode: 0o444,
      });
    fs.writeFileSync(
      controllerDirectory + "/namespace-seccomp.bpf",
      Buffer.from(payload.filter, "base64"),
      { mode: 0o444 },
    );
    const { stdout } = await execFile(
      "/bin/su",
      [
        "-s",
        "/bin/sh",
        "appforge",
        "-c",
        "exec node " + controllerDirectory + "/runner.mjs",
      ],
      {
        encoding: "utf8",
        timeout: 65000,
        maxBuffer: 32768,
        env: {
          PATH: "/usr/local/bin:/usr/bin:/bin",
          EXISTING_HOST_SANDBOX_ENABLED: "true",
          APPFORGE_SANDBOX_PREPARED: "true",
        },
      },
    );
    const line = stdout
      .split("\n")
      .find((line) => line.startsWith("CONTROLLER_PROOF "));
    if (!line) throw Error("Controller proof missing");
    const proof = JSON.parse(line.slice("CONTROLLER_PROOF ".length));
    result.controller = {
      passed: proof.passed,
      steps: proof.steps,
      stage: proof.stage,
      durationMs: proof.durationMs,
    };
    if (
      !proof.passed ||
      !proof.isolationId ||
      !["install", "security", "tests", "build", "runtime"].every(
        (stage) => proof.steps[stage]?.passed,
      )
    )
      throw Error("Controller qualification failed");
  } catch (error) {
    result.controller = {
      passed: false,
      error: String(error.stderr ?? error.message).slice(-1800),
    };
  } finally {
    for (const group of groups)
      for (const name of fs.readdirSync(group)) {
        if (!/^appforge-build-[a-f0-9-]+$/.test(name)) continue;
        const child = group + "/" + name;
        for (const pid of fs
          .readFileSync(child + "/cgroup.procs", "utf8")
          .trim()
          .split(/\s+/)
          .filter(Boolean))
          try {
            process.kill(Number(pid), "SIGKILL");
          } catch {}
        for (let retry = 0; retry < 20; retry++)
          try {
            if (child.includes("/memory/"))
              try {
                fs.writeFileSync(child + "/memory.force_empty", "0");
              } catch {}
            fs.rmdirSync(child);
            break;
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
      }
    if (mounted) await execFile("/bin/umount", [workspace]);
    fs.rmSync(controllerDirectory, { recursive: true, force: true });
  }
  result.cleanup = true;
  const staleGroups = [];
  for (const controller of ["memory", "cpu,cpuacct", "pids"]) {
    const root = "/sys/fs/cgroup/" + controller;
    for (const name of fs.readdirSync(root)) {
      if (/^appforge-qualification-\d+$/.test(name))
        staleGroups.push(root + "/" + name);
    }
  }
  for (const group of [
    ...new Set([...delegatedGroups, ...groups, ...staleGroups]),
  ]) {
    const readPids = () =>
      fs
        .readFileSync(group + "/cgroup.procs", "utf8")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    // Stale groups are removed only when empty; only this run's groups may
    // have their reviewed fixture processes terminated.
    if (
      !groups.includes(group) &&
      !delegatedGroups.includes(group) &&
      readPids().length
    )
      continue;
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
  files: reviewedFiles,
  controller: readFileSync(
    new URL("./runtime/existing-host-controller.mjs", import.meta.url),
    "utf8",
  ),
  runtimeRelay: readFileSync(
    new URL("./runtime/runtime-relay.cjs", import.meta.url),
    "utf8",
  ),
  filter: namespaceFilter().toString("base64"),
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
// Machine exec has a small request limit; transfer controlled public fixture
// bytes in bounded chunks. No token, customer code or environment is included.
const transferPath = "/tmp/af-probe-" + randomUUID();
const execute = (code, timeout = 10) =>
  execFileSync(
    "flyctl",
    [
      "machine",
      "exec",
      started[0].id,
      "node -e '" + code.replaceAll("'", "'\\''") + "'",
      "--app",
      app,
      "--timeout",
      String(timeout),
    ],
    { encoding: "utf8", timeout: (timeout + 10) * 1000 },
  );
let output;
try {
  execute(
    'require("node:fs").writeFileSync(' +
      JSON.stringify(transferPath) +
      ',"",{flag:"wx",mode:384});',
  );
  for (let offset = 0; offset < encoded.length; offset += 3000)
    execute(
      'require("node:fs").appendFileSync(' +
        JSON.stringify(transferPath) +
        "," +
        JSON.stringify(encoded.slice(offset, offset + 3000)) +
        ");",
    );
  output = execute(
    'const fs=require("node:fs");const path=' +
      JSON.stringify(transferPath) +
      ';const data=fs.readFileSync(path,"utf8");fs.unlinkSync(path);eval(require("node:zlib").gunzipSync(Buffer.from(data,"base64")).toString());',
    110,
  );
} finally {
  execute(
    'require("node:fs").rmSync(' +
      JSON.stringify(transferPath) +
      ",{force:true});",
  );
}
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
  !result.controller?.passed ||
  !result.delegation ||
  !result.cleanup ||
  !result.sandbox ||
  !Object.values(result.resourceControls).every(Boolean) ||
  !(result.resourceUsage?.memoryPeakBytes > 0) ||
  !(result.resourceUsage?.cpuNanoseconds > 0)
)
  throw new Error("Existing host did not pass bounded sandbox qualification");
