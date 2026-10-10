import assert from "node:assert/strict";
import { validateWithDocker } from "../src/lib/dockerValidator.js";

// Reviewed, dependency-free fixtures only. Never pass customer source or keys
// to a public CI workflow. This proves the Docker adapter, not launch readiness.
const files: Record<string, string> = {
  "package.json": JSON.stringify({
    name: "appforge-isolation-smoke",
    version: "1.0.0",
    scripts: {
      test: "node --test behavior.test.cjs",
      build: "node --check app.cjs",
      start: "node app.cjs",
    },
  }),
  "app.cjs": `
const http = require('node:http');
exports.add = (tasks, title) => [...tasks, { title, done: false }];
if (require.main === module) http.createServer((_req,res) => { res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify({status:'ok'})); }).listen(Number(process.env.PORT || 3000), '0.0.0.0');
`,
  "behavior.test.cjs": `
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { add } = require('./app.cjs');
test('adding a task retains the original list', () => { const original=[]; assert.deepEqual(add(original,'ship'),[{title:'ship',done:false}]); assert.deepEqual(original,[]); });
test('host environment is not inherited', () => assert.equal(process.env.APPFORGE_HOST_SECRET,undefined));
test('runtime testing has no external network', async () => {
 const error = await new Promise((resolve,reject) => {
  const socket=net.connect({host:'1.1.1.1',port:443});
  socket.once('error',resolve);
  socket.once('connect',() => { socket.destroy(); reject(new Error('Network escaped isolation')); });
  socket.setTimeout(1000,() => { socket.destroy(); reject(new Error('Isolation did not reject network access')); });
 });
 assert.ok(['ENETUNREACH','EHOSTUNREACH'].includes(error.code));
});
`,
};
process.env.APPFORGE_HOST_SECRET = "synthetic-isolation-sentinel";
const good = await validateWithDocker(files, "api-service");
assert.ok(
  good && !good.skipped,
  "A functioning Docker daemon is required; this check cannot skip",
);
assert.equal(good.passed, true, JSON.stringify(good));
console.log(
  "Real Docker install, security, behavioral tests, build, network isolation, and HTTP startup passed",
);

const badTests = await validateWithDocker(
  {
    ...files,
    "behavior.test.cjs": "require('node:assert/strict').equal(1,2);",
  },
  "api-service",
);
assert.equal(
  badTests?.passed,
  false,
  "Failed assertions must block validation",
);
assert.equal(badTests?.stage, "docker_node");
console.log("Failing product behavior correctly blocked validation");

const noProduct = await validateWithDocker(
  {
    ...files,
    "app.cjs": "exports.add=(tasks,title)=>[...tasks,{title,done:false}];",
  },
  "api-service",
);
assert.equal(
  noProduct?.passed,
  false,
  "An exited command is not a running product",
);
assert.equal(noProduct?.stage, "docker_node_runtime");
console.log("Missing running product correctly blocked validation");
