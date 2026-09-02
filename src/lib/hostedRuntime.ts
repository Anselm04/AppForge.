/**
 * Public live artifact for generated apps.
 * Generate stores source in Postgres; this module turns it into a
 * self-contained HTML page that anyone can open at /apps/:id — no bundler,
 * no CDN, no extra cloud vendor. Fly serves it from the same app.
 */

import { classifyRecipe, extractEntities } from "./appRecipes.js";

export function publicAppOrigin(): string {
  const raw =
    process.env.CORS_ORIGIN ||
    process.env.APP_URL ||
    "https://appforge-unfurling-moon-9058.fly.dev";
  return String(raw).split(",")[0].trim().replace(/\/$/, "");
}

export function publicAppUrl(projectId: number): string {
  return `${publicAppOrigin()}/apps/${projectId}`;
}

export type HostedKind =
  | "app"
  | "game"
  | "agent"
  | "tool"
  | "software"
  | "website";

export function classifyHostedKind(
  description: string,
  techStack = "",
): HostedKind {
  const t = `${description} ${techStack}`.toLowerCase();
  if (
    /\b(game|phaser|three\.js|three-js|babylon|unity|godot|playable|arcade|platformer)\b/.test(
      t,
    )
  ) {
    return "game";
  }
  if (
    /\b(agent|langchain|langgraph|crewai|autogen|assistant|chatbot|function calling)\b/.test(
      t,
    )
  ) {
    return "agent";
  }
  if (
    /\b(website|landing|marketing|homepage|home page|portfolio|blog|saas site)\b/.test(
      t,
    )
  ) {
    return "website";
  }
  if (
    /\b(tool|calculator|converter|formatter|dashboard|scraper|linter|word count)\b/.test(
      t,
    )
  ) {
    return "tool";
  }
  if (
    /\b(software|desktop|electron|tauri|vscode extension|chrome extension|notes)\b/.test(
      t,
    )
  ) {
    return "software";
  }
  return "app";
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeFiles(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(files || {})) {
    if (typeof value !== "string") continue;
    out[key.replace(/^\/+/, "")] = value;
  }
  return out;
}

function isStandaloneHtml(
  html: string,
  files: Record<string, string>,
): boolean {
  if (!html || html.length < 80) return false;
  if (
    /type=["']module["'][^>]*src=["'][^"']*src\/main\.(tsx|jsx|ts|js)/i.test(
      html,
    )
  ) {
    return false;
  }
  if (
    files["package.json"] &&
    files["vite.config.ts"] &&
    /src\/main\./i.test(html)
  ) {
    return false;
  }
  return (
    /<script[\s>]/i.test(html) ||
    /<canvas/i.test(html) ||
    (/<body/i.test(html) && html.length > 600)
  );
}

