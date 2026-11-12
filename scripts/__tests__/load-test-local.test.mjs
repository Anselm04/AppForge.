import test from "node:test";
import assert from "node:assert/strict";
import { percentile, safeLoadTarget } from "../load-test-local.mjs";

test("only accepts read-only local health endpoints", () => {
  assert.equal(
    safeLoadTarget("http://127.0.0.1:3000/api/health/live"),
    "http://127.0.0.1:3000/api/health/live",
  );
  assert.throws(
    () => safeLoadTarget("https://example.com/api/health/live"),
    /loopback/,
  );
  assert.throws(
    () => safeLoadTarget("http://127.0.0.1:3000/api/trpc/projects.create"),
    /read-only/,
  );
  assert.throws(
    () => safeLoadTarget("http://127.0.0.1:3000/api/health/live?token=abc"),
    /query/,
  );
  assert.throws(
    () => safeLoadTarget("http://user:pass@127.0.0.1:3000/api/health/live"),
    /credentials/,
  );
});

test("reports bounded percentiles correctly", () => {
  assert.equal(percentile([1, 2, 3, 4], 0.95), 4);
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2);
  assert.equal(percentile([], 0.95), null);
});
