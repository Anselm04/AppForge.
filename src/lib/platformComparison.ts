import {
  BUILD_CAPABILITIES,
  BUILD_CAPABILITY_IDS,
  type BuildCapabilityId,
} from "./buildCapabilities.js";

export type CompetitorId =
  "bolt" | "replit" | "lovable" | "v0" | "github_copilot";

export type FeatureRow = {
  id: string;
  category: string;
  feature: string;
  appforge: boolean | "partial" | "studio";
  bolt: boolean | "partial";
  replit: boolean | "partial";
  lovable: boolean | "partial";
  v0: boolean | "partial";
  github_copilot: boolean | "partial";
  notes?: string;
};

/** AppForge vs major AI app builders — used in Creative Studio and capabilities API. */
export const PLATFORM_FEATURE_MATRIX: FeatureRow[] = [
  {
    id: "multi_agent_pipeline",
    category: "Core build",
    feature: "Multi-agent plan → code → validate → review pipeline",
    appforge: true,
    bolt: "partial",
    replit: "partial",
    lovable: "partial",
    v0: false,
    github_copilot: "partial",
  },
  {
    id: "live_web_search",
    category: "Research",
    feature: "Live internet research before/during builds",
    appforge: true,
    bolt: false,
    replit: "partial",
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "in_browser_sandbox",
    category: "Dev environment",
    feature:
      "In-product terminal / npm run dev (WebContainer + server sandbox)",
    appforge: true,
    bolt: true,
    replit: true,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "hmr_preview",
    category: "Dev environment",
    feature: "Instant HMR-linked Monaco + iframe preview",
    appforge: "partial",
    bolt: true,
    replit: "partial",
    lovable: "partial",
    v0: false,
    github_copilot: false,
    notes: "Static preview + sandbox dev proxy when npm run dev is active",
  },
  {
    id: "chat_code_edit",
    category: "Dev environment",
    feature: "Chat edits code without premium agent tier",
    appforge: true,
    bolt: "partial",
    replit: "partial",
    lovable: "partial",
    v0: false,
    github_copilot: true,
  },
  {
    id: "video_studio",
    category: "Creative studios",
    feature: "Video storyboard & export studio",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "music_studio",
    category: "Creative studios",
    feature: "Music & lyrics studio",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "graphics_editor",
    category: "Creative studios",
    feature: "Professional SVG / brand graphics editor",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: "partial",
    v0: "partial",
    github_copilot: false,
  },
  {
    id: "marketing_studio",
    category: "Creative studios",
    feature: "AI marketing copy & funnel assets",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: "partial",
    v0: false,
    github_copilot: false,
  },
  {
    id: "ar_webxr",
    category: "Creative studios",
    feature: "Interactive AR / WebXR attachable to any build",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "education_lms",
    category: "Professional verticals",
    feature: "Course builder + live research + AR virtual classrooms",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "patent_invention",
    category: "Professional verticals",
    feature: "Invention design, prior art, patent specs & drawings",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "architecture_bim",
    category: "Professional verticals",
    feature: "Architecture & BIM — brief through handover, any country",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "game_studio",
    category: "World-leader extensions",
    feature: "Game dev — Unity/Godot-style pipelines + WebGL preview",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "cad_studio",
    category: "World-leader extensions",
    feature: "3D product / CAD — industrial meshes exportable to Three.js",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "legal_studio",
    category: "World-leader extensions",
    feature: "Legal & contracts — NDAs, terms, jurisdiction-aware templates",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "fintech_studio",
    category: "World-leader extensions",
    feature:
      "Finance / fintech — Stripe schemas, ledgers, compliance checklists",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "healthcare_hipaa",
    category: "World-leader extensions",
    feature: "Healthcare / HIPAA — PHI-safe boundaries + audit logging",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "mobile_packaging",
    category: "World-leader extensions",
    feature: "Native mobile — Expo / Capacitor build + store metadata",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "voice_podcast",
    category: "World-leader extensions",
    feature: "Voice / podcast — TTS narration, episode scripts",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "data_bi",
    category: "World-leader extensions",
    feature: "Data / BI — dashboards, SQL schemas, chart components",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "localization_i18n",
    category: "World-leader extensions",
    feature: "Localization — i18n extraction + locale bundles",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "team_collab",
    category: "World-leader extensions",
    feature: "Team realtime collab — multi-user studio editing (Figma-style)",
    appforge: "studio",
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "composable_capabilities",
    category: "Platform",
    feature: "Combine any capabilities on one build (stack + studios)",
    appforge: true,
    bolt: false,
    replit: false,
    lovable: "partial",
    v0: false,
    github_copilot: false,
  },
  {
    id: "org_sso",
    category: "Enterprise",
    feature: "Organizations + SSO (Supabase SAML/OIDC)",
    appforge: true,
    bolt: "partial",
    replit: "partial",
    lovable: false,
    v0: false,
    github_copilot: "partial",
  },
  {
    id: "deploy_wizard",
    category: "Ship",
    feature: "Multi-destination deploy (Fly, Vercel, Netlify, GitHub Pages)",
    appforge: true,
    bolt: true,
    replit: true,
    lovable: true,
    v0: "partial",
    github_copilot: false,
  },
  {
    id: "40_plus_stacks",
    category: "Core build",
    feature: "40+ tech stacks (games, agents, mobile, extensions, 3D)",
    appforge: "partial",
    bolt: "partial",
    replit: "partial",
    lovable: "partial",
    v0: "partial",
    github_copilot: "partial",
    notes:
      "8 golden stacks with full sandbox validation; others scaffold/experimental",
  },
  {
    id: "post_edit_validation",
    category: "Core build",
    feature: "Sandbox re-validation after chat / Senior Dev edits",
    appforge: true,
    bolt: "partial",
    replit: "partial",
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "default_build_research",
    category: "Research",
    feature: "Light web research on every build (not only when search enabled)",
    appforge: true,
    bolt: false,
    replit: "partial",
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "billing_scaffold",
    category: "Ship",
    feature:
      "Stripe billing scaffold (checkout, webhook, entitlements) on income builds",
    appforge: true,
    bolt: "partial",
    replit: "partial",
    lovable: "partial",
    v0: false,
    github_copilot: false,
    notes: "Merged when Fintech enabled or prompt describes paid product",
  },
  {
    id: "revenue_readiness",
    category: "Ship",
    feature: "Revenue readiness score + go-live checklist on Build page",
    appforge: true,
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
  {
    id: "income_preset",
    category: "Ship",
    feature: "One-click income-ready SaaS preset (stack + Fintech + Legal)",
    appforge: true,
    bolt: false,
    replit: false,
    lovable: false,
    v0: false,
    github_copilot: false,
  },
];

export const COMPETITOR_LABELS: Record<CompetitorId, string> = {
  bolt: "Bolt.new",
  replit: "Replit Agent",
  lovable: "Lovable",
  v0: "v0",
  github_copilot: "GitHub Copilot",
};

export function capabilitySummary(): {
  id: BuildCapabilityId;
  label: string;
  icon: string;
  studioPath: string;
  attachable: boolean;
}[] {
  return BUILD_CAPABILITY_IDS.map((id) => ({
    id,
    label: BUILD_CAPABILITIES[id].label,
    icon: BUILD_CAPABILITIES[id].icon,
    studioPath: BUILD_CAPABILITIES[id].studioPath,
    attachable: id !== "web_search",
  }));
}

export function appforgeExclusiveCount(): number {
  return PLATFORM_FEATURE_MATRIX.filter(
    (r) => r.appforge === true || r.appforge === "studio",
  ).filter(
    (r) => !r.bolt && !r.replit && !r.lovable && !r.v0 && !r.github_copilot,
  ).length;
}

export function scorePlatform(platform: "appforge" | CompetitorId): {
  full: number;
  partial: number;
  total: number;
} {
  let full = 0;
  let partial = 0;
  for (const row of PLATFORM_FEATURE_MATRIX) {
    const v = row[platform];
    if (v === true || v === "studio") full++;
    else if (v === "partial") partial++;
  }
  return { full, partial, total: PLATFORM_FEATURE_MATRIX.length };
}

/** All creative capability IDs (excludes web_search). */
export const CREATIVE_CAPABILITY_IDS = BUILD_CAPABILITY_IDS.filter(
  (id) => id !== "web_search",
);

export const FULL_CREATIVE_PRESET: BuildCapabilityId[] = [
  ...BUILD_CAPABILITY_IDS,
];
