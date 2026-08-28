import type { BuildCapabilityId } from "../lib/buildCapabilities.js";
import { buildPurposePrompt } from "../lib/buildPurpose.js";

const HINTS: Record<BuildCapabilityId, string> = {
  web_search: `
WEB RESEARCH was performed before this build. Use the Research brief for current APIs, pricing, and best practices — prefer cited sources over stale training data.
`.trim(),

  video: `
VIDEO CAPABILITY enabled:
- Include a video storyboard component (src/components/VideoStoryboard.tsx) with scene list JSON
- Add public/video/ for assets; support HTML5 video with poster frames
- Export metadata: duration, resolution, codec hints in video/manifest.json
- Consider Remotion-style React video or canvas timeline if stack supports it
`.trim(),

  graphics: `
GRAPHICS CAPABILITY enabled:
- Use attached brand assets from public/assets/ in hero, OG images, and favicon
- shadcn/Tailwind polish: consistent spacing, accessible contrast, responsive layouts
- Include SVG icons and a cohesive color system (primary + neutral palette)
`.trim(),

  music: `
MUSIC CAPABILITY enabled:
- Add src/audio/ with manifest.json (BPM, key, tracks)
- Include Web Audio API or Howler.js player component with play/pause UI
- Lyrics display component if lyrics were provided; sync optional
`.trim(),

  marketing: `
MARKETING CAPABILITY enabled — optimize for traffic, leads, and sales:
- Strong hero with clear value prop + primary CTA above the fold
- Lead capture form (email) with validation; optional waitlist/newsletter
- SEO: meta title/description, Open Graph tags, semantic headings
- Social proof section, pricing table or conversion funnel page
- Analytics hook placeholder (GA4 / Plausible script comment)
`.trim(),

  ar: `
AR CAPABILITY enabled:
- WebXR or AR.js integration with camera permission flow
- 3D model placeholder (glTF) in public/models/
- Hit-test / plane detection UI; "Tap to place" instructions
- Fallback 3D viewer for non-AR browsers (orbit controls)
`.trim(),

  education: `
EDUCATION / TEACHING CAPABILITY enabled (includes AR virtual classroom):
- LMS structure: courses → modules → lessons with progress tracking (studentId, lessonId, completedAt)
- Class scheduling: live sessions with start/end, instructor role, roster enrollment
- AR virtual classroom: WebXR or AR.js room with virtual whiteboard (canvas sync), 3D teaching models (glTF in public/models/education/)
- Interactive AR objects students can place/manipulate during live class; presenter mode for teacher
- Quizzes/assessments with question bank JSON; gradebook stub
- Video/embed support for recorded lectures; chat sidebar for live Q&A
- Accessibility: captions, keyboard nav, screen-reader labels on all lesson UI
- Use RESEARCH BRIEF for current curriculum standards, accreditation, and subject-matter sources
`.trim(),

  patent: `
PATENT / INVENTION CAPABILITY enabled:
- Invention design module: components, functions, how parts interact (store in patent/invention-design.json)
- Prior art research integrated — cite novelty over existing patents/products
- Full patent specification sections: title, field, background, summary, detailed description, claims, abstract
- Jurisdiction-aware filing (USPTO, IPONZ, EPO, IP Australia) with provisional vs complete/non-provisional guidance
- Technical drawings: informal (provisional) and formal (black ink, numbered reference characters) in patent/drawings/
- Reference numeral consistency between description and figures
- User-editable spec UI with version history; LEGAL DISCLAIMER that output is not legal advice — attorney review required
`.trim(),

  architecture: `
ARCHITECTURE / BIM CAPABILITY enabled — full building project delivery:
- Pre-design: client brief, site analysis, zoning/building-code research (use Research brief), budget/feasibility in architecture/brief.json
- Concept: massing, floor plans, material palettes, sustainability/energy strategy in architecture/concept/
- Coordinated BIM: single 3D model JSON (architecture/bim/model.json) generating plans, sections, elevations
- Structural + MEP coordination with clash detection; construction document set in architecture/drawings/
- Accessibility (ramps, egress, universal design) and fire/life-safety strategy stubs
- Site/landscape (grading, planting) and interior fit-out in architecture/site/ and architecture/interiors/
- Permit drawings, bill of quantities, specifications in architecture/permits/ and architecture/specs/
- Construction admin: submittal log, change orders, snagging in architecture/construction/
- Three.js or canvas 3D preview with orbit controls; metric/imperial toggle
- Multi-disciplinary version history; client presentation/approval workflow UI
- LEGAL DISCLAIMER: outputs require licensed architect/engineer review — not stamped professional documents
`.trim(),
};

export function capabilityHintsForPipeline(
  capabilities: BuildCapabilityId[],
): string {
  const purpose = buildPurposePrompt();
  if (capabilities.length === 0) return `\n\n${purpose}\n`;
  const blocks = capabilities
    .map((id) => HINTS[id])
    .filter(Boolean)
    .join("\n\n");
  return `\n\n${purpose}\n\n--- BUILD CAPABILITIES ---\n${blocks}\n--- END CAPABILITIES ---\n`;
}
