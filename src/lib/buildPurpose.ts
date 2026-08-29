/**
 * AppForge purpose statement and build boundaries for all add-on capabilities.
 * Any user, anywhere, can combine capabilities to build legitimate projects.
 */

export const APPFORGE_BUILD_PURPOSE = `AppForge add-on capabilities exist so AppForge can build virtually anything a user requests — regardless of who they are or where in the world they are building from. Because we cannot predict every possible combination of what users will want to create, capabilities are added broadly and preemptively across every major build category so no reasonable legitimate request falls outside what AppForge can produce.

The goal is full coverage: any user, anywhere, with any legitimate idea, should be able to describe what they want and have AppForge combine whichever capabilities are needed — live search, video, graphics, music, marketing, AR, education, invention and patent drafting, architecture, game dev, 3D/CAD, legal, fintech, healthcare, mobile packaging, voice/podcast, data/BI, localization, team collab, or future add-ons — to build it for them, in any combination required.`;

export const APPFORGE_BUILD_BOUNDARIES: readonly {
  id: string;
  label: string;
}[] = [
  {
    id: "illegal",
    label:
      "Illegal content, or anything that would help a user break any law in their country or elsewhere",
  },
  {
    id: "harmful",
    label:
      "Unethical, dangerous, or harmful content that could cause injury, exploitation, or harm to any person, animal, or group",
  },
  {
    id: "sexual",
    label: "Sexually explicit content",
  },
  {
    id: "discrimination",
    label:
      "Content that promotes prejudice, racism, or discrimination against any individual or group",
  },
  {
    id: "deception",
    label:
      "Content intended to deceive, defraud, exploit, or take advantage of others",
  },
] as const;

export const APPFORGE_WITHIN_BOUNDARIES =
  "Within those boundaries, AppForge treats every legitimate request as buildable, drawing on whichever combination of its capabilities — current and future — best matches what the user is trying to create.";

/** Inject into Planner/Coder/Reviewer prompts so agents respect build scope. */
export function buildPurposePrompt(): string {
  const boundaryList = APPFORGE_BUILD_BOUNDARIES.map(
    (b, i) => `${i + 1}. ${b.label}`,
  ).join("\n");
  return `
--- APPFORGE BUILD PURPOSE ---
${APPFORGE_BUILD_PURPOSE}

AppForge will build anything requested EXCEPT where the request:
${boundaryList}

${APPFORGE_WITHIN_BOUNDARIES}
--- END BUILD PURPOSE ---
`.trim();
}

/** Short summary for UI surfaces (Home, Creative Studio). */
export function buildPurposeSummary(): string {
  return `${APPFORGE_BUILD_PURPOSE.split("\n\n")[0]} ${APPFORGE_WITHIN_BOUNDARIES}`;
}

/** Categories aligned with moderation — maps boundary id to ML category. */
export const BOUNDARY_MODERATION_CATEGORIES: Record<string, string> = {
  illegal: "illegal",
  harmful: "dangerous",
  sexual: "sexual",
  discrimination: "hate",
  deception: "other",
};
