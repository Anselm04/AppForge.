export const GOD_CODE_PLAN_IDS = [
  "starter",
  "builder",
  "studio",
  "enterprise",
] as const;

export type GodCodePlanId = (typeof GOD_CODE_PLAN_IDS)[number];

export const GOD_CODE_PLANS: {
  id: GodCodePlanId;
  label: string;
  price: number;
  credits: number;
}[] = [
  { id: "starter", label: "Starter", price: 49, credits: 100 },
  { id: "builder", label: "Builder", price: 149, credits: 400 },
  { id: "studio", label: "Studio", price: 399, credits: 1500 },
  { id: "enterprise", label: "Enterprise", price: 1499, credits: 5000 },
];

export function isGodCodePlanId(value: string | null | undefined): value is GodCodePlanId {
  return GOD_CODE_PLAN_IDS.includes(value as GodCodePlanId);
}

export function getGodCodePlan(id: GodCodePlanId) {
  return GOD_CODE_PLANS.find((p) => p.id === id) ?? GOD_CODE_PLANS[0];
}
