import { useState } from "react";

const steps = [
  ["01", "Describe", "Tell AppForge what you want to make."],
  ["02", "Plan", "Review screens, data, integrations, scope, and cost before any build starts."],
  ["03", "Build", "A tracked build will generate, test, and repair the project in an isolated workspace."],
  ["04", "Review", "Inspect the preview, source, test results, and deployment before you publish."],
];

const examples = [
  "A client portal for a small accounting firm",
  "A booking app for a mobile dog groomer",
  "A simple inventory dashboard for a local retailer",
];

export default function App() {
  const [idea, setIdea] = useState("");
  const [notice, setNotice] = useState("");

  function startPlanning() {
    setNotice(
      idea.trim()
        ? "AppForge is in private beta. Your idea is ready to discuss with the team; automated generation is not live yet."
        : "Add a short app idea first, then we can help you shape a clear build plan."
    );
  }

  function useExample(example: string) {
    setIdea(example);
    setNotice("");
    document.getElementById("builder")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <main style={{ minHeight: "100vh", background: "#07111f", color: "#eef6ff", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 18% 8%, rgba(65, 161, 255, .22), transparent 27%), radial-gradient(circle at 84% 20%, rgba(140, 92, 246, .18), transparent 25%), linear-gradient(180deg, #07111f 0%, #0a1730 45%, #07111f 100%)" }} />
      <div style={{ position: "relative", maxWidth: 1180, margin: "0 auto", padding: "20px 20px 72px" }}>
        <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "8px 0 34px" }}>
          <a href="#top" style={{ color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", gap: 10, fontWeight: 800, letterSpacing: "-.04em", fontSize: 21 }}>
            <span style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 10, background: "linear-gradient(135deg,#54ccff,#7865ff)", color: "#07111f", boxShadow: "0 10px 30px rgba(70,150,255,.35)" }}>A</span>
            AppForge
          </a>
          <a href="#how" style={{ color: "#c4d5ed", fontSize: 14, textDecoration: "none" }}>How it works</a>
        </nav>

        <section id="top" style={{ padding: "22px 0 50px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", border: "1px solid rgba(126,194,255,.26)", background: "rgba(58,137,235,.11)", color: "#b9e0ff", borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 700 }}>PRIVATE BETA · BUILD WORKSPACE IN DEVELOPMENT</div>
          <h1 style={{ maxWidth: 860, margin: "22px auto 14px", fontSize: "clamp(42px, 8vw, 82px)", lineHeight: .98, letterSpacing: "-.065em" }}>Turn a clear idea into a <span style={{ background: "linear-gradient(90deg,#72d7ff,#b39bff)", WebkitBackgroundClip: "text", color: "transparent" }}>verified build plan.</span></h1>
          <p style={{ maxWidth: 650, margin: "0 auto", color: "#b8c9df", fontSize: "clamp(17px, 2.5vw, 20px)", lineHeight: 1.6 }}>AppForge is becoming a trusted workspace for planning, building, testing, and reviewing web apps. We do not claim a build is ready until its checks pass.</p>
        </section>

        <section id="builder" style={{ maxWidth: 880, margin: "0 auto 62px", padding: 18, borderRadius: 24, background: "linear-gradient(145deg, rgba(20,45,76,.94), rgba(12,29,54,.94))", border: "1px solid rgba(151,205,255,.22)", boxShadow: "0 26px 80px rgba(0,0,0,.24)" }}>
          <label htmlFor="idea" style={{ display: "block", textAlign: "left", fontSize: 14, color: "#d9ebff", fontWeight: 700, margin: "4px 5px 10px" }}>What do you want to build?</label>
          <textarea id="idea" value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Example: a simple client portal where customers can view projects, upload files, and request support." rows={5} style={{ boxSizing: "border-box", width: "100%", resize: "vertical", minHeight: 132, borderRadius: 16, padding: 18, border: "1px solid rgba(165,210,255,.22)", background: "rgba(4,14,30,.78)", color: "#f4f8ff", outline: "none", fontSize: 16, lineHeight: 1.5, fontFamily: "inherit" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 14 }}>
            <span style={{ color: "#91aac7", fontSize: 13 }}>Private beta currently focuses on planning and guided product discovery.</span>
            <button type="button" onClick={startPlanning} style={{ border: 0, borderRadius: 13, padding: "14px 18px", color: "#07111f", background: "linear-gradient(135deg,#71dcff,#9a8cff)", fontWeight: 800, cursor: "pointer", fontSize: 15 }}>Start with a plan →</button>
          </div>
          {notice && <p role="status" style={{ margin: "16px 3px 2px", color: "#bde5ff", fontSize: 14, lineHeight: 1.5 }}>{notice}</p>}
        </section>

        <section style={{ marginBottom: 66 }}>
          <p style={{ textAlign: "center", color: "#98b6d4", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 800, fontSize: 12 }}>Start with a concrete outcome</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginTop: 16 }}>
            {examples.map((example) => <button key={example} type="button" onClick={() => useExample(example)} style={{ color: "#deebfb", textAlign: "left", border: "1px solid rgba(159,201,245,.17)", borderRadius: 16, padding: 18, background: "rgba(22,48,80,.48)", cursor: "pointer", font: "inherit", lineHeight: 1.45 }}>{example}<span style={{ display: "block", color: "#8cdfff", marginTop: 12, fontSize: 13, fontWeight: 700 }}>Use this idea →</span></button>)}
          </div>
        </section>

        <section id="how" style={{ marginBottom: 68 }}>
          <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
            <div><p style={{ color: "#7dd6ff", fontWeight: 800, fontSize: 13, letterSpacing: ".1em", margin: 0 }}>THE STANDARD</p><h2 style={{ fontSize: "clamp(30px,5vw,48px)", letterSpacing: "-.05em", margin: "8px 0 0" }}>Visible progress. Honest results.</h2></div>
            <p style={{ maxWidth: 390, color: "#aac0d9", lineHeight: 1.55, margin: 0 }}>Each future build will show its plan, test status, repairs, preview, source, and deployment decision.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            {steps.map(([number, title, description]) => <article key={number} style={{ padding: 22, borderRadius: 18, background: "rgba(14,37,66,.72)", border: "1px solid rgba(155,201,248,.16)" }}><div style={{ color: "#80ddff", fontWeight: 900, fontSize: 13 }}>{number}</div><h3 style={{ margin: "14px 0 8px", fontSize: 21 }}>{title}</h3><p style={{ margin: 0, color: "#afc3dc", lineHeight: 1.55, fontSize: 15 }}>{description}</p></article>)}
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, alignItems: "stretch" }}>
          <article style={{ borderRadius: 22, padding: 26, background: "linear-gradient(145deg,rgba(32,64,102,.86),rgba(14,34,62,.86))", border: "1px solid rgba(133,205,255,.25)" }}><p style={{ color: "#8ee3ff", fontWeight: 800, margin: 0 }}>PRIVATE BETA STATUS</p><h2 style={{ margin: "10px 0", fontSize: 29, letterSpacing: "-.04em" }}>Planning workspace active</h2><p style={{ color: "#b9cce2", lineHeight: 1.6 }}>Automated code generation, testing, repository creation, and deployment are in development. Paid subscriptions are not offered from this page.</p></article>
          <article style={{ borderRadius: 22, padding: 26, background: "rgba(10,27,49,.82)", border: "1px solid rgba(155,201,248,.16)" }}><p style={{ color: "#8ee3ff", fontWeight: 800, margin: 0 }}>TRUST BY DESIGN</p><h2 style={{ margin: "10px 0", fontSize: 29, letterSpacing: "-.04em" }}>No hidden “done” state</h2><p style={{ color: "#b9cce2", lineHeight: 1.6 }}>A future build will be marked passed only after checks complete. If it needs attention, AppForge will say so and show the reason.</p></article>
        </section>

        <footer style={{ textAlign: "center", color: "#7f9ab7", paddingTop: 54, fontSize: 13 }}>© {new Date().getFullYear()} AppForge · Private beta</footer>
      </div>
    </main>
  );
}
