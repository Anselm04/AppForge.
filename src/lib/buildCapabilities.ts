/** Build-time creative & research capabilities users can enable alongside any tech stack. */

export const BUILD_CAPABILITY_IDS = [
  "web_search",
  "video",
  "graphics",
  "music",
  "marketing",
  "ar",
  "education",
  "patent",
  "architecture",
] as const;

export type BuildCapabilityId = (typeof BUILD_CAPABILITY_IDS)[number];

export type BuildCapabilityMeta = {
  id: BuildCapabilityId;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  studioPath: string;
  /** Suggested tech stack when this capability is the primary focus */
  suggestedStack?: string;
};

export const BUILD_CAPABILITIES: Record<
  BuildCapabilityId,
  BuildCapabilityMeta
> = {
  web_search: {
    id: "web_search",
    label: "Live web search",
    shortLabel: "Search",
    description:
      "Real-time internet research before and during builds — current docs, news, and best practices.",
    icon: "🔍",
    studioPath: "/studio",
  },
  video: {
    id: "video",
    label: "Video editing & rendering",
    shortLabel: "Video",
    description:
      "Storyboards, timelines, and WebM export — produce video content inside your project.",
    icon: "🎬",
    studioPath: "/studio/video",
    suggestedStack: "react-node",
  },
  graphics: {
    id: "graphics",
    label: "Graphics design",
    shortLabel: "Graphics",
    description:
      "Professional SVG design, brand assets, and visual polish attached to generated apps.",
    icon: "🎨",
    studioPath: "/editor",
    suggestedStack: "react-node",
  },
  music: {
    id: "music",
    label: "Music & lyrics studio",
    shortLabel: "Music",
    description:
      "Beat patterns, lyric writing, and audio export for apps and marketing.",
    icon: "🎵",
    studioPath: "/studio/music",
    suggestedStack: "react-node",
  },
  marketing: {
    id: "marketing",
    label: "AI marketing",
    shortLabel: "Marketing",
    description:
      "Traffic, leads, and conversion copy — landing pages, ads, email, and SEO.",
    icon: "📈",
    studioPath: "/studio/marketing",
    suggestedStack: "next-node",
  },
  ar: {
    id: "ar",
    label: "Interactive AR",
    shortLabel: "AR",
    description:
      "WebXR / AR.js experiences with 3D anchors, camera overlays, and scene export.",
    icon: "🥽",
    studioPath: "/studio/ar",
    suggestedStack: "three-js-3d",
  },
  education: {
    id: "education",
    label: "Courses & AR classrooms",
    shortLabel: "Education",
    description:
      "Course/class builders with live web research, LMS scaffolding, and AR virtual classrooms (3D models, whiteboards, live interaction).",
    icon: "🎓",
    studioPath: "/studio/education",
    suggestedStack: "react-node",
  },
  patent: {
    id: "patent",
    label: "Invention & patent studio",
    shortLabel: "Patent",
    description:
      "Design inventions, search prior art, draft jurisdiction-aware specifications, generate formal/informal drawings, and edit with version tracking.",
    icon: "📜",
    studioPath: "/studio/patent",
    suggestedStack: "react-node",
  },
  architecture: {
    id: "architecture",
    label: "Architecture & BIM studio",
    shortLabel: "Architecture",
    description:
      "Complete architectural design and delivery — briefing, BIM, construction documents, permits, cost control, and handover for any country.",
    icon: "🏛️",
    studioPath: "/studio/architecture",
    suggestedStack: "three-js-3d",
  },
};

export function isBuildCapabilityId(v: string): v is BuildCapabilityId {
  return (BUILD_CAPABILITY_IDS as readonly string[]).includes(v);
}

export function normalizeCapabilities(raw: unknown): BuildCapabilityId[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is BuildCapabilityId => isBuildCapabilityId(x));
}

export function capabilityList(
  ids: BuildCapabilityId[],
): BuildCapabilityMeta[] {
  return ids.map((id) => BUILD_CAPABILITIES[id]);
}
