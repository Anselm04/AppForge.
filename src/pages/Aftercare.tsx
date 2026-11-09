import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { GlassCard } from "../design-system/GlassCard.js";

const STEPS = [
  "Check your build and download the source.",
  "Choose a host or app store that supports your product.",
  "Use your own provider account and review its fees.",
  "Deploy and check that your product is really live.",
  "Keep backups, updates and renewal dates under control.",
] as const;

// prettier-ignore
export function Aftercare() {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [serviceKey, setServiceKey] = useState("Hosting");
  const [provider, setProvider] = useState("");
  const [monthly, setMonthly] = useState("");
  const [variable, setVariable] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const projects = useQuery({
    queryKey: ["projects", "list"],
    queryFn: () => trpc.projects.list.query(),
    retry: false,
  });
  const selected = projectId ?? projects.data?.[0]?.id ?? null;
  const overview = useQuery({
    queryKey: ["aftercare", "overview", selected],
    queryFn: () => trpc.aftercare.overview.query({ projectId: selected! }),
    enabled: selected !== null,
    retry: false,
  });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback("");
    if (selected === null || !agreed) return;
    const amount = monthly.trim() === "" ? null : Number(monthly);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0 || Math.round(amount * 100) > 10_000_000)) {
      setFeedback("Enter a valid monthly amount, or leave it blank if unknown.");
      return;
    }
    try {
      await trpc.aftercare.saveService.mutate({
        projectId: selected,
        serviceKey,
        provider,
        monthlyUsdCents: amount === null ? null : Math.round(amount * 100),
        variableCost: variable,
        billedTo: "customer",
        notes: "Customer-recorded estimate, not a verified provider invoice",
        accepted: true,
      });
      setFeedback("Your chosen service and cost estimate are saved.");
      setAgreed(false);
      await overview.refetch();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save this service.");
    }
  };

  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selected === null || question.trim().length < 3) return;
    setAnswer("Checking your product details…");
    try {
      const result = await trpc.aftercare.ask.mutate({ projectId: selected, question });
      setAnswer(result.answer);
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Unable to answer right now.");
    }
  };

  return (
    <main className="bg-forge-mesh min-h-screen">
      <div className="forge-container forge-section space-y-6">
        <header>
          <p className="text-sm font-semibold text-forge-cyan">APPFORGE AFTERCARE</p>
          <h1 className="forge-h1 mt-2">Launch, understand and maintain your product</h1>
          <p className="forge-body mt-2">Get clear guidance, track your chosen services and ask for help. No paid service is selected automatically.</p>
        </header>
        <GlassCard hover={false}>
          <h2 className="forge-h3 mb-3">Your product</h2>
          {projects.isLoading && <p role="status">Loading your projects…</p>}
          {projects.isError && <p role="alert">Could not load your projects.</p>}
          {projects.data?.length === 0 && <Link className="text-forge-cyan underline" to="/app/new">Create a product first</Link>}
          {projects.data && projects.data.length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium" htmlFor="aftercare-project">Choose your product</label>
              <select id="aftercare-project" className="forge-input w-full" value={selected ?? ""} onChange={(e) => { setProjectId(Number(e.target.value)); setAnswer(""); }}>
                {projects.data.map((p) => <option key={p.id} value={p.id}>{p.title || `Project #${p.id}`}</option>)}
              </select>
              {selected !== null && <Link className="text-forge-cyan underline text-sm" to={`/build/${selected}`}>Open build and export tools</Link>}
            </div>
          )}
        </GlassCard>
        {selected !== null && <>
          <GlassCard hover={false}>
            <h2 className="forge-h3 mb-3">Choose how to launch</h2>
            <p className="text-sm text-forge-text-muted mb-3">These are destinations supported by your product's technology, not live price quotes or a promise of publication.</p>
            {overview.isLoading && <p role="status">Checking options…</p>}
            {overview.isError && <p role="alert">We could not load your cost records or deployment choices.</p>}
            {overview.data && overview.data.options.length === 0 && <p className="text-sm text-forge-text-muted">No verified automatic deployment destination is currently available for this stack. Export your product and ask support about the native build and release steps.</p>}
            <ul className="space-y-3">
              {overview.data?.options.map((option) => (
                <li key={option.destination} className="rounded-card border border-forge-border p-3">
                  <h3 className="font-semibold">{option.label}</h3>
                  <p className="text-sm text-forge-text-muted">{option.explanation}</p>
                  <p className="text-sm font-medium mt-1">{option.priceNotice}</p>
                </li>
              ))}
            </ul>
            <p className="text-sm text-forge-text-muted mt-3">To deploy using your own credentials, open your project. No new hosting account is purchased here.</p>
          </GlassCard>
          <GlassCard hover={false}>
            <h2 className="forge-h3 mb-2">Your running costs</h2>
            <p className="text-sm">Known monthly amount: <strong>USD ${((overview.data?.total.knownMonthlyUsdCents ?? 0) / 100).toFixed(2)}</strong></p>
            <p className="text-sm text-forge-text-muted mb-3">{overview.data?.total.hasUnknownCosts || !overview.data?.services.length ? "Other usage-based or unknown costs may apply. This is not a live invoice." : "Based on your recorded provider estimates, not live invoices."}</p>
            <ul className="space-y-2 mb-4">
              {overview.data?.services.map((service) => (
                <li key={service.service_key} className="rounded-card border border-forge-border p-3 text-sm">
                  <strong>{service.service_key} — {service.provider}</strong>
                  <p>Monthly estimate: {service.monthly_usd_cents === null ? "Not known" : `USD $${(service.monthly_usd_cents / 100).toFixed(2)}`}{service.variable_cost ? " + possible usage charges" : ""}</p>
                  <p className="text-forge-text-muted">Billed to: customer-owned account</p>
                </li>
              ))}
            </ul>
            <form onSubmit={save} className="space-y-3">
              <h3 className="font-semibold">Record a service you choose</h3>
              <label htmlFor="aftercare-service" className="block text-sm">Service</label>
              <select id="aftercare-service" className="forge-input w-full" value={serviceKey} onChange={(e) => { setServiceKey(e.target.value); setAgreed(false); }}>
                <option>Hosting</option><option>Database</option><option>Domain</option><option>AI provider</option><option>App store</option><option>Other service</option>
              </select>
              <label htmlFor="aftercare-provider" className="block text-sm">Provider you selected</label>
              <input id="aftercare-provider" className="forge-input w-full" required minLength={2} maxLength={120} value={provider} onChange={(e) => { setProvider(e.target.value); setAgreed(false); }} placeholder="Your provider name" />
              <label htmlFor="aftercare-monthly" className="block text-sm">Estimated USD/month (leave blank if unknown)</label>
              <input id="aftercare-monthly" className="forge-input w-full" type="number" min="0" max="100000" step="0.01" value={monthly} onChange={(e) => { setMonthly(e.target.value); setAgreed(false); }} placeholder="Unknown" />
              <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={variable} onChange={(e) => { setVariable(e.target.checked); setAgreed(false); }} />Costs can rise with usage</label>
              <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />I chose this provider and understand that I pay its costs directly after launch.</label>
              <button className="forge-ghost-btn inline-flex min-h-11 items-center px-5 text-sm" type="submit" disabled={!agreed || !provider.trim()}>Save my choice</button>
              {feedback && <p role="status" className="text-sm">{feedback}</p>}
            </form>
          </GlassCard>
          <GlassCard hover={false}>
            <h2 className="forge-h3 mb-2">Ask AppForge about your product</h2>
            <p className="text-sm text-forge-text-muted mb-3">Free project-aware guidance using your saved project and service details. No paid AI calls or infrastructure changes.</p>
            <form onSubmit={ask} className="space-y-3">
              <label htmlFor="aftercare-question" className="block text-sm">What do you need help with?</label>
              <textarea id="aftercare-question" className="forge-input w-full min-h-24" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} required minLength={3} placeholder="How much will my app cost each month?" />
              <button className="forge-ghost-btn inline-flex min-h-11 items-center px-5 text-sm" type="submit">Get guidance</button>
            </form>
            {answer && <p role="status" className="mt-4 whitespace-pre-wrap text-sm">{answer}</p>}
            <Link className="mt-4 inline-block text-forge-cyan underline" to="/help">Open a support case for further help</Link>
          </GlassCard>
          <GlassCard hover={false}>
            <h2 className="forge-h3 mb-3">Your maintenance checklist</h2>
            <ol className="space-y-2 list-decimal pl-6 text-sm">
              {STEPS.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </GlassCard>
        </>}
      </div>
    </main>
  );
}
