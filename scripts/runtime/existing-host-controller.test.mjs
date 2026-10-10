import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existingHostReady,
  inspectSandboxInput,
  validateExistingHost,
} from "./existing-host-controller.mjs";
const packageJson = {
  name: "controlled-fixture",
  version: "1.0.0",
  scripts: {
    test: "node --test",
    build: "node build.cjs",
    start: "node server.cjs",
  },
};
const files = {
  "package.json": JSON.stringify(packageJson),
  "server.cjs": 'console.log("fixture")',
};
test("runtime availability is false until explicit startup preparation exists", async () => {
  assert.equal(existingHostReady(), false);
  const proof = await validateExistingHost(files, "node-service");
  assert.equal(proof.passed, false);
  assert.equal(proof.stage, "isolation");
  assert.deepEqual(proof.steps, {});
});
test("native stack and complete executable scripts must be preserved", () => {
  assert.deepEqual(inspectSandboxInput(files, "node-service"), {
    prefix: "",
    locked: false,
    start: "start",
  });
  assert.throws(
    () => inspectSandboxInput(files, "python-service"),
    /native runtime/,
  );
  assert.throws(
    () =>
      inspectSandboxInput(
        {
          "package.json": JSON.stringify({
            ...packageJson,
            scripts: { build: "true" },
          }),
        },
        "node-service",
      ),
    /scripts are required/,
  );
});
test("source paths cannot escape, inject installed modules or alter registry configuration", () => {
  for (const path of [
    "../escape",
    "/root/private",
    "a/../escape",
    "a\\escape",
    "a\0b",
    ".",
    "C:/escape",
    "node_modules/npm/bin/npm-cli.js",
    "src/.npmrc",
  ])
    assert.throws(
      () => inspectSandboxInput({ ...files, [path]: "unsafe" }, "node-service"),
      undefined,
      path,
    );
  assert.throws(() =>
    inspectSandboxInput(
      { ...files, "data.bin": new Uint8Array(4) },
      "node-service",
    ),
  );
});
test("registry dependencies are allowed but private URLs, local files and git dependencies are refused", () => {
  for (const value of [
    "file:/root/private",
    "http://169.254.169.254/private",
    "https://example.com/package.tgz",
    "git+https://github.com/example/private.git",
    "owner/repository",
    "../local",
  ])
    assert.throws(
      () =>
        inspectSandboxInput(
          {
            "package.json": JSON.stringify({
              ...packageJson,
              dependencies: { example: value },
            }),
          },
          "node-service",
        ),
      /public registry/,
    );
  assert.doesNotThrow(() =>
    inspectSandboxInput(
      {
        "package.json": JSON.stringify({
          ...packageJson,
          dependencies: { express: "^4.21.2" },
        }),
      },
      "node-service",
    ),
  );
});
test("registry lockfiles cannot import linked or private dependencies", () => {
  for (const item of [
    { link: true },
    { resolved: "http://127.0.0.1/package" },
    { resolved: "file:../../private" },
  ])
    assert.throws(
      () =>
        inspectSandboxInput(
          {
            ...files,
            "package-lock.json": JSON.stringify({
              lockfileVersion: 3,
              packages: { "node_modules/example": item },
            }),
          },
          "node-service",
        ),
      /non-registry/,
    );
  assert.throws(
    () =>
      inspectSandboxInput(
        {
          ...files,
          "package-lock.json": JSON.stringify({
            lockfileVersion: 1,
            dependencies: {},
          }),
        },
        "node-service",
      ),
    /modern registry/,
  );
});
test("multi-package workspaces and overrides require independent qualification", () => {
  for (const changes of [
    { workspaces: ["packages/*"] },
    { overrides: { example: "file:/root/private" } },
  ])
    assert.throws(
      () =>
        inspectSandboxInput(
          { "package.json": JSON.stringify({ ...packageJson, ...changes }) },
          "node-service",
        ),
      /qualified|qualification/,
    );
});
