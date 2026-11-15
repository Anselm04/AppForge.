import assert from "node:assert/strict";
import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { request as nodeHttpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { describe, it } from "vitest";
import JSZip from "jszip";
import { zipFiles } from "../services/deployer.js";
import { parseGeneratedFiles, ensureEssentialFiles } from "../services/multiFileCoder.js";

const domain = [
  'export function normalizeTitle(value) {',
  '  if (typeof value !== "string" || !value.trim() || value.length > 160) throw new Error("Invalid task title");',
  '  return value.trim();',
  '}',
].join("\n");

const server = [
  'import { createServer } from "node:http";',
  'import { readFile, writeFile, mkdir } from "node:fs/promises";',
  'import { join } from "node:path";',
  'import { normalizeTitle } from "./domain.mjs";',
  'const dataPath = join(process.cwd(), "data/tasks.json");',
  'async function load() { try { return JSON.parse(await readFile(dataPath, "utf8")); } catch (error) { if (error.code === "ENOENT") return []; throw error; } }',
  'function respond(res, status, value, type = "application/json") { res.writeHead(status, { "content-type": type }); res.end(type === "application/json" ? JSON.stringify(value) : value); }',
  'const app = createServer(async (req, res) => {',
  '  try {',
  '    if (req.method === "GET" && req.url === "/") return respond(res, 200, await readFile("index.html", "utf8"), "text/html");',
  '    if (req.method === "GET" && req.url === "/api/tasks") return respond(res, 200, await load());',
  '    if (req.method === "POST" && req.url === "/api/tasks") {',
  '      let body = ""; for await (const chunk of req) { body += chunk; if (body.length > 8192) return respond(res, 413, {error: "Too large"}); }',
  '      let title; try { title = normalizeTitle(JSON.parse(body).title); } catch { return respond(res, 400, {error: "Invalid task"}); }',
  '      const tasks = await load(); const task = {id: tasks.length + 1, title, done: false};',
  '      tasks.push(task); await mkdir(join(process.cwd(), "data"), {recursive: true});',
  '      await writeFile(dataPath, JSON.stringify(tasks)); return respond(res, 201, task);',
  '    }',
  '    return respond(res, 404, {error: "Not found"});',
  '  } catch (error) { console.error(error); return respond(res, 500, {error: "Server error"}); }',
  '});',
  'app.listen(0, "127.0.0.1", () => process.stdout.write("PORT=" + app.address().port + "\\n"));',
].join("\n");

const client = '<!doctype html><html><head><title>Carving Tasks</title></head><body><h1>Carving Tasks</h1><form id="create"><input name="title" required maxlength="160"><button type="submit">Add task</button></form><ul id="tasks"></ul><script>const list=document.getElementById("tasks");async function refresh(){const tasks=await(await fetch("/api/tasks")).json();list.replaceChildren(...tasks.map(t=>{const li=document.createElement("li");li.textContent=t.title;return li;}));}document.getElementById("create").addEventListener("submit",async e=>{e.preventDefault();const title=new FormData(e.target).get("title");const res=await fetch("/api/tasks",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title})});if(!res.ok)throw new Error("Unable to save task");e.target.reset();await refresh();});refresh();</script></body></html>';

const coderOutput = [
  "// filename: package.json",
  JSON.stringify({ name: "generated-carving-tasks", private: true, type: "module", scripts: { build: "node --check app.mjs", test: "node --test domain.test.mjs", start: "node app.mjs" } }),
  "// filename: README.md",
  "# Carving Tasks\nRun npm run build, npm test, npm start.",
  "// filename: index.html",
  client,
  "// filename: domain.mjs",
  domain,
  "// filename: app.mjs",
  server,
  "// filename: domain.test.mjs",
  'import test from "node:test"; import assert from "node:assert/strict"; import {normalizeTitle} from "./domain.mjs"; test("validates real task input", () => { assert.equal(normalizeTitle(" carving "), "carving"); assert.throws(() => normalizeTitle(""), /Invalid/); });',
].join("\n");

async function boot(cwd: string): Promise<{ child: ChildProcessWithoutNullStreams; base: string }> {
  const child = spawn(process.execPath, ["app.mjs"], { cwd, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "test" } });
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("Generated application failed to start")); }, 10_000);
    child.stdout.on("data", (part: Buffer) => {
      output += part.toString();
      const port = /PORT=(\d+)/.exec(output)?.[1];
      if (port) { clearTimeout(timer); resolve({child, base: "http://127.0.0.1:" + port}); }
    });
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", code => { clearTimeout(timer); reject(new Error("Generated application exited before startup: " + code)); });
  });
}

