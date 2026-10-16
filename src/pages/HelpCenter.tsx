import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "../i18n/LocaleContext.js";
import { GlassCard } from "../design-system/GlassCard.js";
import { Button } from "../design-system/Button.js";
import { trpc } from "../utils/trpc.js";

const TOPICS = [
  { id: "gettingStarted", to: "/app/new" },
  { id: "billing", to: "/pricing" },
  { id: "deploy", to: "/dashboard" },
  { id: "agents", to: "/features/orchestrator" },
] as const;

type CustomerSupportCase = {
  case_ref: string;
  status: string;
  customer_summary: string;
  resolution: string | null;
};

export function HelpCenter() {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("general");
  const [summary, setSummary] = useState("");
  const [caseMessage, setCaseMessage] = useState<string | null>(null);
  const [casePending, setCasePending] = useState(false);
  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 0,
  });
  const { data: cases, refetch: refetchCases } = useQuery({
    queryKey: ["operations", "mySupportCases"],
    queryFn: async (): Promise<CustomerSupportCase[]> =>
      (await trpc.operations.mySupportCases.query()) as CustomerSupportCase[],
    enabled: Boolean(me),
    staleTime: 0,
  });

  const needle = query.trim().toLowerCase();
  const topics = TOPICS.map((topic) => ({
    ...topic,
    title: t(`help.topics.${topic.id}.title`),
    body: t(`help.topics.${topic.id}.body`),
  })).filter(
    (topic) =>
      !needle ||
      topic.title.toLowerCase().includes(needle) ||
      topic.body.toLowerCase().includes(needle),
  );

  const submitCase = async (event: FormEvent) => {
    event.preventDefault();
    setCasePending(true);
    setCaseMessage(null);
    try {
      const created = await trpc.operations.createSupportCase.mutate({
        severity: "SEV-3",
        category,
        customerSummary: summary,
      });
      setSummary("");
      setCaseMessage(`Support case ${created.caseRef} opened.`);
      await refetchCases();
    } catch (error) {
      setCaseMessage(
        error instanceof Error ? error.message : "Unable to open support case.",
      );
    } finally {
      setCasePending(false);
    }
  };

  return (
    <div className="bg-forge-mesh">
      <div className="forge-container forge-section">
        <header className="mb-10 max-w-2xl">
          <h1 className="forge-h1 mb-4">{t("help.title")}</h1>
          <p className="forge-body">{t("help.subtitle")}</p>
          <a
            href="mailto:anselm.perkins@gmail.com"
            className="mt-4 inline-block text-forge-cyan hover:underline"
          >
            Contact AppForge support: anselm.perkins@gmail.com
          </a>
        </header>

        <Link
          to="/resend-verification"
          className="mb-6 block text-forge-cyan hover:underline"
        >
          Resend your verification email
        </Link>
        <label htmlFor="help-search" className="sr-only">
          {t("help.search")}
        </label>
        <input
          id="help-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("help.search")}
          className="forge-input mb-8 max-w-md"
        />

        {topics.length === 0 ? (
          <p className="text-forge-text-muted">{t("common.noResults")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                to={topic.to}
                className="block rounded-card focus:outline-hidden focus-visible:ring-2 focus-visible:ring-forge-cyan/50"
              >
                <GlassCard className="h-full">
                  <h2 className="forge-h3 mb-2">{topic.title}</h2>
                  <p className="text-sm leading-relaxed text-forge-text-muted">
                    {topic.body}
                  </p>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}

        <section
          className="mt-12 max-w-2xl"
          aria-labelledby="support-cases-heading"
        >
          <GlassCard hover={false} padding="lg">
            <h2 id="support-cases-heading" className="forge-h3 mb-3">
              Support cases
            </h2>
            {me ? (
              <>
                <p className="mb-5 text-sm text-forge-text-muted">
                  Open a case without sending passwords, API keys or provider
                  secrets.
                </p>
                <form onSubmit={submitCase} className="space-y-4">
                  <div>
                    <label
                      htmlFor="support-category"
                      className="mb-1 block text-sm font-medium"
                    >
                      Category
                    </label>
                    <select
                      id="support-category"
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      className="forge-input w-full"
                    >
                      <option value="general">General</option>
                      <option value="build-failure">Build failure</option>
                      <option value="billing">Billing or credits</option>
                      <option value="deployment">Deployment</option>
                      <option value="account-security">
                        Account or security
                      </option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="support-summary"
                      className="mb-1 block text-sm font-medium"
                    >
                      What happened?
                    </label>
                    <textarea
                      id="support-summary"
                      className="forge-input min-h-32 w-full"
                      minLength={3}
                      maxLength={4000}
                      required
                      value={summary}
                      onChange={(event) => setSummary(event.target.value)}
                    />
                  </div>
                  {caseMessage && (
                    <p
                      role="status"
                      className="text-sm text-forge-text-muted"
                    >
                      {caseMessage}
                    </p>
                  )}
                  <Button
                    type="submit"
                    loading={casePending}
                    disabled={casePending || summary.trim().length < 3}
                  >
                    Open support case
                  </Button>
                </form>

                {cases && cases.length > 0 && (
                  <div className="mt-8">
                    <h3 className="mb-3 font-semibold">Your recent cases</h3>
                    <ul className="space-y-3">
                      {cases.map((supportCase) => (
                        <li
                          key={supportCase.case_ref}
                          className="rounded-card border border-forge-border p-3 text-sm"
                        >
                          <div className="flex flex-wrap justify-between gap-2">
                            <strong>{supportCase.case_ref}</strong>
                            <span>{supportCase.status}</span>
                          </div>
                          <p className="mt-1 text-forge-text-muted">
                            {supportCase.customer_summary}
                          </p>
                          {supportCase.resolution && (
                            <p className="mt-2">
                              Resolution: {supportCase.resolution}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-forge-text-muted">
                <Link to="/login" className="text-forge-cyan hover:underline">
                  Sign in
                </Link>{" "}
                to open and track an AppForge support case, or use the support
                email above if you cannot access your account.
              </p>
            )}
          </GlassCard>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            to="/about"
            className="forge-ghost-btn inline-flex h-11 items-center px-5 text-sm"
          >
            {t("footer.about")}
          </Link>
          <Link
            to="/shortcuts"
            className="forge-ghost-btn inline-flex h-11 items-center px-5 text-sm"
          >
            {t("shortcuts.title")}
          </Link>
        </div>
      </div>
    </div>
  );
}
