export type StartupReadiness = {
  ready: boolean;
  phase: "booting" | "ready" | "degraded";
  reason: string | null;
  updatedAt: string;
};

let state: StartupReadiness = {
  ready: false,
  phase: "booting",
  reason: "initializing",
  updatedAt: new Date().toISOString(),
};

export function markStartupReady(): void {
  state = {
    ready: true,
    phase: "ready",
    reason: null,
    updatedAt: new Date().toISOString(),
  };
}

export function markStartupDegraded(reason: string): void {
  state = {
    ready: false,
    phase: "degraded",
    reason,
    updatedAt: new Date().toISOString(),
  };
}

export function getStartupReadiness(): StartupReadiness {
  return { ...state };
}

export function resetStartupReadinessForTests(): void {
  state = {
    ready: false,
    phase: "booting",
    reason: "initializing",
    updatedAt: new Date().toISOString(),
  };
}
