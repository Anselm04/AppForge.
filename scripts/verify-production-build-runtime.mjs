import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

// Inspect only startup's two public isolation flags. Never print or transfer
// the web process environment, credentials or customer project files.
export const remote = `
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const servers = fs.readdirSync("/proc").filter(pid => {
  if (!/^\\d+$/.test(pid)) return false;
  try { return fs.readFileSync("/proc/"+pid+"/cmdline","utf8").split("\\0").includes("dist/server.js"); } catch { return false; }
});
assert.equal(servers.length, 1, "Expected one serving AppForge process");
const entries = fs.readFileSync("/proc/"+servers[0]+"/environ","utf8").split("\\0");
const env = {PATH:"/usr/local/bin:/usr/bin:/bin",NODE_ENV:"production"};
for (const name of ["EXISTING_HOST_SANDBOX_ENABLED","APPFORGE_SANDBOX_PREPARED"]) {
  const entry = entries.find(item => item.startsWith(name+"="));
  assert.equal(entry, name+"=true", "Serving process isolation preparation failed");
  env[name] = "true";
}
const output = execFileSync("su-exec",["1001:1001","node","--input-type=module","-e",
  'import assert from "node:assert/strict"; import {existingHostBuildReady} from "./dist/services/existingHostBuildRunner.js"; assert.equal(process.getuid(),1001); assert.equal(await existingHostBuildReady(),true); console.log("APPFORGE_BUILD_RUNTIME_READY");'
],{cwd:"/app",env,encoding:"utf8",timeout:10000,maxBuffer:8192});
assert.ok(output.includes("APPFORGE_BUILD_RUNTIME_READY"));
console.log("APPFORGE_BUILD_RUNTIME_READY");
`;
if (process.argv[1]?.endsWith("verify-production-build-runtime.mjs")) {
  const app = "appforge-unfurling-moon-9058";
  const machines = JSON.parse(
    execFileSync("flyctl", ["machines", "list", "--app", app, "--json"], {
      encoding: "utf8",
      timeout: 30000,
    }),
  );
  const started = machines.filter(
    (machine) =>
      machine.state === "started" &&
      (machine.config?.metadata?.fly_process_group ?? "app") === "app",
  );
  assert.equal(
    started.length,
    2,
    "Expected exactly two existing serving machines",
  );
  for (const machine of started) {
    const command = "node -e '" + remote.replaceAll("'", "'\\''") + "'";
    const output = execFileSync(
      "flyctl",
      ["machine", "exec", machine.id, command, "--app", app, "--timeout", "20"],
      { encoding: "utf8", timeout: 30000, maxBuffer: 16384 },
    );
    // Fly remote execution may report zero exit status on remote failure, so
    // explicit positive evidence is mandatory for each serving machine.
    assert.ok(
      output
        .split("\n")
        .some((line) => line.trim() === "APPFORGE_BUILD_RUNTIME_READY"),
      "Serving machine did not prove non-root build readiness",
    );
    console.log(
      "Existing serving machine " +
        machine.id +
        " qualified production build readiness",
    );
  }
}
