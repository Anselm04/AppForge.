/** Detect spatial/system clashes between BIM disciplines (structural vs MEP). */

export type BimElement = {
  id: string;
  discipline:
    "architectural" | "structural" | "mechanical" | "electrical" | "plumbing";
  type: string;
  label?: string;
  x: number;
  y: number;
  z?: number;
  width?: number;
  height?: number;
  depth?: number;
};

export type ClashResult = {
  clashes: Array<{
    elementA: string;
    elementB: string;
    disciplineA: string;
    disciplineB: string;
    severity: "critical" | "warning";
    description: string;
  }>;
  checked: number;
  criticalCount: number;
  warningCount: number;
};

function boxesOverlap(a: BimElement, b: BimElement): boolean {
  const aw = a.width ?? 1;
  const ah = a.height ?? 1;
  const ad = a.depth ?? 1;
  const bw = b.width ?? 1;
  const bh = b.height ?? 1;
  const bd = b.depth ?? 1;
  const az = a.z ?? 0;
  const bz = b.z ?? 0;
  return (
    a.x < b.x + bw &&
    a.x + aw > b.x &&
    a.y < b.y + bh &&
    a.y + ah > b.y &&
    az < bz + bd &&
    az + ad > bz
  );
}

function isCrossDiscipline(a: BimElement, b: BimElement): boolean {
  return a.discipline !== b.discipline;
}

/** Rule-based clash detection on simplified BIM element bounding boxes. */
export function detectBimClashes(elements: BimElement[]): ClashResult {
  const clashes: ClashResult["clashes"] = [];
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i];
      const b = elements[j];
      if (!isCrossDiscipline(a, b)) continue;
      if (!boxesOverlap(a, b)) continue;
      const structuralMep =
        (a.discipline === "structural" &&
          ["mechanical", "electrical", "plumbing"].includes(b.discipline)) ||
        (b.discipline === "structural" &&
          ["mechanical", "electrical", "plumbing"].includes(a.discipline));
      const severity = structuralMep ? "critical" : "warning";
      clashes.push({
        elementA: a.id,
        elementB: b.id,
        disciplineA: a.discipline,
        disciplineB: b.discipline,
        severity,
        description: `${a.label ?? a.type} (${a.discipline}) intersects ${b.label ?? b.type} (${b.discipline})`,
      });
    }
  }
  return {
    clashes,
    checked: elements.length,
    criticalCount: clashes.filter((c) => c.severity === "critical").length,
    warningCount: clashes.filter((c) => c.severity === "warning").length,
  };
}
