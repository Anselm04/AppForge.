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
export default files;
