import { execFileSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

export function capacityReady(machines, expectedSha) {
  const started = machines.filter(
    (machine) =>
      (machine.config?.metadata?.fly_process_group ?? "app") === "app" &&
      machine.state === "started",
  );
  return (
    started.length === 2 &&
    started.every((machine) => {
      const sha = machine.image_ref?.labels?.GH_SHA;
      return (
        typeof sha === "string" &&
        sha.length === 40 &&
        sha === (expectedSha || started[0].image_ref?.labels?.GH_SHA) &&
        Array.isArray(machine.checks) &&
        machine.checks.length > 0 &&
        machine.checks.every((check) => check.status === "passing")
      );
    })
  );
}

if (process.argv[1]?.endsWith("verify-fly-capacity.mjs")) {
  const app = "appforge-unfurling-moon-9058";
  let ready = false;
  for (let attempt = 1; attempt <= 12; attempt++) {
    const machines = JSON.parse(
      execFileSync("flyctl", ["machines", "list", "--app", app, "--json"], {
        encoding: "utf8",
        timeout: 30000,
      }),
    );
    ready = capacityReady(machines, process.env.RELEASE_SHA);
    console.log(
      `Capacity verification ${attempt}/12: ${ready ? "ready" : "waiting"}`,
    );
    if (ready) break;
    await setTimeout(5000);
  }
  if (!ready) {
    console.error(
      "Expected two healthy app machines on one verified release. Fleet left unchanged; deployment recovery is required.",
    );
    process.exitCode = 1;
  }
}
