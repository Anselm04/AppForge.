// The host verifies HTTP over a private Unix socket; customer stdout cannot
// forge its evidence or exit the host controller with a successful status.
const http = require("node:http");
const { spawn } = require("node:child_process");
const script = process.argv[2];
const args = ["run", script];
if (script === "preview")
  args.push("--", "--host", "127.0.0.1", "--port", "3000", "--strictPort");
const child = spawn("npm", args, {
  stdio: "ignore",
  env: { ...process.env, NODE_ENV: "production", PORT: "3000" },
});
child.on("error", () => process.exit(1));
child.on("exit", () => process.exit(1));
const server = http.createServer((req, res) => {
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: 3000,
      path: req.url,
      method: req.method,
      headers,
      timeout: 1500,
    },
    (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    },
  );
  upstream.on("timeout", () => upstream.destroy());
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.on("error", () => upstream.destroy());
  res.on("close", () => upstream.destroy());
  req.pipe(upstream);
});
server.headersTimeout = 3000;
server.requestTimeout = 5000;
server.listen("/channel/http.sock");
