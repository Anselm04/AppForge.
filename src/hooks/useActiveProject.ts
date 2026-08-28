import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";

const STORAGE_KEY = "appforge:activeProjectId";

function readStoredProjectId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Shared active project for Build workspace + Creative Studios (no manual ID entry). */
export function useActiveProject() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [storedId, setStoredId] = useState<number | null>(readStoredProjectId);

  const queryProjectId = searchParams.get("projectId");
  const urlId = queryProjectId ? parseInt(queryProjectId, 10) : null;
  const projectId = urlId && urlId > 0 ? urlId : storedId;

  const setActiveProject = useCallback(
    (id: number | null) => {
      if (id && id > 0) {
        localStorage.setItem(STORAGE_KEY, String(id));
        setStoredId(id);
        const next = new URLSearchParams(searchParams);
        next.set("projectId", String(id));
        setSearchParams(next, { replace: true });
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setStoredId(null);
        const next = new URLSearchParams(searchParams);
        next.delete("projectId");
        setSearchParams(next, { replace: true });
      }
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (urlId && urlId > 0 && urlId !== storedId) {
      localStorage.setItem(STORAGE_KEY, String(urlId));
      setStoredId(urlId);
    }
  }, [urlId, storedId]);

  const { data: projects } = useQuery({
    queryKey: ["projects", "list"],
    queryFn: () => trpc.projects.list.query(),
  });

  const activeProject = useMemo(
    () => projects?.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  return {
    projectId,
    activeProject,
    projects: projects ?? [],
    setActiveProject,
    hasActiveProject: !!projectId && projectId > 0,
  };
}