async function requestGeneratedApp(
  url: string,
  method = "GET",
  payload?: Record<string, string>,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const bytes = payload ? Buffer.from(JSON.stringify(payload)) : undefined;
    const request = nodeHttpRequest(url, {
      method,
      headers: bytes ? { "content-type": "application/json", "content-length": bytes.length } : {},
      timeout: 5000,
    }, response => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolve({
        status: response.statusCode ?? 0,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("HTTP timeout")));
    request.on("error", reject);
    request.end(bytes);
  });
}

describe("real generated source -> edit -> export -> restart", () => {
  it("executes the generated Node product, saves a task, edits its UI, and reopens persistent data", async () => {
    const root = await mkdtemp(join(tmpdir(), "appforge-executable-export-"));
    let active: ChildProcessWithoutNullStreams | undefined;
    try {
      const files = ensureEssentialFiles(parseGeneratedFiles(coderOutput), "api-service");
      for (const name of ["package.json", "README.md", "index.html", "app.mjs", "domain.mjs", "domain.test.mjs"]) {
        assert.ok(files[name]?.trim(), "Missing actual generated source: " + name);
      }
      const { base64, filename } = await zipFiles("carving-tasks", files);
      assert.match(filename, /carving-tasks-appforge\.zip$/);
      const archive = await JSZip.loadAsync(Buffer.from(base64, "base64"));
      for (const [path, entry] of Object.entries(archive.files)) {
        if (entry.dir) continue;
        assert.ok(!path.startsWith("/") && !path.split("/").includes(".."), "Unsafe export path");
        const source = await entry.async("string");
        assert.equal(source, files[path], "Export must preserve source bytes: " + path);
        const output = join(root, path);
        await mkdir(dirname(output), {recursive: true});
        await writeFile(output, source);
      }
      execFileSync(process.execPath, ["--check", "app.mjs"], {cwd: root, stdio: "pipe"});
      execFileSync(process.execPath, ["--test", "domain.test.mjs"], {cwd: root, stdio: "pipe"});
      let running = await boot(root);
      active = running.child;
      const html = (await requestGeneratedApp(running.base + "/")).body;
      assert.match(html, /<h1>Carving Tasks<\/h1>/);
      let res = await requestGeneratedApp(running.base + "/api/tasks", "POST", { title: "Carve a waka" });
      assert.equal(res.status, 201);
      res = await requestGeneratedApp(running.base + "/api/tasks");
      assert.deepEqual((JSON.parse(res.body) as Array<{ title: string }>).map((x) => x.title), ["Carve a waka"]);
      active.kill("SIGTERM");
      active = undefined;
      const edited = (await readFile(join(root, "index.html"), "utf8")).replace("<h1>Carving Tasks</h1>", "<h1>Carving Tasks Updated</h1>");
      await writeFile(join(root, "index.html"), edited);
      const editedArchive = await zipFiles("carving-tasks", { ...files, "index.html": edited });
      const reopenedZip = await JSZip.loadAsync(Buffer.from(editedArchive.base64, "base64"));
      assert.equal(await reopenedZip.file("index.html")?.async("string"), edited);
      execFileSync(process.execPath, ["--check", "app.mjs"], {cwd: root, stdio: "pipe"});
      running = await boot(root);
      active = running.child;
      assert.match((await requestGeneratedApp(running.base + "/")).body, /Carving Tasks Updated/);
      res = await requestGeneratedApp(running.base + "/api/tasks");
      assert.deepEqual((JSON.parse(res.body) as Array<{ title: string }>).map((x) => x.title), ["Carve a waka"]);
    } finally {
      active?.kill("SIGTERM");
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }, 30_000);
});
