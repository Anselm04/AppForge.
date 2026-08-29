/**
 * Creative multi-capability orchestrator — additive rewrite of creative-capabilities intent.
 * Plans which studios/capabilities to combine for a user brief without changing buildCapabilities.
 */

import {
  BUILD_CAPABILITIES,
  BUILD_CAPABILITY_IDS,
  type BuildCapabilityId,
  type BuildCapabilityMeta,
} from "./buildCapabilities.js";

export type CreativePlan = {
  primary: BuildCapabilityId;
  supporting: BuildCapabilityId[];
  suggestedStack?: string;
  studioPaths: string[];
  rationale: string;
  steps: string[];
};

const KEYWORD_MAP: Array<{ keywords: string[]; ids: BuildCapabilityId[] }> = [
  {
    keywords: ["architecture", "bim", "building", "floor plan", "zoning"],
    ids: ["architecture", "cad", "graphics"],
  },
  {
    keywords: ["game", "unity", "godot", "phaser", "playable"],
    ids: ["game", "graphics", "music"],
  },
  {
    keywords: ["video", "film", "youtube", "timeline", "render"],
    ids: ["video", "music", "marketing"],
  },
  {
    keywords: ["podcast", "voice", "tts", "narration"],
    ids: ["voice", "music", "marketing"],
  },
  {
    keywords: ["course", "classroom", "lms", "curriculum", "education"],
    ids: ["education", "ar", "graphics"],
  },
  {
    keywords: ["patent", "invention", "prior art", "claims"],
    ids: ["patent", "cad", "graphics"],
  },
  {
    keywords: ["hipaa", "healthcare", "phi", "clinic"],
    ids: ["healthcare", "legal", "data"],
  },
  {
    keywords: ["stripe", "fintech", "payments", "ledger", "kyc"],
    ids: ["fintech", "legal", "data"],
  },
  {
    keywords: ["mobile", "expo", "capacitor", "app store"],
    ids: ["mobile", "graphics", "localization"],
  },
  {
    keywords: ["dashboard", "analytics", "kpi", "bi ", "sql"],
    ids: ["data", "graphics"],
  },
  {
    keywords: ["i18n", "locale", "rtl", "translation"],
    ids: ["localization", "collab"],
  },
  {
    keywords: ["nda", "contract", "terms of service", "privacy policy"],
    ids: ["legal"],
  },
  {
    keywords: ["marketing", "landing page", "seo", "ads", "email campaign"],
    ids: ["marketing", "graphics", "video"],
  },
  {
    keywords: ["ar", "webxr", "augmented"],
    ids: ["ar", "cad", "graphics"],
  },
];

function uniqueIds(ids: BuildCapabilityId[]): BuildCapabilityId[] {
  return [...new Set(ids)];
}

/** Infer a multi-studio plan from free-text brief. */
export function planCreativeBuild(brief: string): CreativePlan {
  const lower = brief.toLowerCase();
  const scored = new Map<BuildCapabilityId, number>();

  for (const row of KEYWORD_MAP) {
    const hits = row.keywords.filter((k) => lower.includes(k)).length;
    if (hits === 0) continue;
    for (const id of row.ids) {
      scored.set(id, (scored.get(id) ?? 0) + hits);
    }
  }

  // Always consider web_search as supporting research when brief is non-trivial
  if (brief.trim().length > 40) {
    scored.set("web_search", (scored.get("web_search") ?? 0) + 0.5);
  }

  const ranked = [...scored.entries()].sort((a, b) => b[1] - a[1]);
  const primary: BuildCapabilityId =
    ranked[0]?.[0] ??
    (BUILD_CAPABILITY_IDS.includes("graphics")
      ? "graphics"
      : BUILD_CAPABILITY_IDS[0]);

  const supporting = uniqueIds(
    ranked
      .slice(1)
      .map(([id]) => id)
      .filter((id) => id !== primary)
      .slice(0, 4),
  );

  const all = [primary, ...supporting];
  const metas = all.map((id) => BUILD_CAPABILITIES[id]);
  const suggestedStack =
    BUILD_CAPABILITIES[primary].suggestedStack ??
    metas.find((m) => m.suggestedStack)?.suggestedStack;

  const studioPaths = uniqueIds(all)
    .map((id) => BUILD_CAPABILITIES[id].studioPath)
    .filter(Boolean);

  const rationale =
    ranked.length > 0
      ? `Matched capabilities from brief keywords; primary=${BUILD_CAPABILITIES[primary].label}.`
      : "No strong keyword match — defaulting to graphics as a flexible creative entry point.";

  const steps = [
    `Open ${BUILD_CAPABILITIES[primary].label} (${BUILD_CAPABILITIES[primary].studioPath})`,
    ...supporting.map(
      (id) =>
        `Optionally use ${BUILD_CAPABILITIES[id].label} (${BUILD_CAPABILITIES[id].studioPath})`,
    ),
    "Enable matching capabilities on Home when starting a build",
    "Attach studio outputs to the project before deploy",
  ];

  return {
    primary,
    supporting,
    suggestedStack,
    studioPaths,
    rationale,
    steps,
  };
}

export function listCreativeStudios(): BuildCapabilityMeta[] {
  return BUILD_CAPABILITY_IDS.filter((id) => id !== "web_search").map(
    (id) => BUILD_CAPABILITIES[id],
  );
}
