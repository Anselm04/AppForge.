import { execFileSync } from "node:child_process";

const app = "appforge-unfurling-moon-9058";
const machines = JSON.parse(execFileSync("flyctl", ["machines", "list", "--app", app, "--json"], {encoding:"utf8", timeout:30000}));
const started = machines.filter(m => m.state === "started" && (m.config?.metadata?.fly_process_group ?? "app") === "app");
if (started.length !== 2) throw new Error("Expected exactly two running production machines");
console.log(JSON.stringify(started.map(m => ({id:m.id, memoryMb:m.config?.guest?.memory_mb, cpus:m.config?.guest?.cpus}))));
const probe = [
  "const fs=require(\"node:fs\");",
  "const exists=p=>fs.existsSync(p);",
  "const status=fs.readFileSync(\"/proc/self/status\",\"utf8\");",
  "const memory=fs.readFileSync(\"/proc/meminfo\",\"utf8\");",
  "console.log(JSON.stringify({uid:process.getuid(),gid:process.getgid(),node:process.version,capabilities:status.match(/^CapEff:.*$/m)?.[0],memoryAvailable:memory.match(/^MemAvailable:.*$/m)?.[0],cgroupV2:exists(\"/sys/fs/cgroup/cgroup.controllers\"),docker:exists(\"/usr/bin/docker\"),dockerd:exists(\"/usr/bin/dockerd\"),bubblewrap:exists(\"/usr/bin/bwrap\"),unshare:exists(\"/usr/bin/unshare\"),cgroupMemory:exists(\"/sys/fs/cgroup/memory/memory.limit_in_bytes\"),cgroupPids:exists(\"/sys/fs/cgroup/pids/pids.max\"),cgroupMounts:fs.readFileSync(\"/proc/mounts\",\"utf8\").split(\"\n\").filter(l=>l.includes(\" cgroup\")),filesystems:fs.readFileSync(\"/proc/filesystems\",\"utf8\").split(\"\n\").filter(l=>l.includes(\"overlay\"))}));"
].join("");
// Fixed read-only qualification command only. No environment, customer files,
// keys, new machines, installations, runtime changes, or Sprites calls.
const command = "node -e '" + probe + "'";
const output = execFileSync("flyctl", ["machine", "exec", started[0].id, command, "--app", app, "--timeout", "15"], {encoding:"utf8",timeout:30000});
console.log(output);
