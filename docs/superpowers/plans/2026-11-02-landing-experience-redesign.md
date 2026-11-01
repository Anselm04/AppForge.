# AppForge Landing Experience Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a premium, prompt-first AppForge landing and signed-in build entry experience while preserving the existing production builder, billing, authentication, and live-preview machinery.

**Architecture:** Reuse the existing prompt-draft and `projects.create` flow. Add a focused reusable prompt-composer component for public and signed-in entry surfaces, add a tiny browser speech-input helper with graceful feature detection, refresh the shared light-theme tokens, and improve the existing live-preview chrome without changing its data source or security gates.

**Tech Stack:** React, TypeScript, Tailwind CSS v4 utilities, TanStack Query, existing tRPC client, Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-02-landing-experience-redesign.md`

## Global Constraints
- Keep `/branding/logo-mark.png` and AppForge identity unchanged.
- Preserve `projects.create`, auth/session refresh, hCaptcha, entitlement, moderation, credit, clarification, and `/build/:id` behavior.
- No new paid provider or runtime dependency.
- Voice input is optional progressive enhancement only.
- Public prompt submission must use the existing prompt-draft persistence before authentication.
- Existing plan prices and credit rules remain authoritative.
- Existing `BuildLivePreview` remains the real live-preview engine.

## Review Focus
- Unsupported speech-recognition browser still exposes a fully usable typed composer.
- Public prompt survives authentication handoff instead of being lost.
- Signed-in Home still honors credit pause, hCaptcha, clarification, and current create mutation behavior.
- Theme changes remain readable in both light and dark mode.
- Preview wording never claims a static/blocked/unvalidated output is deployed or production-ready.

---

### Task 1: Prompt composer contract and speech helper

**Files:**
- Create: `src/lib/speechInput.ts`
- Create: `src/components/BuildPromptComposer.tsx`
- Create: `src/__tests__/buildPromptComposer.test.tsx`

**Interfaces:**
- Produces: `BuildPromptComposer` with controlled `value`, `onChange`, `onSubmit`, optional `disabled`, `busy`, `submitLabel`, `placeholder`, and `suggestions` props.
- Produces: `createSpeechRecognition()` returning a recognition instance or `null` without throwing.

- [ ] Write failing tests proving suggestion chips prefill the controlled value, submit calls the supplied handler, microphone control is absent/disabled when speech recognition is unsupported, and recognized text is passed to `onChange` when supported.
- [ ] Run the targeted test and confirm RED because the component/helper do not exist.
- [ ] Implement the helper and composer with no backend calls.
- [ ] Run the targeted test and confirm GREEN.

### Task 2: Public landing prompt-first experience

**Files:**
- Modify: `src/pages/LandingPage.tsx`
- Create: `src/__tests__/landingPromptHandoff.test.tsx`

**Interfaces:**
- Consumes: `BuildPromptComposer` from Task 1.
- Consumes: existing `writePromptDraft`.

- [ ] Write a failing test proving public users can enter an idea, submit it, persist the prompt draft, and navigate to signup/login handoff without calling `projects.create`.
- [ ] Run targeted test and confirm RED.
- [ ] Replace the static hero CTA block with a two-column prompt-first hero: locked logo/wordmark, composer, and clearly labelled workflow preview; keep feature and pricing sections.
- [ ] Run targeted test and confirm GREEN.

### Task 3: Signed-in Home simplification

**Files:**
- Modify: `src/pages/Home.tsx`
- Create or update: `src/__tests__/homePromptExperience.test.tsx`

**Interfaces:**
- Consumes: `BuildPromptComposer` from Task 1.
- Keeps existing Home state and `startBuild`/`handleStartBuild` semantics.

- [ ] Write a failing test proving suggestion/mic edits feed the existing prompt state while the build submit still reaches the current create mutation path.
- [ ] Run targeted test and confirm RED.
- [ ] Replace only the existing textarea/button presentation with the composer while preserving hCaptcha, clarification, errors, credits, and mutation logic.
- [ ] Run targeted test and confirm GREEN.

### Task 4: Premium light palette and landing visual tokens

**Files:**
- Modify: `src/index.css`
- Create: `src/__tests__/themeContract.test.ts`

**Interfaces:**
- Produces: cool near-white light background and crisp surfaces through existing forge CSS variables; dark variables unchanged except contrast-safe dependent values if required.

- [ ] Write a failing source-contract test asserting the deprecated cream values are absent and the selected neutral palette variables are present.
- [ ] Run test and confirm RED.
- [ ] Update only theme variables/mesh values and add reusable composer/preview utility classes if needed.
- [ ] Run test and confirm GREEN.

### Task 5: Live preview chrome clarity

**Files:**
- Modify: `src/components/BuildLivePreview.tsx`
- Create or update: `src/__tests__/buildLivePreview.test.tsx`

**Interfaces:**
- Keeps all preview URL selection, auth, HMR, design mode, iframe sandbox, and refresh behavior unchanged.

- [ ] Write a failing test for clearer preview state labels and accessible action names while preserving iframe sandbox attributes.
- [ ] Run targeted test and confirm RED.
- [ ] Restyle preview header/action chrome using forge tokens and customer-facing wording; do not change preview source logic.
- [ ] Run targeted test and confirm GREEN.

### Task 6: Verification and PR integration

**Files:**
- Update: `docs/landing-pricing-transparency.md` only if the combined redesign changes documented presentation wording.
- Update PR #239 description/title to cover the unified redesign.

- [ ] Run all targeted UI tests.
- [ ] Run full repository test suite through GitHub CI.
- [ ] Require lint/format, typecheck, security scanning, preview deployment, product-factory validation, and production build gates to pass.
- [ ] Review the final diff for billing/auth/build-path changes; none are allowed outside the explicitly preserved presentation wiring.
- [ ] Squash-merge only after the final head is green and mergeable.
