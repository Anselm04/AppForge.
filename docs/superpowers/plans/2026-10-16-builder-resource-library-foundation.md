# Builder Resource Library Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the private Builder Resource Library beneath AppForge's existing ProductContract/capability/pipeline architecture without duplicating working systems.

**Architecture:** Reuse AppForge's existing adapter maturity/evidence vocabulary and existing build capability IDs. The private resource architecture remains subordinate to ProductContract and separate from the customer-facing Template Marketplace.

**Tech Stack:** TypeScript, Zod, Vitest, existing AppForge adapter/capability types.

**Spec / evidence:** `programme-evidence/builder-resource-library.md`

## Global constraints

- Preserve ProductContract, ProductPlan, requirement manifests, pipeline, studios, template marketplace, adapter SDK, billing, auth, deployment and recovery systems.
- No paid infrastructure or subscriptions.
- No production-certified resource without required evidence.
- Do not expose the private resource library as the customer-facing template marketplace.
- Do not auto-ingest customer secrets, data, proprietary or identifiable content.
- Generated products remain export-independent unless an AppForge-hosted runtime was explicitly selected.

## Task 1 — Resource manifest and registry

- [x] Write RED tests for manifest validation, compatibility filtering, evidence-gated production certification, quarantine/deprecation exclusion and deterministic ranking.
- [x] Implement the machine-readable resource manifest and deterministic metadata-first registry/query layer.
- [x] Reuse existing AppForge capability and maturity/evidence types rather than creating a parallel maturity system.
- [x] Enforce evidence-gated maturity, provenance/licensing, versioning and export-independence rules.
- [x] Record programme architecture/evidence in `programme-evidence/builder-resource-library.md`.

## Task 2 — ProductContract-aware selection

- [x] Test requirement fit, stack/platform compatibility, maturity/evidence, allowed use, freshness, dependencies and conflicts.
- [x] Implement deterministic selection against ProductContract, ProductPlan and requirement manifest agreement.
- [x] Record selection rationale, requirement IDs, versions and evidence ledger IDs.
- [x] Prefer canonical full reusable resources over narrower components that merely advertise the same broad capability, without bypassing quarantine/compatibility/security gates.

## Task 3 — Adaptation and composition

- [x] Implement adaptation plans with configurable fields and branding/localization/authorization/database/extension hooks.
- [x] Implement composition conflict detection for routes, migrations, package versions, state, navigation, dependencies, environment kinds, APIs, events, permissions, styling, platform capabilities and deployment policy.
- [x] Add deterministic transitive declared-dependency closure before composition.
- [x] Add focused composition conflict-matrix tests.

## Task 4 — Pipeline integration

- [x] Wire private resource planning into the existing authoritative agent-coordination path.
- [x] ProductContract/ProductPlan/requirement manifests remain the source of truth.
- [x] Persist selected resource versions and decision evidence into task context.
- [x] Preserve normal custom generation for missing customer-specific functionality.
- [x] No special Golden Product bypass added.

## Task 5 — Resource-level repair and governance

- [x] Distinguish resource defects, version incompatibility, adaptation defects, composition conflicts and custom-code defects.
- [x] Implement smallest-scope repair decisions.
- [x] Implement promotion, demotion, quarantine, quarantine clearing, deprecation, replacement and semantic versioning.
- [x] Gate customer-build promotion on generalization, sanitization, deduplication, licensing, security, tests and manifest creation.
- [x] Keep newly promoted customer-derived resources at experimental-or-lower maturity until evidence supports promotion.

## Task 6 — Population and composition proof

- [x] Populate all five resource levels: atoms, components, modules, domain packs and reference architectures.
- [x] Populate cross-cutting core packs for auth/account/database/API/storage/notifications/billing/webhooks/jobs/search/analytics/security/observability/monetization.
- [x] Add multiple configurable design families and reusable design-system resources.
- [x] Populate all 19 existing AppForge build-capability categories with source-backed resources and detailed contracts.
- [x] Add substantial reusable booking and research resources.
- [x] Add reference architectures covering the requested major product classes while keeping them composable and ProductContract-subordinate.
- [x] Add metadata-first retrieval/performance measurement.
- [x] Add supply-chain/provenance/license/secret/package-source review.
- [x] Add individual, adaptation, composition and cross-category tests.
- [x] Add normal-intake Golden Product comparison and supported secondary composition validation.
- [x] Report maturity honestly; structural resources are not mislabeled production-certified.

## Final merge gate

Implementation is complete on the programme branch. PR #193 must still satisfy the repository's final whole-branch CI/security/preview/release and relevant native qualification checks before merge. No failed check may be hidden by changing the success criteria; failures must be fixed at the smallest responsible scope.
