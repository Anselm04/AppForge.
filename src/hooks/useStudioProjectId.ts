import { useEffect, useState } from "react";
import { useActiveProject } from "./useActiveProject.js";

/** Sync manual project ID input with global Active Project picker. */
export function useStudioProjectId() {
  const { projectId: activeId, hasActiveProject } = useActiveProject();
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    if (hasActiveProject && activeId) {
      setProjectId(String(activeId));
    }
  }, [activeId, hasActiveProject]);

  const parsedProjectId = parseInt(projectId, 10);

  return {
    projectId,
    setProjectId,
    parsedProjectId:
      Number.isFinite(parsedProjectId) && parsedProjectId > 0
        ? parsedProjectId
        : null,
    hasProject: Number.isFinite(parsedProjectId) && parsedProjectId > 0,
  };
}
