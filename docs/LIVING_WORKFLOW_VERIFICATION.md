# AppForge Living Workflow Canvas — verification register

This document records **implemented behavior**, **local simulation evidence**, and **unverified customer-production behavior**. The approved interface uses light pearl, sky-blue, silver, mint, and subtle lavender tones. Live arrows represent actual task dependencies and recorded state, not scripted marketing progress.

## Execution and visual truth

- The saved `productPlan.tasks` supplies the canonical task IDs, agent ownership, sequence, modules and dependencies.
- `src/agents/.pipeline_parts/part2.txt` supplies actual specialist task events and dependency IDs.
- `src/routes/build.ts` streams authenticated historical and live events; it does not start paid generation simply because a customer opens the Build page.
- `src/lib/livingTaskFlow.ts` deduplicates reconnect activity and projects only recorded task states into the canvas.
- `src/lib/livingTaskLayout.ts` groups tasks by real dependency depth, allowing parallel branches.
- `src/components/LiveSpecialistFlow.tsx` measures task boxes and animates directional connections only when a recorded predecessor is complete and its successor is running.
- `src/components/BuildLivePreview.tsx` remains the authoritative interactive preview, gated by existing artifact readiness and workspace permissions.
- `src/services/build-event-store.ts` supplies a bounded, owner-authorized replay of persisted task milestones for completed projects.

## Eight requirements — acceptance evidence

| Requirement | Implementation/evidence | Verification |
| --- | --- | --- |
| 1. Real-time customer journey | `livingWorkflowCustomerJourney.test.ts` drives the production SSE parser with explicitly mocked local agent events | **Simulated**; no funded generation |
| 2. Smooth truthful arrows | `LiveSpecialistFlow.tsx` connects actual IDs; active handoffs pulse; reduced-motion fallback is present | **Source-verified**, visual-device QA outstanding |
| 3. Full engineering journey | Planning/build stages and `productPlan.tasks` appear as actual stage/task cards, including parallel dependencies | **Source-verified**, product-specific plan coverage varies |
| 4. Live preview | Existing authenticated preview displays validated generated artifacts and supports refresh | **Component tested**, true provider previews unverified |
| 5. Inspectable boxes | Task ID, agent, module, status, attempts, dependencies and generated filenames are inspectable | **Source-verified** |
| 6. Voice instructions | `BuildPromptComposer.tsx` uses supported browser recognition and requires the customer to submit the edited/transcribed text explicitly | **Component tested**, browser microphone hardware QA outstanding |
| 7. Light responsive design | Calm light theme, keyboard-scrollable/touch-scrollable layered canvas and compact layout control | **Source-verified**, device screenshot review outstanding |
| 8. Recovery | Duplicate-event handling, task milestone retention and persisted completed-build replay | **Mocked SSE and contract tests**, live DB recovery drill outstanding |

## Security and commercial invariants

- No user may inspect another customer's build via project ID; the server authorizes ownership before historical replay.
- Browser refresh, reconnect or opening a completed build must not initiate a second generation, charge credits, change billing or deploy anything.
- A queued task is **not** shown as active, nor is a task marked complete without recorded completion.
- Failed and paused jobs must remain visible; retries require recorded execution events.
- No simulated product is presented as a finished generated product.
- No Fly.io access, paid provider keys, external paid integration, live advertising spend or production deployment is required for the local verification suite.

## Final acceptance still requiring explicit evidence

1. Execute real provider generation when a funded key is explicitly supplied, inspect event-to-graph correspondence and validate artifact output.
2. Perform real browser/mobile visual QA for arrow geometry, keyboard/touch navigation, reduced motion, contrast and Safari microphone permissions.
3. Exercise a real local database disconnect/reconnect and completed-session replay with a genuine persisted build.
4. Verify live generated-product preview, modifications, export and customer-owned deployment against a real artifact before claiming the end-to-end product factory is production ready.

These limitations are **test evidence gaps**, not synthetic success states or blanket restrictions placed on AppForge.
