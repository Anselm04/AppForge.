import { test } from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { remote } from "./verify-production-build-runtime.mjs";

function inspect(prepared = true) {
  const calls = [];
  const fs = {
    readdirSync: () => ["123", "456", "self"],
    readFileSync: (path) => {
      if (path.endsWith("/cmdline"))
        return path.includes("/123/")
          ? "node\0dist/server.js\0"
          : "node\0unrelated.js\0";
      return (
        "DATABASE_URL=private-sentinel\0EXISTING_HOST_SANDBOX_ENABLED=true\0APPFORGE_SANDBOX_PREPARED=" +
        String(prepared) +
        "\0"
      );
    },
  };
  new Script(remote).runInNewContext({
    require: (name) =>
      name === "node:fs"
        ? fs
        : name === "node:assert/strict"
          ? assert
          : {
              execFileSync: (command, args, options) => {
                calls.push({ command, args, options });
                return "APPFORGE_BUILD_RUNTIME_READY\n";
              },
            },
    console: { log() {} },
  });
  return calls;
}
test("production startup probe finds the server and forwards only approved public flags", () => {
  const [call] = inspect();
  assert.equal(call.command, "su-exec");
  assert.equal(call.args[0], "1001:1001");
  assert.deepEqual(Object.keys(call.options.env).sort(), [
    "APPFORGE_SANDBOX_PREPARED",
    "EXISTING_HOST_SANDBOX_ENABLED",
    "NODE_ENV",
    "PATH",
  ]);
  assert.equal(call.options.env.DATABASE_URL, undefined);
});
test("an unprepared serving process cannot claim build availability", () => {
  assert.throws(
    () => inspect(false),
    /Serving process isolation preparation failed/,
  );
});
