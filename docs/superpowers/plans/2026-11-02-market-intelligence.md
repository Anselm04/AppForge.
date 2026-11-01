# AppForge Market Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated, evidence-backed opportunity and marketing intelligence workflow that feeds AppForge's existing production build intake.

**Architecture:** Add a pure scoring/validation library, a market research service built on the existing `searchWeb` + `invokeLLM` stack, a protected tRPC router, and a React workspace. Preserve `projects.create` as the sole production build entry point and use query-prefill only to hand the generated brief into the current Home flow.

**Tech Stack:** TypeScript, React 18, tRPC 11, Zod 4, Vitest, existing AppForge web-search + LLM services.

**Spec:** `docs/superpowers/specs/2026-11-02-market-intelligence-design.md`

## Global Constraints

- Never fabricate market evidence or private metrics.
- Every factual claim must resolve to a returned live source.
- Keep all existing project-create abuse, moderation, entitlement, and build-readiness gates intact.
- No new paid provider dependency is required; reuse configured AppForge providers and visible failure when no live evidence is available.
- Store publishing is represented as readiness requirements, not as completed submission.

## Review Focus

- Model returns out-of-range scores: clamp before final scoring.
- Model cites missing source IDs: strip invalid citations and lower confidence rather than surfacing false evidence.
- Search providers return duplicate URLs: deduplicate before LLM prompt and response.
- Research returns zero sources: explicit BAD_GATEWAY rather than synthetic output.
- Build handoff contains unsafe/oversized query data: encode and cap the generated brief before navigation.

---

### Task 1: Intelligence contract and deterministic scoring

**Files:**
- Create: `src/lib/marketIntelligence.ts`
- Test: `src/__tests__/marketIntelligence.test.ts`

**Interfaces:**
- Produces `MarketIntelligenceAnalysis`, `MarketIntelligenceReport`, `calculateOpportunityScore`, `sanitizeEvidenceRefs`, and `recommendOpportunity`.

- [ ] Write failing tests for clamping, deterministic weighted scoring, recommendation thresholds, and invalid evidence references.
- [ ] Implement the minimal pure library.
- [ ] Run targeted Vitest suite.
- [ ] Commit.

### Task 2: Evidence-backed market research service and router

**Files:**
- Create: `src/services/marketIntelligence.ts`
- Create: `src/routers/marketIntelligence.ts`
- Modify: `src/routers/index.ts`
- Test: `src/__tests__/marketIntelligenceRouter.test.ts`

**Interfaces:**
- Consumes Task 1 types/functions and existing `searchWeb`, `invokeLLM`, `modelForAgent`.
- Produces protected `marketIntelligence.analyze` tRPC mutation.

- [ ] Write failing router/service tests using mocked search and LLM boundaries.
- [ ] Implement bounded multi-query live research, source deduplication, evidence-only structured LLM prompt, parse/validation, deterministic final scoring, readiness and handoff payloads.
- [ ] Register router.
- [ ] Run targeted tests and typecheck.
- [ ] Commit.

### Task 3: Opportunity Intelligence workspace

**Files:**
- Create: `src/pages/OpportunityIntelligence.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/TopNav.tsx`
- Test: `src/__tests__/opportunityIntelligencePage.test.tsx`

**Interfaces:**
- Consumes `trpc.marketIntelligence.analyze`.
- Produces authenticated `/intelligence` workspace and build handoff URL.

- [ ] Write failing UI tests for research form, evidence/error state, scoring/report display, and build handoff.
- [ ] Implement page and protected route.
- [ ] Add discoverable navigation entry without disturbing existing routes.
- [ ] Run targeted tests and typecheck.
- [ ] Commit.

### Task 4: Existing build-flow prefill integration

**Files:**
- Modify: `src/pages/Home.tsx`
- Test: `src/__tests__/marketIntelligenceBuildHandoff.test.tsx`

**Interfaces:**
- Consumes `/app/new?idea=<encoded brief>` from Task 3.
- Produces initial Home description only; all actual creation remains `projects.create`.

- [ ] Write failing test proving query-prefill populates the prompt while the normal mutation remains unchanged.
- [ ] Implement one-time safe prefill with max-length cap and draft precedence rules.
- [ ] Run targeted intake regression tests and typecheck.
- [ ] Commit.

### Task 5: Whole-branch verification and PR

**Files:** no product files unless verification identifies defects.

- [ ] Run market-intelligence tests, existing intake regression tests, lint, and typecheck through CI.
- [ ] Inspect failures and fix only root causes.
- [ ] Open a focused PR against `main` with truthfully stated capabilities and external verification gaps.
