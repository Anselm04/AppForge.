import { useLocale } from "../i18n/LocaleContext.js";
import { BuildPurposeStatement } from "../components/BuildPurposeStatement.js";

export function About() {
  const { t } = useLocale();
  return (
    <div className="min-h-[70vh] bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <img
              src="/appforge-logo.png"
              alt=""
              className="h-12 w-12 rounded-xl"
            />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {t("about.title")}
            </h1>
          </div>
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
            {t("footer.founder")}
          </p>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            {t("about.body")}
          </p>
          <div className="mb-6">
            <BuildPurposeStatement />
          </div>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            {t("footer.ownerOf")}
          </p>
          <div className="flex flex-col gap-2 text-slate-700 dark:text-slate-200">
            <a
              href="mailto:hello@trillionaitech.com"
              className="text-blue-600 hover:text-blue-700"
            >
              hello@trillionaitech.com
            </a>
            <a
              href="mailto:support@trillionaitech.com"
              className="text-blue-600 hover:text-blue-700"
            >
              support@trillionaitech.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
