import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { trustedProxyPolicy } from "../lib/trustedProxyPolicy.js";

describe("trusted reverse proxy boundary", () => {
  it("defaults to loopback ingress rather than arbitrary client headers", () => {
    expect(trustedProxyPolicy(undefined)).toEqual(["loopback"]);
    expect(trustedProxyPolicy("")).toEqual(["loopback"]);
    const server = readFileSync("src/server.ts", "utf8");
    expect(server).toContain(
      "trustedProxyPolicy(process.env.APPFORGE_TRUSTED_PROXY_CIDRS)",
    );
  });

  it("accepts explicitly enumerated IP addresses and bounded CIDRs", () => {
    expect(trustedProxyPolicy("192.0.2.1,2001:db8::1/128")).toEqual([
      "192.0.2.1",
      "2001:db8::1/128",
    ]);
    expect(trustedProxyPolicy("10.20.0.0/16")).toEqual(["10.20.0.0/16"]);
  });

  const rejected = [
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
  ];
  for (const value of rejected) {
    it(`rejects unsafe proxy trust: ${value}`, () => {
      expect(() => trustedProxyPolicy(value)).toThrow();
    });
  }
});
