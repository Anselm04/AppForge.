import type { TaskFlowNode } from "./livingTaskFlow.js";

/**
 * Place canonical tasks into dependency layers, not arbitrary grid rows.
 * Cyclic/missing dependencies never cause infinite recursion or fabricated edges.
 */
export function layoutTaskLayers(
  tasks: readonly TaskFlowNode[],
): TaskFlowNode[][] {
  const index = new Map(tasks.map((task) => [task.id, task]));
  const cache = new Map<string, number>();
  const visiting = new Set<string>();
  const depth = (id: string): number => {
    const saved = cache.get(id);
    if (saved !== undefined) return saved;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const task = index.get(id);
    const dependencies = (task?.dependencies ?? []).filter(
      (dependency) => dependency !== id && index.has(dependency),
    );
    const layer = dependencies.length
      ? 1 + Math.max(...dependencies.map(depth))
      : 0;
    visiting.delete(id);
    const bounded = Math.min(layer, tasks.length);
    cache.set(id, bounded);
    return bounded;
  };
  const groups: TaskFlowNode[][] = [];
  for (const task of tasks) {
    const level = depth(task.id);
    (groups[level] ??= []).push(task);
  }
  return groups.filter((group): group is TaskFlowNode[] => !!group?.length);
}
