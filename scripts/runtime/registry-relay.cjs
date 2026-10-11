// Trusted bridge inside the install namespace. It can reach only the per-run
// Unix gateway mounted by the controller. Never present during offline stages.
const http = require("node:http");
const net = require("node:net");
const { spawn } = require("node:child_process");
const server = http.createServer((_req, res) => {
  res.writeHead(405);
  res.end();
});
server.headersTimeout = 3000;
server.on("connect", (req, client, head) => {
  if (req.url !== "registry.npmjs.org:443") {
    client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    return;
  }
  const socket = net.connect("/gateway/registry.sock");
  socket.setTimeout(10000, () => socket.destroy());
  socket.once("connect", () => {
    socket.write(
      "CONNECT registry.npmjs.org:443 HTTP/1.1\r\nHost: registry.npmjs.org:443\r\n\r\n",
    );
    if (head.length) socket.write(head);
    client.pipe(socket);
    socket.pipe(client);
  });
  socket.on("error", () => client.destroy());
  client.on("error", () => socket.destroy());
  socket.on("close", () => client.destroy());
  client.on("close", () => socket.destroy());
});
server.on("clientError", (_error, socket) => socket.destroy());
server.listen(4873, "127.0.0.1", () => {
  const child = spawn("npm", process.argv.slice(2), {
    stdio: "inherit",
    env: { ...process.env, npm_config_https_proxy: "http://127.0.0.1:4873" },
  });
  child.on("error", () => process.exit(1));
  child.on("exit", (code) => process.exit(code ?? 1));
});
