import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { trustedProxyPolicy } from "../lib/trustedProxyPolicy.js";

describe("trusted reverse proxy boundary", () => {
  it("defaults to trusted loopback ingress only, not arbitrary client headers", () => {
    expect(trustedProxyPolicy(undefined)).toEqual(["loopback"]);
    expect(trustedProxyPolicy("")).toEqual(["loopback"]);
    expect(readFileSync("src/server.ts", "utf8")).toContain(
      "trustedProxyPolicy(process.env.APPFORGE_TRUSTED_PROXY_CIDRS)",
    );
  });

  it("accepts only explicitly enumerated IP addresses and bounded CIDRs", () => {
    expect(trustedProxyPolicy("192.0.2.1,2001:db8::1/128")).toEqual([
      "192.0.2.1",
      "2001:db8::1/128",
    ]);
    expect(trustedProxyPolicy("10.20.0.0/16")).toEqual(["10.20.0.0/16"]);
  });

  it.each([
    "true",
    "*",
    "uniquelocal",
    "0.0.0.0/0",
    "::/0",
    "false",
    "bad-host",
    "10.0.0.0/33",
    "2001:db8::1/129",
    "192.0.2.1,192.0.2.1",
  ])(
    "rejects unsafe or unverified trust value %s",
    (raw) => {
      expect(() => trustedProxyPolicy(raw)).toThrow();
    },
  );
});
