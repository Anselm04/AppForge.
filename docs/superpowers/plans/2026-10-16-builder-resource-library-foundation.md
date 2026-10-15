# Builder Resource Library Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the smallest real private Builder Resource Library foundation beneath AppForge's existing ProductContract/capability/pipeline architecture without duplicating working systems.

**Architecture:** Reuse AppForge's existing adapter maturity/evidence vocabulary and existing build capability IDs. Add a private resource manifest plus in-memory registry/query layer first. Selection/adaptation/composition wiring follows only after this foundation is tested and green.

**Tech Stack:** TypeScript, Zod, Vitest, existing AppForge adapter/capability types.

**Spec:** `programme-evidence/builder-resource-library.md`

## Global Constraints

- Preserve ProductContract, ProductPlan, requirement manifests, pipeline, studios, template marketplace, adapter SDK, billing, auth, deployment and recovery systems.
- No paid infrastructure or subscriptions.
- No production-certified resource without required evidence.
- Do not expose the private resource library as the customer-facing template marketplace.
- Do not auto-ingest customer secrets, data, or proprietary content.

## Review Focus

- Invalid or incomplete manifests must fail validation rather than entering the registry.
- Quarantined/deprecated resources must not rank as normal production candidates.
- Stack/platform/capability filters must exclude incompatible resources.
- Production-certified claims must be evidence-backed.
- Registry queries must remain metadata-first and deterministic.

---

### Task 1: Resource Manifest and Registry

**Files:**

- Create: `src/lib/builderResources/resourceManifest.ts`
- Create: `src/lib/builderResources/resourceRegistry.ts`
- Create: `src/lib/builderResources/__tests__/resourceRegistry.test.ts`
- Update: `programme-evidence/builder-resource-library.md`

**Interfaces:**

- Consumes: `BuildCapabilityId`, `AdapterCapabilityState`, `AdapterEvidence`.
- Produces: `BuilderResourceManifest`, `parseBuilderResourceManifest`, `BuilderResourceRegistry`, `queryResources`.

- [ ] **Step 1: Write failing tests** covering manifest validation, compatibility filtering, evidence-gated production certification, quarantine/deprecation exclusion, and deterministic ranking.
- [ ] **Step 2: Run CI and verify RED** because the new resource modules do not yet exist.
- [ ] **Step 3: Implement the minimal manifest and registry/query code** using existing AppForge maturity/capability types.
- [ ] **Step 4: Run focused and full CI; verify GREEN.**
- [ ] **Step 5: Record evidence and exact commit/run IDs in the programme document.**

### Task 2: ProductContract-Aware Selection

**Files:**

- Create: `src/lib/builderResources/resourceSelection.ts`
- Create: `src/lib/builderResources/__tests__/resourceSelection.test.ts`

**Interfaces:**

- Consumes: Task 1 registry/query interfaces plus ProductContract/ProductPlan/requirement manifest metadata.
- Produces: ranked candidate selections with internal rationale/evidence.

- [ ] Write RED tests for requirement fit, stack/platform compatibility, maturity/evidence, licensing, freshness and conflicts.
- [ ] Implement minimal deterministic selector.
- [ ] Verify focused/full tests and typecheck.

### Task 3: Adaptation and Composition Contracts

**Files:**

- Create: `src/lib/builderResources/resourceAdaptation.ts`
- Create: `src/lib/builderResources/resourceComposition.ts`
- Create tests under `src/lib/builderResources/__tests__/`.

**Interfaces:**

- Consumes: selected resource manifests.
- Produces: adaptation plans and conflict reports for routes, migrations, env vars, packages, events, permissions and platform requirements.

- [ ] RED tests first.
- [ ] Implement smallest safe contracts and conflict detection.
- [ ] Verify focused/full tests and typecheck.

### Task 4: Pipeline Integration

**Files:**

- Modify authoritative pipeline parts only after Tasks 1-3 are green.
- Add regression tests proving ProductContract drives resource retrieval and that missing custom functionality still goes through normal generation.

- [ ] RED tests first.
- [ ] Wire selection into existing planning/generation flow without bypasses.
- [ ] Verify full pipeline and golden-path suites.

### Task 5: Resource-Level Repair and Governance

**Files:**

- Add resource regression/quarantine/version tracking integrated with existing repair/evidence systems.

- [ ] RED tests for resource defect vs adaptation/integration/custom-code defect classification.
- [ ] Implement quarantine/demotion/replacement/version recording.
- [ ] Verify full suite and security checks.

### Task 6: Population and Composition Proof

- Audit each requested cross-cutting pack and each of the 19 existing capability categories against actual source.
- Register/reuse real existing implementations first.
- Build only missing reusable implementations, each with tests and honest maturity.
- Add validated reference-architecture compositions only where supported.
- Run Golden Product and secondary composition comparisons without special bypasses.
