import { createServer } from "node:http";
import { connect } from "node:net";
import { lookup } from "node:dns/promises";

// Only the public npm registry is reachable. Resolve once, reject every
// non-public address, and dial the selected numeric address to avoid rebinding.
export function publicRegistryAddress(value) {
  const parts = value.split(".");
  if (
    parts.length !== 4 ||
    parts.some((p) => !/^(0|[1-9]\d{0,2})$/.test(p) || Number(p) > 255)
  )
    return false;
  const [a, b, c] = parts.map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 &&
      (b === 168 ||
        (b === 0 && (c === 0 || c === 2)) ||
        (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

export async function createRegistryGateway(socketPath, dependencies = {}) {
  const resolve = dependencies.lookup ?? lookup;
  const dial = dependencies.connect ?? connect;
  const sockets = new Set();
  let revoked = false;
  let transfers = 0;
  let bytes = 0;
  const server = createServer((_req, res) => {
    res.writeHead(405);
    res.end();
  });
  server.headersTimeout = 3000;
  server.requestTimeout = 5000;
  server.maxHeadersCount = 16;
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.setTimeout(10000, () => socket.destroy());
    socket.on("close", () => sockets.delete(socket));
  });
  server.on("connect", async (req, client, head) => {
    const refuse = (status = 403) =>
      client.end(`HTTP/1.1 ${status} Forbidden\r\nConnection: close\r\n\r\n`);
    if (
      revoked ||
      req.url !== "registry.npmjs.org:443" ||
      sockets.size > 8 ||
      ++transfers > 256
    ) {
      refuse();
      return;
    }
    let upstream;
    try {
      const addresses = await Promise.race([
        resolve("registry.npmjs.org", { family: 4, all: true, verbatim: true }),
        new Promise((_, reject) =>
          setTimeout(() => reject(Error("DNS timeout")), 3000).unref(),
        ),
      ]);
      if (
        revoked ||
        client.destroyed ||
        !addresses.length ||
        addresses.some((a) => !publicRegistryAddress(a.address))
      ) {
        refuse();
        return;
      }
      upstream = dial({ host: addresses[0].address, port: 443 });
      sockets.add(upstream);
      upstream.setTimeout(10000, () => upstream.destroy());
      const deadline = setTimeout(() => {
        client.destroy();
        upstream.destroy();
      }, 60000).unref();
      const accountBytes = (chunk) => {
        bytes += chunk.length;
        if (bytes > 512 * 1024 * 1024) {
          client.destroy();
          upstream.destroy();
        }
      };
      upstream.once("connect", () => {
        if (revoked || client.destroyed) {
          upstream.destroy();
          return;
        }
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) {
          accountBytes(head);
          upstream.write(head);
        }
        client.on("data", accountBytes);
        upstream.on("data", accountBytes);
        client.pipe(upstream);
        upstream.pipe(client);
      });
      upstream.on("error", () => client.destroy());
      client.on("error", () => upstream.destroy());
      client.on("close", () => upstream.destroy());
      upstream.on("close", () => {
        clearTimeout(deadline);
        sockets.delete(upstream);
        client.destroy();
      });
    } catch {
      upstream?.destroy();
      refuse(502);
    }
  });
  server.on("clientError", (_error, socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });
  return {
    async close() {
      revoked = true;
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
