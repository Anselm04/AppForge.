import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { useNavigate } from "react-router-dom";

interface TierStatus {
  tier: string;
  isPaid: boolean;
  buildsThisMonth: number;
  limit: number | null;
  credits: number;
}

interface Project {
  id: number;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects", "list"],
    queryFn: () => trpc.projects.list.query(),
  });

  const { data: tierStatus } = useQuery({
    queryKey: ["projects", "tierStatus"],
    queryFn: () => trpc.projects.tierStatus.query(),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Tier Status Banner */}
        {tierStatus && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-8 flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-500 dark:text-slate-400">Current plan</span>
              <p className="font-bold text-slate-900 dark:text-white capitalize">
                {tierStatus.tier}
                {tierStatus.isPaid && tierStatus.tier !== "free" && (
                  <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm text-slate-500 dark:text-slate-400">Builds this month</span>
              <p className="font-bold text-slate-900 dark:text-white">
                {tierStatus.buildsThisMonth}
                {tierStatus.limit !== null ? ` / ${tierStatus.limit}` : " / ∞"}
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm text-slate-500 dark:text-slate-400">Credits</span>
              <p className="font-bold text-blue-600 dark:text-blue-400">{tierStatus.credits ?? 0}</p>
            </div>
            {tierStatus.tier === "free" && (
              <button
                onClick={() => navigate("/pricing")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                Upgrade
              </button>
            )}
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
            My Apps
          </h1>
          <button
            onClick={() => navigate("/")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            + New App
          </button>
        </div>

        {isLoading ? (
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        ) : projects?.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-600 dark:text-slate-400 text-lg mb-4">
              You haven't created any apps yet.
            </p>
            <button
              onClick={() => navigate("/")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg inline-block"
            >
              Create Your First App
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map((project: Project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  const statusColors: Record<string, string> = {
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  };

  const canImprove = project.status === "completed" || project.status === "paused";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
      <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">
        {project.title}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
        {project.description}
      </p>
      <div className="flex items-center justify-between mb-4">
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            statusColors[project.status] || statusColors.pending
          }`}
        >
          {project.status}
        </span>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {new Date(project.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/build/${project.id}`)}
          className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          View Build
        </button>
        {canImprove && (
          <button
            onClick={() => navigate(`/ai-builder?projectId=${project.id}&mode=improve`)}
            className="flex-1 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
          >
            Improve
          </button>
        )}
        <button
          onClick={() => navigate(`/ai-builder?projectId=${project.id}&mode=build`)}
          className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          Rebuild
        </button>
      </div>
    </div>
  );
}
