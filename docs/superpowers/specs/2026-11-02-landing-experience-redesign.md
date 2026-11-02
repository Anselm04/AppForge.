# AppForge Landing Experience Redesign

## Intent
Modernise AppForge so the first-run experience feels premium, clear, and easy for non-technical customers without disturbing the working product factory, billing, authentication, publishing, or locked brand identity.

## Goals
- Keep the existing AppForge logo/anvil/A identity and existing action semantics.
- Replace the pale cream feel with a cleaner premium neutral palette while preserving dark mode.
- Make “describe what you want to build” the dominant interaction.
- Support both typing and browser-native speech input when available, with graceful fallback when unavailable.
- Give users clear example prompts without adding clutter.
- Present the real build flow honestly: plan, build, preview, refine, publish/deploy.
- Surface the existing real live-preview capability instead of creating a fake second preview engine.
- Keep the transparent pricing cards and realistic compute/credit expectations visible before signup.
- Preserve the existing `projects.create` path, auth gates, credit checks, moderation, captcha, and build routing.

## Non-goals
- No redesign of the AppForge logo or brand mark.
- No new billing model or price changes.
- No new build backend, deployment backend, or preview backend.
- No automatic store submission claims.
- No fabricated build/demo data presented as a real customer build.

## Constraints
- Existing buttons may be repositioned or restyled but their working routes/actions must remain.
- Public visitors may compose an idea before signing in; the prompt must be saved through the existing prompt-draft mechanism so it survives authentication.
- Signed-in builds still use the existing Home → `projects.create` → `/build/:id` flow.
- The build page remains the authoritative place for real live preview, editing, logs, deployment, and evidence.
- Voice input must never be required; unsupported browsers must still have the full typed workflow.
- Pricing copy must stay consistent with current plan prices, included credits, and published top-up rules.

## Approaches considered
1. **Full builder rewrite on the public landing page.** Rejected because it would duplicate auth/build/preview state and create a second risky execution path.
2. **Cosmetic-only recolour.** Rejected because it would improve mood but not simplify the customer journey.
3. **Presentation-layer redesign over existing flows.** Selected. The public landing page becomes prompt-first and hands off through the existing draft/auth flow; the signed-in Home uses the same interaction pattern; the current Build workspace remains the real preview/refine/publish surface.

## Experience
### Public landing
- Locked logo and AppForge wordmark remain prominent but scaled to leave room for the product interaction.
- Hero copy is shorter and customer-facing.
- Large prompt composer includes textarea, microphone control, suggestion chips, and one clear “Build with AppForge” action.
- Submitting saves the prompt and sends unauthenticated users through signup/login before returning to the builder.
- Beside the composer, a clearly labelled workflow preview explains what happens next without pretending to be a live customer build.
- Pricing cards and the no-hidden-cost panel remain visible lower on the page.

### Signed-in Home
- Same visual language and prompt composer.
- Current plan/credit state remains visible but visually secondary to the build action.
- Existing hCaptcha, clarification, credit-pause, and build mutation logic remain unchanged.
- Suggestion chips only prefill the existing prompt.
- Microphone input only writes text into the existing prompt state.

### Build workspace
- Keep existing `BuildLivePreview` as the real preview engine.
- Improve presentation labels/chrome so preview/design/open actions are easier to understand.
- Do not bypass validation or production-readiness gates.

## Visual direction
- Light mode: cool near-white background, crisp white surfaces, charcoal text, subtle cool borders.
- Brand accent: retain forge gold/copper for primary actions and highlights.
- Secondary accent: restrained steel/cyan for live/build state.
- More whitespace, larger interaction targets, fewer decorative elements competing with the prompt.
- Dark mode remains dark graphite rather than changing its fundamental identity.

## Product-truth rule
The redesign may make AppForge easier to understand, but it must not imply a feature is live, deployed, store-published, or unlimited unless the existing backend state proves it.