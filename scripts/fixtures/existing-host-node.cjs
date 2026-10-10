// Reviewed, dependency-free qualification fixture. Never customer input.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const { execFileSync, spawn } = require("node:child_process");
assert.notEqual(process.getuid(), 0);
assert.equal(process.env.APPFORGE_HOST_SENTINEL, undefined);
for (const path of ["/app", "/root", "/proc/1/environ"])
  assert.equal(fs.existsSync(path), false);

async function main() {
  assert.equal(fs.existsSync("/usr/bin/unshare"), true);
  try {
    execFileSync(
      "/usr/bin/unshare",
      ["--user", "--map-root-user", "/bin/true"],
      { encoding: "utf8", timeout: 1000 },
    );
    throw Error("Nested user namespace escaped the syscall policy");
  } catch (error) {
    assert.match(String(error.stderr), /[Oo]peration not permitted/);
  }

  await new Promise((resolve, reject) => {
    const socket = net.connect({ host: "1.1.1.1", port: 443 });
    socket.once("connect", () => {
      socket.destroy();
      reject(new Error("External networking escaped isolation"));
    });
    socket.once("error", (error) => {
      try {
        assert.ok(["ENETUNREACH", "EHOSTUNREACH"].includes(error.code));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      reject(new Error("Network isolation was not confirmed"));
    });
  });
  const cwd = "/tmp/reviewed-product";
  fs.mkdirSync(cwd);
  const files = {
    "package.json": JSON.stringify({
      name: "reviewed-appforge-fixture",
      version: "1.0.0",
      private: true,
      scripts: {
        test: "node --test test.cjs",
        build: "node build.cjs",
        start: "node dist/server.cjs",
      },
    }),
    "model.cjs":
      'exports.add=(items,text)=>{if(!text.trim())throw Error("empty task");const item={id:items.length+1,text};items.push(item);return item;}',
    "test.cjs":
      'const {test}=require("node:test");const assert=require("node:assert/strict");const {add}=require("./model.cjs");test("task is added and retained",()=>{const items=[];assert.deepEqual(add(items,"first task"),{id:1,text:"first task"});assert.equal(items[0].text,"first task");});test("empty tasks are rejected",()=>assert.throws(()=>add([]," ")));',
    "build.cjs":
      'const fs=require("node:fs");const {Script}=require("node:vm");const source=fs.readFileSync("server.cjs","utf8");new Script(source);fs.mkdirSync("dist");fs.writeFileSync("dist/server.cjs",source);fs.copyFileSync("model.cjs","dist/model.cjs");',
    "server.cjs":
      'const http=require("node:http");const {add}=require("./model.cjs");const items=[];http.createServer(async(req,res)=>{res.setHeader("Content-Type","application/json");if(req.url==="/tasks"&&req.method==="POST"){let body="";for await(const part of req)body+=part;try{const item=add(items,JSON.parse(body).text);res.writeHead(201);res.end(JSON.stringify(item));}catch{res.writeHead(400);res.end("{}");}}else if(req.url==="/tasks"){res.end(JSON.stringify(items));}else{res.end(JSON.stringify({ok:true}));}}).listen(3000,"127.0.0.1");',
  };
  for (const [path, content] of Object.entries(files))
    fs.writeFileSync(cwd + "/" + path, content);
  const options = {
    cwd,
    encoding: "utf8",
    timeout: 10000,
    maxBuffer: 32768,
    env: {
      PATH: process.env.PATH,
      HOME: "/tmp",
      CI: "true",
      npm_config_cache: "/tmp/npm-cache",
      npm_config_update_notifier: "false",
    },
  };
  const publicVersion = execFileSync(
    process.execPath,
    [
      "/gateway/registry-relay.cjs",
      "view",
      "is-number@7.0.0",
      "version",
      "--registry=https://registry.npmjs.org",
      "--https-proxy=http://127.0.0.1:4873",
      "--userconfig=/tmp/empty-config",
      "--globalconfig=/tmp/empty-global-config",
      "--loglevel=error",
    ],
    options,
  ).trim();
  assert.equal(
    publicVersion,
    "7.0.0",
    "restricted npm gateway did not return the reviewed version",
  );
  execFileSync(
    "npm",
    ["install", "--ignore-scripts", "--no-fund", "--loglevel=error"],
    options,
  );
  execFileSync("npm", ["audit", "--audit-level=high"], options);
  execFileSync("npm", ["test"], options);
  execFileSync("npm", ["run", "build"], options);
  for (let attempt = 0; attempt < 3; attempt++) {
    const child = spawn(process.execPath, ["dist/server.cjs"], {
      cwd,
      stdio: "ignore",
      env: options.env,
    });
    let exited = false;
    child.on("exit", () => {
      exited = true;
    });
    child.on("error", () => {
      exited = true;
    });
    try {
      const deadline = Date.now() + 4000;
      let ready = false;
      while (Date.now() < deadline && !exited) {
        try {
          const response = await fetch("http://127.0.0.1:3000/", {
            signal: AbortSignal.timeout(300),
          });
          ready =
            response.status === 200 && (await response.json()).ok === true;
          if (ready) break;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.equal(ready, true, "actual built product did not start");
      const response = await fetch("http://127.0.0.1:3000/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "qualification task " + attempt }),
        signal: AbortSignal.timeout(1000),
      });
      assert.equal(response.status, 201);
      assert.equal(
        (await response.json()).text,
        "qualification task " + attempt,
      );
      const items = await (
        await fetch("http://127.0.0.1:3000/tasks", {
          signal: AbortSignal.timeout(1000),
        })
      ).json();
      assert.deepEqual(items, [
        { id: 1, text: "qualification task " + attempt },
      ]);
    } finally {
      const closed = new Promise((resolve) => child.once("close", resolve));
      child.kill("SIGTERM");
      await Promise.race([
        closed,
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
      if (!exited) child.kill("SIGKILL");
    }
  }
  console.log("SANDBOX_QUALIFIED");
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
