import { useState } from "react";
import { Link } from "react-router-dom";
import { useLocale } from "../i18n/LocaleContext.js";
import { GlassCard } from "../design-system/GlassCard.js";

const TOPICS = [
  { id: "gettingStarted", to: "/app/new" },
  { id: "billing", to: "/pricing" },
  { id: "deploy", to: "/dashboard" },
  { id: "agents", to: "/features/orchestrator" },
] as const;

export function HelpCenter() {
  const { t } = useLocale();
  const [query, setQuery] = useState("");

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

  return (
    <div className="bg-forge-mesh">
      <div className="forge-container forge-section">
        <header className="mb-10 max-w-2xl">
          <h1 className="forge-h1 mb-4">{t("help.title")}</h1>
          <p className="forge-body">{t("help.subtitle")}</p>
        </header>

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
                className="block rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-forge-cyan/50"
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
