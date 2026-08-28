/** Accessibility and life-safety checks on simplified floor-plan data. */

export type RoomElement = {
  id: string;
  name: string;
  type: string;
  areaSqM?: number;
  doorWidthMm?: number;
  hasRamp?: boolean;
};

export type FloorPlanCheck = {
  rooms: RoomElement[];
  corridorWidthMm?: number;
  egressDoorCount?: number;
  floorAreaSqM?: number;
};

export type ComplianceResult = {
  passed: string[];
  warnings: string[];
  failures: string[];
  score: number;
};

const MIN_DOOR_MM = 810;
const MIN_CORRIDOR_MM = 1200;
const MIN_EGRESS_DOORS = 2;

/** Check floor plan against universal design / accessibility heuristics. */
export function checkAccessibilityCompliance(
  plan: FloorPlanCheck,
): ComplianceResult {
  const passed: string[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];

  for (const room of plan.rooms) {
    if (room.doorWidthMm !== undefined) {
      if (room.doorWidthMm >= MIN_DOOR_MM) {
        passed.push(`${room.name}: door width ${room.doorWidthMm}mm OK`);
      } else {
        failures.push(
          `${room.name}: door width ${room.doorWidthMm}mm below ${MIN_DOOR_MM}mm minimum`,
        );
      }
    }
    if (room.type === "entrance" && !room.hasRamp) {
      warnings.push(
        `${room.name}: entrance without ramp — verify level access`,
      );
    }
  }

  if (plan.corridorWidthMm !== undefined) {
    if (plan.corridorWidthMm >= MIN_CORRIDOR_MM) {
      passed.push(`Corridor width ${plan.corridorWidthMm}mm OK`);
    } else {
      failures.push(
        `Corridor width ${plan.corridorWidthMm}mm below ${MIN_CORRIDOR_MM}mm`,
      );
    }
  }

  if (plan.egressDoorCount !== undefined) {
    if (plan.egressDoorCount >= MIN_EGRESS_DOORS) {
      passed.push(`${plan.egressDoorCount} egress doors OK`);
    } else {
      warnings.push(
        `Only ${plan.egressDoorCount} egress door(s) — verify fire egress strategy`,
      );
    }
  }

  const total = passed.length + warnings.length + failures.length || 1;
  const score = Math.round(
    ((passed.length + warnings.length * 0.5) / total) * 100,
  );

  return { passed, warnings, failures, score };
}
