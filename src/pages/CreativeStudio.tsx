import { Link } from "react-router-dom";
import {
  BUILD_CAPABILITIES,
  BUILD_CAPABILITY_IDS,
} from "../lib/buildCapabilities.js";

export function CreativeStudio() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Creative Studio</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-2xl">
          Professional creative tools that plug into your AppForge builds.
          Create assets here, then enable matching capabilities when you
          generate an app — or attach outputs to an existing project.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BUILD_CAPABILITY_IDS.filter((id) => id !== "web_search").map(
            (id) => {
              const meta = BUILD_CAPABILITIES[id];
              return (
                <Link
                  key={id}
                  to={meta.studioPath}
                  className="block bg-white dark:bg-slate-800 rounded-xl p-5 shadow hover:shadow-md border border-slate-200 dark:border-slate-700 transition-shadow"
                >
                  <span className="text-3xl">{meta.icon}</span>
                  <h2 className="text-lg font-semibold mt-3">{meta.label}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    {meta.description}
                  </p>
                  <span className="inline-block mt-4 text-sm text-blue-600 dark:text-blue-400 font-medium">
                    Open studio →
                  </span>
                </Link>
              );
            },
          )}
        </div>

        <div className="mt-10 bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {BUILD_CAPABILITIES.web_search.icon} Live web search
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Enable <strong>Live web search</strong> on the Home page when
              creating a project. The Research agent queries the internet before
              planning so your build uses current documentation and trends.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {BUILD_CAPABILITIES.education.icon}{" "}
              {BUILD_CAPABILITIES.education.label}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Enable <strong>Courses & AR classrooms</strong> on Home or open
              the{" "}
              <Link
                to="/studio/education"
                className="text-blue-600 dark:text-blue-400 underline"
              >
                Education Studio
              </Link>
              . Includes automatic live web research for curriculum content and
              AR virtual classrooms with whiteboards and 3D teaching models.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {BUILD_CAPABILITIES.patent.icon} {BUILD_CAPABILITIES.patent.label}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Open the{" "}
              <Link
                to="/studio/patent"
                className="text-blue-600 dark:text-blue-400 underline"
              >
                Patent Studio
              </Link>{" "}
              to design inventions, search prior art, draft jurisdiction-aware
              specifications, generate drawings, and track versions. Not a
              substitute for a registered patent attorney.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