function rewriteAssetUrls(html: string, projectId: number): string {
  const prefix = `/apps/${projectId}/`;
  return html
    .replace(/(src|href)=["']\/(?!\/|apps\/|live\/)/gi, `$1="${prefix}`)
    .replace(/(src|href)=["']\.\//g, `$1="${prefix}`);
}

function wrapPage(opts: {
  title: string;
  kind: HostedKind;
  body: string;
  script: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(opts.title)}</title>
  <style>
    :root { color-scheme: dark; --bg:#020617; --card:#0f172a; --line:#1e293b; --text:#e2e8f0; --muted:#94a3b8; --accent:#22d3ee; --ok:#34d399; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background:var(--bg); color:var(--text); }
    a { color: var(--accent); }
    header.appbar { border-bottom:1px solid var(--line); padding:14px 20px; display:flex; justify-content:space-between; align-items:center; gap:12px; }
    header.appbar strong { color: var(--accent); letter-spacing:.02em; }
    footer.brand { border-top:1px solid var(--line); padding:16px 20px; color:var(--muted); font-size:12px; }
    .wrap { max-width: 880px; margin: 0 auto; padding: 28px 20px 48px; }
    button, .btn { appearance:none; border:0; background:var(--accent); color:#042f2e; font-weight:600; border-radius:10px; padding:10px 16px; cursor:pointer; font: inherit; }
    button.ghost { background: transparent; color: var(--text); border:1px solid var(--line); }
    button:disabled { opacity:.5; cursor:not-allowed; }
    input, textarea, select { width:100%; background:#020617; color:var(--text); border:1px solid var(--line); border-radius:10px; padding:10px 12px; font: inherit; }
    textarea { min-height: 120px; }
    .card { background: var(--card); border:1px solid var(--line); border-radius:16px; padding:16px; }
    .row { display:flex; gap:8px; align-items:center; }
    .muted { color: var(--muted); font-size: 13px; }
    .ok { color: var(--ok); font-weight: 600; }
    canvas { background:#020617; border:1px solid var(--line); border-radius:12px; display:block; width:min(640px,100%); height:auto; touch-action: none; }
    ul.list { list-style:none; padding:0; margin:16px 0 0; }
    ul.list li { display:flex; gap:10px; align-items:center; padding:10px 12px; border:1px solid var(--line); border-radius:12px; margin-bottom:8px; background:#0b1220; }
    .done { text-decoration: line-through; color: var(--muted); }
    .msg { margin: 8px 0; padding: 10px 12px; border-radius: 12px; white-space: pre-wrap; }
    .msg.user { background:#164e63; }
    .msg.bot { background:#0f172a; border:1px solid var(--line); }
    .stats { display:grid; grid-template-columns: repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin: 16px 0; }
    .hero { padding: 12px 0 8px; }
    .hero h1 { margin: 0 0 8px; font-size: 1.8rem; }
  </style>
</head>
<body>
  <header class="appbar">
    <strong>${esc(opts.title)}</strong>
    <span class="muted">${esc(opts.kind)} · live</span>
  </header>
  ${opts.body}
  <footer class="brand">
    Built with AppForge by TrillionAI Tech · Founder Anselm Perkins ·
    <a href="mailto:hello@trillionaitech.com">hello@trillionaitech.com</a> ·
    <a href="mailto:support@trillionaitech.com">support@trillionaitech.com</a>
  </footer>
  <script>
${opts.script}
  </script>
</body>
</html>`;
}

function appPage(title: string, entity: string): { body: string; script: string } {
  const safeEntity = entity.replace(/[\\`]/g, "");
  return {
    body: `<div class="wrap">
  <div class="hero"><h1>${esc(title)}</h1><p class="muted">Add ${esc(safeEntity)} items, then mark them done. Saved on this device.</p></div>
  <div class="row">
    <input id="item-input" placeholder="Add a ${esc(safeEntity)}..." maxlength="200" />
    <button type="button" id="add-btn">Add</button>
  </div>
  <p class="muted" id="status">0 open</p>
  <ul class="list" id="list"></ul>
</div>`,
    script: `const KEY=${JSON.stringify("af-app-" + title.slice(0, 40))};
const input=document.getElementById("item-input");
const list=document.getElementById("list");
const status=document.getElementById("status");
let items=JSON.parse(localStorage.getItem(KEY)||"null")||[
  {id:1,text:"Ship first ${safeEntity}",done:false},
  {id:2,text:"Review first ${safeEntity}",done:true}
];
function save(){ localStorage.setItem(KEY, JSON.stringify(items)); }
function render(){
  list.innerHTML="";
  items.forEach((it)=>{
    const li=document.createElement("li");
    const cb=document.createElement("input");
    cb.type="checkbox"; cb.checked=it.done; cb.setAttribute("aria-label","complete");
    cb.onchange=()=>{ it.done=!it.done; save(); render(); };
    const span=document.createElement("span");
    span.textContent=it.text; if(it.done) span.className="done";
    const del=document.createElement("button"); del.className="ghost"; del.textContent="Delete";
    del.onclick=()=>{ items=items.filter(x=>x.id!==it.id); save(); render(); };
    li.append(cb, span, del); list.append(li);
  });
  status.textContent=items.filter(i=>!i.done).length+" open";
}
function add(){
  const t=(input.value||"").trim(); if(!t) return;
  items.push({id:Date.now(), text:t, done:false}); input.value=""; save(); render();
}
document.getElementById("add-btn").onclick=add;
input.addEventListener("keydown",(e)=>{ if(e.key==="Enter") add(); });
render();`,
  };
}

function gamePage(title: string): { body: string; script: string } {
  return {
    body: `<div class="wrap">
  <div class="hero"><h1>${esc(title)}</h1><p class="muted">Move with the pointer. Collect 5 orbs to finish a round.</p></div>
  <p>Score: <strong id="score">0</strong> · Best: <strong id="best">0</strong> · <span id="msg" class="ok"></span></p>
  <canvas id="board" width="640" height="360"></canvas>
  <p class="muted" style="margin-top:10px">Click or tap the canvas to start. Core action: collect orbs.</p>
</div>`,
    script: `const canvas=document.getElementById("board");
const ctx=canvas.getContext("2d");
const scoreEl=document.getElementById("score");
const bestEl=document.getElementById("best");
const msgEl=document.getElementById("msg");
const BEST_KEY="af-game-best";
bestEl.textContent=localStorage.getItem(BEST_KEY)||"0";
let px=320, py=180, score=0, running=false, orbs=[];
function spawn(){ orbs.push({x:40+Math.random()*560, y:40+Math.random()*280, r:10}); }
function reset(){ score=0; orbs=[]; for(let i=0;i<3;i++) spawn(); scoreEl.textContent="0"; msgEl.textContent=""; running=true; }
canvas.addEventListener("pointermove",(e)=>{
  const r=canvas.getBoundingClientRect();
  px=(e.clientX-r.left)*(canvas.width/r.width);
  py=(e.clientY-r.top)*(canvas.height/r.height);
});
canvas.addEventListener("pointerdown",()=>{ if(!running) reset(); });
function loop(){
  ctx.fillStyle="#020617"; ctx.fillRect(0,0,640,360);
  ctx.fillStyle="#22d3ee"; ctx.beginPath(); ctx.arc(px,py,12,0,Math.PI*2); ctx.fill();
  orbs.forEach((o,i)=>{
    ctx.fillStyle="#fbbf24"; ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,Math.PI*2); ctx.fill();
    const dx=px-o.x, dy=py-o.y;
    if(running && dx*dx+dy*dy < (12+o.r)*(12+o.r)){
      orbs.splice(i,1); score++; scoreEl.textContent=String(score); spawn();
      if(score>=5){
        running=false; msgEl.textContent="Round complete — you collected 5 orbs.";
        const best=Math.max(score, parseInt(localStorage.getItem(BEST_KEY)||"0",10));
        localStorage.setItem(BEST_KEY, String(best)); bestEl.textContent=String(best);
      }
    }
  });
  requestAnimationFrame(loop);
}
loop();`,
  };
}

function agentPage(title: string, description: string): { body: string; script: string } {
  return {
    body: `<div class="wrap">
  <div class="hero"><h1>${esc(title)}</h1><p class="muted">Ask a question. The agent replies using this product brief (runs entirely in your browser).</p></div>
  <div class="card" id="log" style="min-height:220px"></div>
  <div class="row" style="margin-top:12px">
    <input id="q" placeholder="Ask the agent..." maxlength="400" />
    <button type="button" id="send">Send</button>
  </div>
</div>`,
    script: `const brief=${JSON.stringify((description || title).slice(0, 400))};
const log=document.getElementById("log");
const q=document.getElementById("q");
function add(role, text){
  const d=document.createElement("div"); d.className="msg "+role; d.textContent=(role==="user"?"You: ":"Agent: ")+text; log.append(d); log.scrollTop=log.scrollHeight;
}
function reply(text){
  const t=text.toLowerCase();
  if(!t.trim()) return "Ask me anything about this product.";
  if(/\\b(hello|hi|hey)\\b/.test(t)) return "Hello — I am the live agent for this AppForge build. How can I help?";
  if(/\\b(what|who|about)\\b/.test(t)) return "This agent is scoped to: "+brief;
  if(/\\b(next|plan|todo|steps)\\b/.test(t)) return "Next steps: 1) try the core action in this UI, 2) download the source ZIP from AppForge, 3) iterate in Chat.";
  if(/\\b(help|how)\\b/.test(t)) return "Type a question and press Send. I answer from the product brief without calling an external API.";
  const words=brief.split(/\\s+/).slice(0,18).join(" ");
  return "Noted. Based on the brief ("+words+"...), stay focused on that outcome and ship a thin vertical slice first.";
}
function send(){
  const text=(q.value||"").trim(); if(!text) return;
  add("user", text); q.value=""; add("bot", reply(text));
}
document.getElementById("send").onclick=send;
q.addEventListener("keydown",(e)=>{ if(e.key==="Enter") send(); });
add("bot", "Ready. Ask me about this product or say next steps.");`,
  };
}

function toolPage(title: string): { body: string; script: string } {
  return {
    body: `<div class="wrap">
  <div class="hero"><h1>${esc(title)}</h1><p class="muted">Paste text. Counts update live. Convert case with one click.</p></div>
  <textarea id="src" placeholder="Type or paste text..."></textarea>
  <div class="stats">
    <div class="card"><div class="muted">Characters</div><div id="chars">0</div></div>
    <div class="card"><div class="muted">Words</div><div id="words">0</div></div>
    <div class="card"><div class="muted">Lines</div><div id="lines">0</div></div>
  </div>
  <div class="row">
    <button type="button" id="upper">UPPERCASE</button>
    <button type="button" class="ghost" id="lower">lowercase</button>
    <button type="button" class="ghost" id="titlecase">Title Case</button>
  </div>
  <p class="ok" id="done" hidden>Converted.</p>
</div>`,
    script: `const src=document.getElementById("src");
function counts(){
  const t=src.value||"";
  document.getElementById("chars").textContent=String(t.length);
  document.getElementById("words").textContent=String(t.trim()? t.trim().split(/\\s+/).length: 0);
  document.getElementById("lines").textContent=String(t? t.split(/\\n/).length: 0);
}
src.addEventListener("input", counts);
document.getElementById("upper").onclick=()=>{ src.value=src.value.toUpperCase(); counts(); document.getElementById("done").hidden=false; };
document.getElementById("lower").onclick=()=>{ src.value=src.value.toLowerCase(); counts(); document.getElementById("done").hidden=false; };
document.getElementById("titlecase").onclick=()=>{ src.value=src.value.replace(/\\w\\S*/g, w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()); counts(); document.getElementById("done").hidden=false; };
counts();`,
  };
}

function softwarePage(title: string): { body: string; script: string } {
  return {
    body: `<div class="wrap">
  <div class="hero"><h1>${esc(title)}</h1><p class="muted">Create a note, save it, open it again. Local-only software workspace.</p></div>
  <input id="ntitle" placeholder="Note title" maxlength="80" />
  <textarea id="nbody" placeholder="Note body" style="margin-top:8px"></textarea>
  <div class="row" style="margin-top:8px">
    <button type="button" id="save">Save note</button>
    <button type="button" class="ghost" id="new">New</button>
  </div>
  <p class="ok" id="saved" hidden>Saved.</p>
  <ul class="list" id="notes"></ul>
</div>`,
    script: `const KEY=${JSON.stringify("af-notes-" + title.slice(0, 40))};
let notes=JSON.parse(localStorage.getItem(KEY)||"[]");
let current=null;
const t=document.getElementById("ntitle");
const b=document.getElementById("nbody");
function persist(){ localStorage.setItem(KEY, JSON.stringify(notes)); }
function render(){
  const ul=document.getElementById("notes"); ul.innerHTML="";
  notes.forEach(n=>{
    const li=document.createElement("li");
    const span=document.createElement("span"); span.textContent=n.title||"Untitled"; span.style.flex="1"; span.style.cursor="pointer";
    span.onclick=()=>{ current=n.id; t.value=n.title; b.value=n.body; };
    const del=document.createElement("button"); del.className="ghost"; del.textContent="Delete";
    del.onclick=(e)=>{ e.stopPropagation(); notes=notes.filter(x=>x.id!==n.id); persist(); render(); };
    li.append(span, del); ul.append(li);
  });
}
document.getElementById("save").onclick=()=>{
  const title=(t.value||"").trim()||"Untitled";
  const body=b.value||"";
  if(current){ const n=notes.find(x=>x.id===current); if(n){ n.title=title; n.body=body; } }
  else { current=Date.now(); notes.unshift({id:current,title,body}); }
  persist(); document.getElementById("saved").hidden=false; render();
};
document.getElementById("new").onclick=()=>{ current=null; t.value=""; b.value=""; document.getElementById("saved").hidden=true; };
render();`,
  };
}

function websitePage(title: string, description: string): { body: string; script: string } {
  return {
    body: `<div class="wrap">
  <div class="hero">
    <h1>${esc(title)}</h1>
    <p class="muted">${esc((description || "A live website generated by AppForge.").slice(0, 220))}</p>
    <div class="row" style="margin-top:12px">
      <a class="btn" href="#signup">Get started</a>
      <a class="btn ghost" href="#features">Features</a>
    </div>
  </div>
  <div id="features" class="stats">
    <div class="card"><strong>Fast</strong><p class="muted">Loads instantly on Fly.</p></div>
    <div class="card"><strong>Useful</strong><p class="muted">Complete the signup action below.</p></div>
    <div class="card"><strong>Yours</strong><p class="muted">Source is in your AppForge project.</p></div>
  </div>
  <div class="card" id="signup">
    <h2 style="margin-top:0">Get started</h2>
    <form id="form">
      <label class="muted">Work email</label>
      <input id="email" type="email" required placeholder="you@company.com" />
      <button type="submit" style="margin-top:10px">Join waitlist</button>
    </form>
    <p class="ok" id="thanks" hidden>You are on the list. We will be in touch at that address.</p>
  </div>
</div>`,
    script: `document.getElementById("form").addEventListener("submit",(e)=>{
  e.preventDefault();
  const email=document.getElementById("email");
  if(!email.value || !email.value.includes("@")) { email.focus(); return; }
  const list=JSON.parse(localStorage.getItem("af-waitlist")||"[]");
  list.push({email:email.value, at:Date.now(), product:${JSON.stringify(title.slice(0, 80))}});
  localStorage.setItem("af-waitlist", JSON.stringify(list));
  document.getElementById("thanks").hidden=false;
  email.value="";
});`,
  };
}

export function materializeHostedHtml(opts: {
  projectId: number;
  title: string;
  description: string;
  techStack?: string;
  files?: Record<string, string>;
}): string {
  const files = normalizeFiles(opts.files || {});
  const title =
    (opts.title || "AppForge app").trim().slice(0, 80) || "AppForge app";
  const description = opts.description || "";
  const kind = classifyHostedKind(description, opts.techStack || "");

  if (
    files["_hosted/index.html"] &&
    files["_hosted/index.html"].includes("<!doctype html")
  ) {
    return files["_hosted/index.html"];
  }

  const index = files["index.html"] || files["public/index.html"] || "";
  if (isStandaloneHtml(index, files)) {
    return rewriteAssetUrls(index, opts.projectId);
  }

  const recipe = classifyRecipe(description);
  const entities = extractEntities(description, 3);
  const entity = entities[0] || "item";

  let page: { body: string; script: string };
  if (kind === "game") page = gamePage(title);
  else if (kind === "agent") page = agentPage(title, description);
  else if (kind === "tool") page = toolPage(title);
  else if (kind === "software") page = softwarePage(title);
  else if (kind === "website") page = websitePage(title, description);
  else page = appPage(title, entity);

  void recipe;
  return wrapPage({ title, kind, body: page.body, script: page.script });
}

export const HOSTED_MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};
