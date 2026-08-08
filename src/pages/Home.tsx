import type { CSSProperties } from 'react';

const navy = '#07111f';
const ink = '#10243e';
const muted = '#5d6c80';
const line = '#dbe4ef';
const blue = '#2563eb';

const section: CSSProperties = { maxWidth: 1120, margin: '0 auto', padding: '88px 24px' };
const card: CSSProperties = { border: `1px solid ${line}`, borderRadius: 18, padding: 24, background: '#fff', boxShadow: '0 12px 36px rgba(16,36,62,.06)' };
const label: CSSProperties = { color: blue, fontWeight: 800, fontSize: 12, letterSpacing: '.11em', textTransform: 'uppercase' };

export default function Home() {
  return <main style={{ color: ink, background: '#f8fbff', minHeight: '100vh', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
    <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(248,251,255,.94)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${line}` }}>
      <nav style={{ maxWidth: 1120, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <a href="/" style={{ color: navy, textDecoration: 'none', fontWeight: 900, fontSize: 21 }}>AppForge<span style={{ color: blue }}>.</span></a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 14 }}>
          <a href="#how-it-works" style={{ color: muted, textDecoration: 'none' }}>How it works</a>
          <a href="#outputs" style={{ color: muted, textDecoration: 'none' }}>What you get</a>
          <a href="#safety" style={{ color: muted, textDecoration: 'none' }}>Guardrails</a>
          <a href="/build" style={{ color: '#fff', background: blue, borderRadius: 9, padding: '10px 15px', textDecoration: 'none', fontWeight: 800 }}>Open workspace</a>
        </div>
      </nav>
    </header>

    <section style={{ ...section, paddingTop: 100, paddingBottom: 80, textAlign: 'center' }}>
      <p style={label}>Private beta · Build with clarity</p>
      <h1 style={{ maxWidth: 850, margin: '18px auto', fontSize: 'clamp(42px,7vw,76px)', lineHeight: 1.02, letterSpacing: '-.055em', color: navy }}>Turn a clear idea into a buildable app plan—and then real source code.</h1>
      <p style={{ maxWidth: 710, margin: '0 auto 30px', color: muted, fontSize: 19, lineHeight: 1.65 }}>AppForge helps founders and operators describe what they need, review a structured scope, and generate a constrained source artifact for controlled export and deployment.</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href="/build" style={{ background: blue, color: '#fff', padding: '14px 20px', borderRadius: 10, fontWeight: 800, textDecoration: 'none' }}>Start a build</a>
        <a href="#how-it-works" style={{ border: `1px solid ${line}`, color: ink, background: '#fff', padding: '14px 20px', borderRadius: 10, fontWeight: 800, textDecoration: 'none' }}>See the process</a>
      </div>
      <div style={{ maxWidth: 920, margin: '60px auto 0', padding: 24, borderRadius: 20, background: navy, color: '#dce9ff', textAlign: 'left', boxShadow: '0 25px 70px rgba(7,17,31,.22)' }}>
        <p style={{ margin: '0 0 10px', color: '#8eb5ff', fontWeight: 800, fontSize: 13 }}>EXAMPLE BUILD REQUEST</p>
        <p style={{ margin: 0, fontSize: 18, lineHeight: 1.55 }}>“Create a customer portal where users submit requests, track their status, and receive updates. Include roles for customers and operations staff.”</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginTop: 22 }}>
          {['Scope and assumptions', 'Screens and user flows', 'Data model', 'Source-file manifest'].map((item) => <div key={item} style={{ background: '#10243e', borderRadius: 10, padding: 14, fontWeight: 700 }}>✓ {item}</div>)}
        </div>
      </div>
    </section>

    <section id="how-it-works" style={{ background: '#fff', borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}` }}><div style={section}>
      <p style={label}>A deliberate workflow</p><h2 style={{ fontSize: 42, letterSpacing: '-.04em', margin: '12px 0 14px', color: navy }}>You stay in control at every meaningful step.</h2>
      <p style={{ maxWidth: 680, color: muted, lineHeight: 1.65, fontSize: 17 }}>AppForge is not a “click once, pretend it shipped” product. It makes the build trail visible: plan first, generated artifact next, then export, test, and deployment as distinct steps.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(245px,1fr))', gap: 18, marginTop: 34 }}>
        {[['01','Describe the outcome','Write what the app needs to do, who it is for, and the constraints that matter.'],['02','Review the plan','Check the proposed screens, flows, data needs, assumptions, and exclusions before source generation.'],['03','Generate and ship deliberately','Receive a source artifact, inspect its files, then use controlled export and deployment rather than an unexplained black box.']].map(([n,t,d]) => <article key={n} style={card}><p style={{ ...label, marginTop: 0 }}>{n}</p><h3 style={{ fontSize: 21, margin: '8px 0' }}>{t}</h3><p style={{ marginBottom: 0, color: muted, lineHeight: 1.6 }}>{d}</p></article>)}
      </div>
    </div></section>

    <section id="outputs" style={section}>
      <p style={label}>What AppForge produces</p><h2 style={{ fontSize: 42, letterSpacing: '-.04em', margin: '12px 0 34px', color: navy }}>Useful artifacts, not vague promises.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(245px,1fr))', gap: 18 }}>
        {[['Build plan','A readable definition of the problem, intended users, scope, screens, flows, assumptions, and work still required.'],['Source manifest','A bounded list of generated React/Vite source files with a project name and plain-language summary.'],['Build status','Clear generation, export, build, test, and deployment states—never a fake “complete” signal.'],['Controlled handoff','A deliberate path to GitHub and Vercel, so the code and deployment destination remain yours.']].map(([t,d]) => <article key={t} style={card}><h3 style={{ marginTop: 0, fontSize: 20 }}>{t}</h3><p style={{ marginBottom: 0, color: muted, lineHeight: 1.6 }}>{d}</p></article>)}
      </div>
    </section>

    <section id="safety" style={{ background: navy, color: '#fff' }}><div style={section}>
      <p style={{ ...label, color: '#8eb5ff' }}>Built for honest operations</p><h2 style={{ fontSize: 42, letterSpacing: '-.04em', margin: '12px 0 18px' }}>Clear boundaries make the product more useful.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 18 }}>
        {[['Protected generation','Generation requires a signed-in beta user; provider and database credentials stay server-side.'],['Constrained output','File count, paths, and file sizes are bounded before an artifact is returned.'],['No silent shipping','Generating code does not create a repository, run a deployment, or imply tests passed.'],['Visible readiness','The workspace distinguishes what has been planned, generated, exported, built, and verified.']].map(([t,d]) => <div key={t} style={{ background: '#10243e', border: '1px solid #223b60', borderRadius: 16, padding: 22 }}><h3 style={{ marginTop: 0 }}>{t}</h3><p style={{ color: '#c4d4ed', lineHeight: 1.6, marginBottom: 0 }}>{d}</p></div>)}
      </div>
    </div></section>

    <section style={section}>
      <p style={label}>Built for the early build phase</p><h2 style={{ fontSize: 42, letterSpacing: '-.04em', margin: '12px 0 26px', color: navy }}>Start with the product you can explain.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 18 }}>
        {['Customer portals and request systems','Internal operations tools','Small SaaS product prototypes','Dashboards and workflow apps'].map((item) => <div key={item} style={{ ...card, fontWeight: 750, fontSize: 17 }}>{item}</div>)}
      </div>
    </section>

    <section style={{ background: blue, color: '#fff' }}><div style={{ ...section, textAlign: 'center', paddingTop: 74, paddingBottom: 74 }}>
      <h2 style={{ fontSize: 44, letterSpacing: '-.04em', margin: 0 }}>Ready to turn the idea into a build plan?</h2><p style={{ maxWidth: 650, margin: '16px auto 28px', fontSize: 18, lineHeight: 1.6, color: '#dbeafe' }}>Open the workspace, describe the outcome, and review the plan before anything is generated.</p>
      <a href="/build" style={{ display: 'inline-block', background: '#fff', color: blue, borderRadius: 10, padding: '14px 21px', textDecoration: 'none', fontWeight: 900 }}>Open AppForge workspace</a>
    </div></section>

    <section style={{ ...section, paddingTop: 70, paddingBottom: 70 }}><p style={label}>Questions</p><h2 style={{ fontSize: 36, letterSpacing: '-.04em', color: navy }}>Frequently asked questions</h2>
      <div style={{ display: 'grid', gap: 12, marginTop: 22 }}>{[['Does AppForge deploy automatically?','No. Source generation, export, testing, and deployment are separate visible stages.'],['Can I inspect what was generated?','Yes. The generated artifact includes a file manifest and summary before any controlled export step.'],['Who can use the beta?','Signed-in users with a redeemed beta code can access protected generation.'],['Does this replace engineering review?','No. It accelerates the early build process while preserving explicit review and verification steps.']].map(([q,a]) => <details key={q} style={{ ...card, padding: '18px 22px' }}><summary style={{ fontWeight: 800, cursor: 'pointer' }}>{q}</summary><p style={{ color: muted, lineHeight: 1.6, marginBottom: 0 }}>{a}</p></details>)}</div>
    </section>

    <footer style={{ borderTop: `1px solid ${line}`, padding: '28px 24px', color: muted, textAlign: 'center', fontSize: 14 }}>AppForge private beta · Plan clearly. Build deliberately.</footer>
  </main>;
}
