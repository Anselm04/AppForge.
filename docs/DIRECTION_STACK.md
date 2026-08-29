# Direction stack — leftover Cursor branch intents (rewritten)

This document records how the four leftover Cursor branches were **rewritten as additive modules** and stacked with existing Cursor-built features. **No existing Cursor files were modified.**

## Source branches

| Branch | Original intent | Already on `main` (Cursor) | Additive rewrite (this stack) |
|--------|-----------------|----------------------------|-------------------------------|
| `cursor/architecture-studio-5e66` | Architecture registry, BIM clash/compliance, purpose statement | `ArchitectureStudio`, `architectureStandards`, clash/compliance libs, tests | `src/lib/architectureProcedures.ts` — formal procedure DAG + agent prompt |
| `cursor/leader-improvements-5e66` | BullMQ, docker validation, deploy wizard, moderation | `build-queue` (BullMQ), `dockerValidator`, `DeployWizard`, `mlModeration` | `src/lib/leaderOps.ts` — readiness scoring, queue snapshot, gate helper |
| `cursor/creative-capabilities-5e66` | Multi-studio creative coverage | `buildCapabilities`, Creative Studio + all studio pages | `src/lib/creativeOrchestrator.ts` — multi-capability plan from brief |
| `cursor/fix-typescript-errors-aa9e` | GraphicsEditor type safety | `GraphicsEditor` + graphicsEditor helpers | `src/lib/graphicsEditorTypes.ts` — strict document/node contracts |

## How to use

- **Architecture agents**: call `architectureAgentPrompt(jurisdiction)` when the `architecture` capability is enabled.
- **Deploy / ops UI**: call `scoreDeployReadiness(...)` alongside existing DeployWizard data.
- **Home / studio routing**: call `planCreativeBuild(userBrief)` to suggest primary + supporting studios.
- **Future GraphicsEditor refactors**: import types from `graphicsEditorTypes.ts` without rewriting the page in place.

## Tests

`src/__tests__/directionStack.test.ts` covers all four modules.

## Safety rule

These modules are **additive only**. They import existing Cursor libs; they do not replace or edit them.
