import { Link } from "react-router-dom";
import { useActiveProject } from "../hooks/useActiveProject.js";

type Props = { compact?: boolean };

export function ActiveProjectPicker({ compact }: Props) {
  const { projectId, activeProject, projects, setActiveProject } = useActiveProject();
  if (compact) {
    return (
      <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" value={projectId ?? ""} onChange={(e) => { const id = parseInt(e.target.value, 10); setActiveProject(Number.isFinite(id) && id > 0 ? id : null); }}>
        <option value="">Select project…</option>
        {projects.map((p) => (<option key={p.id} value={p.id}>#{p.id} {p.title || "Untitled"}</option>))}
      </select>
    );
  }
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Active build</p>
          {projectId && activeProject ? (<p className="font-medium text-white">#{projectId} — {activeProject.title || "Untitled"}</p>) : (<p className="text-slate-400 text-sm">Choose a project — studio exports attach automatically.</p>)}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm min-w-[200px]" value={projectId ?? ""} onChange={(e) => { const id = parseInt(e.target.value, 10); setActiveProject(Number.isFinite(id) && id > 0 ? id : null); }}>
            <option value="">Select project…</option>
            {projects.map((p) => (<option key={p.id} value={p.id}>#{p.id} {p.title || "Untitled"} ({p.status})</option>))}
          </select>
          {projectId ? (<Link to={`/build/${projectId}`} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg">Open build</Link>) : (<Link to="/dashboard" className="text-sm bg-slate-600 hover:bg-slate-500 text-white px-3 py-2 rounded-lg">Dashboard</Link>)}
        </div>
      </div>
    </div>
  );
}
