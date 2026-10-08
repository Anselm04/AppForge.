import assert from "node:assert/strict";
import { test } from "node:test";
import { capacityReady } from "./verify-fly-capacity.mjs";
const sha = "a".repeat(40);
const machine = (id) => ({
  id,
  state: "started",
  config: { metadata: { fly_process_group: "app" } },
  image_ref: { labels: { GH_SHA: sha } },
  checks: [{ status: "passing" }],
});
test("healthy replacements ignore stopped historical machines", () => {
  assert.equal(
    capacityReady(
      [machine("1"), machine("2"), { ...machine("old"), state: "stopped" }],
      sha,
    ),
    true,
  );
});
test("missing and excess capacity fail closed", () => {
  assert.equal(capacityReady([machine("1")], sha), false);
  assert.equal(
    capacityReady([machine("1"), machine("2"), machine("3")], sha),
    false,
  );
});
test("mixed and unverified releases fail closed", () => {
  assert.equal(
    capacityReady(
      [
        machine("1"),
        { ...machine("2"), image_ref: { labels: { GH_SHA: "b".repeat(40) } } },
      ],
      sha,
    ),
    false,
  );
  assert.equal(
    capacityReady([machine("1"), { ...machine("2"), image_ref: {} }], sha),
    false,
  );
});
test("failed and missing health checks fail closed", () => {
  assert.equal(
    capacityReady(
      [machine("1"), { ...machine("2"), checks: [{ status: "critical" }] }],
      sha,
    ),
    false,
  );
  assert.equal(
    capacityReady([machine("1"), { ...machine("2"), checks: [] }], sha),
    false,
  );
});
