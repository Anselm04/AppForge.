# AppForge Market Intelligence & Launch Design

## Intent

Add a real, evidence-backed commercial intelligence layer to AppForge so a signed-in user can discover and validate an app opportunity, inspect competitor/customer/marketing evidence, turn the validated opportunity into a build prompt, and continue through the existing production build path without creating a parallel generator.

## Goals

- Add an authenticated Opportunity Intelligence workspace.
- Use AppForge's existing live `searchWeb` provider fallback and LLM layer; never fabricate market evidence.
- Produce structured demand, competition, monetization, differentiation, review-pain, marketing-hook, and launch recommendations with explicit source references and confidence.
- Calculate a deterministic 0-100 opportunity score from bounded sub-scores returned by the evidence-constrained analysis.
- Provide BUILD / VALIDATE_MORE / DO_NOT_BUILD guidance.
- Generate a build-ready product brief that can prefill the existing `/app/new` flow; `projects.create` remains the only production build entry point.
- Surface a publishing-readiness checklist for web, Apple App Store, and Google Play based on the requested product, without claiming store submission has occurred.
- Define a clean handoff payload for TrillionAI Marketing / Manager integrations.

## Non-goals

- No fake download, revenue, ad-spend, ranking, or conversion estimates.
- No scraping behind authentication, bypassing anti-bot controls, or violating store/platform terms.
- No replacement of the existing build queue or `projects.create` guards.
- No claim of one-click App Store / Play Store publication until required credentials, signing, API permissions, packaging, and store review are genuinely wired and verified.

## Architecture

Use one new `marketIntelligence` tRPC router backed by a focused service. The service executes several live search queries through the existing `searchWeb` abstraction, deduplicates sources, then asks the configured AppForge planner model to return JSON constrained to the supplied evidence. Zod validates and clamps model output before deterministic scoring and recommendation logic runs.

The React control-plane gets a protected `/intelligence` page. A successful report shows evidence, score cards, customer pain points, marketing hooks, monetization options, launch-readiness requirements, and a `Build this opportunity` action. That action navigates to `/app/new?idea=...`, and `Home` consumes the query parameter only as an initial prompt draft; the normal authenticated/captcha/moderation/credit/intake pipeline still owns creation.

## Data truth rules

- Every factual market claim must cite one or more source IDs returned by `searchWeb`.
- Source IDs must exist in the report's source list.
- If live sources are unavailable, analysis fails visibly rather than falling back to invented data.
- Numeric sub-scores are judgments over cited evidence, not assertions of private market metrics.
- Opportunity score formula: demand 30%, monetization 20%, differentiation 20%, marketing reach 15%, inverse competition 15%.

## Interfaces

`marketIntelligence.analyze({ idea, audience?, region?, maxSources? })` returns:

- `score`, `recommendation`, `confidence`
- bounded component scores
- `summary`, `positioning`, `customerPains`, `featureGaps`, `marketingHooks`, `monetization`, `risks`
- `buildBrief`
- `publishingReadiness` for web / Apple / Google
- `marketingHandoff`
- deduplicated `sources` with provider attribution
- `researchedAt`

## Security and cost controls

- Protected procedure only.
- Bounded idea/audience/region input lengths.
- Maximum 18 evidence sources and a fixed small query set per analysis.
- Existing provider configuration decides which live search backend is used.
- No credentials are returned to the browser.

## Approaches considered

1. New standalone intelligence microservice: strongest isolation, but unnecessary operational overhead for the current AppForge architecture.
2. Put research directly inside `projects.create`: automatic but expensive and risky because every build would require market research, and a research outage could block valid builds.
3. **Chosen:** authenticated intelligence router + workspace feeding the existing build intake. It preserves production gates, lets users choose when to pay the research cost, and exposes the same contract later to TrillionAI Manager.

## Acceptance criteria

- Evidence-constrained analysis is reachable only to authenticated users.
- Missing live sources produces an explicit error.
- Invalid or hallucinated citation IDs are removed or rejected before response.
- Scores are clamped 0-100 and final score is deterministic.
- The generated build brief can prefill `/app/new` without bypassing `projects.create`.
- The UI never labels store publishing as completed merely because a readiness recommendation exists.
