import { test } from "node:test";
import assert from "node:assert/strict";
import { connect } from "node:net";
import { Duplex } from "node:stream";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createRegistryGateway,
  publicRegistryAddress,
} from "./registry-gateway.mjs";

async function withGateway(options, work) {
  const directory = await mkdtemp(join(tmpdir(), "appforge-gateway-test-"));
  const path = join(directory, "registry.sock");
  const gateway = await createRegistryGateway(path, options);
  try {
    await work(path, gateway);
  } finally {
    await gateway.close();
    await rm(directory, { recursive: true, force: true });
  }
}
function request(path, target) {
  return new Promise((resolve, reject) => {
    const socket = connect(path);
    let output = "";
    socket.setTimeout(1000, () => {
      socket.destroy();
      reject(Error("request timed out"));
    });
    socket.on("error", reject);
    socket.on("data", (chunk) => {
      output += chunk;
      if (output.includes("\r\n\r\n")) {
        socket.destroy();
        resolve(output);
      }
    });
    socket.once("connect", () =>
      socket.write(
        `CONNECT ${target} HTTP/1.1\r\nHost: ignored.invalid\r\n\r\n`,
      ),
    );
  });
}
test("private, metadata, loopback and non-unicast addresses cannot be dialed", () => {
  for (const address of [
    "0.0.0.0",
    "10.2.3.4",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "192.0.2.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::ffff:127.0.0.1",
    "invalid",
  ])
    assert.equal(publicRegistryAddress(address), false, address);
  assert.equal(publicRegistryAddress("104.16.1.1"), true);
});
test("unapproved CONNECT destinations are rejected before DNS or TCP", async () => {
  let lookups = 0;
  let dials = 0;
  await withGateway(
    {
      lookup: async () => {
        lookups++;
        return [];
      },
      connect: () => {
        dials++;
      },
    },
    async (path) => {
      for (const target of [
        "169.254.169.254:80",
        "registry.npmjs.org.evil.example:443",
        "registry.npmjs.org:80",
        "REGISTRY.NPMJS.ORG:443",
        "user@registry.npmjs.org:443",
      ])
        assert.match(await request(path, target), /^HTTP\/1.1 403/);
    },
  );
  assert.equal(lookups, 0);
  assert.equal(dials, 0);
});
test("a private DNS answer or mixed public/private answers cannot reach an upstream", async () => {
  let dials = 0;
  for (const addresses of [
    [{ address: "127.0.0.1" }],
    [{ address: "104.16.1.1" }, { address: "10.0.0.1" }],
  ]) {
    await withGateway(
      {
        lookup: async () => addresses,
        connect: () => {
          dials++;
        },
      },
      async (path) =>
        assert.match(
          await request(path, "registry.npmjs.org:443"),
          /^HTTP\/1.1 403/,
        ),
    );
  }
  assert.equal(dials, 0);
});
test("an approved registry tunnel pins the resolved public address rather than resolving again", async () => {
  const called = [];
  await withGateway(
    {
      lookup: async (host, options) => {
        called.push({ host, options });
        return [{ address: "104.16.1.1" }];
      },
      connect: (options) => {
        called.push(options);
        const socket = new Duplex({
          read() {},
          write(_chunk, _encoding, done) {
            done();
          },
        });
        socket.setTimeout = () => socket;
        queueMicrotask(() => socket.emit("connect"));
        return socket;
      },
    },
    async (path) =>
      assert.match(
        await request(path, "registry.npmjs.org:443"),
        /^HTTP\/1.1 200/,
      ),
  );
  assert.equal(called[0].host, "registry.npmjs.org");
  assert.equal(called[0].options.family, 4);
  assert.deepEqual(called[1], { host: "104.16.1.1", port: 443 });
});
