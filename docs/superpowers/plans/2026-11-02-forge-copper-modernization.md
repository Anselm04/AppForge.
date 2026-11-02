# Forge Copper Modernization Implementation Plan

**Goal:** Apply the owner's November 1 visual direction to the current customer experience and release it through the existing production controls.

**Spec:** Owner's explicit November 2 request; refines `docs/superpowers/specs/2026-11-02-landing-experience-redesign.md`.

**Architecture:** Presentation changes over the existing React composer, prompt draft handoff, pricing catalogue and checkout. Use cool white, charcoal, slate and copper; retain the original logo asset and all protected build/billing flows.

**Tech Stack:** React, TypeScript, Tailwind, Vitest, Chromium/Playwright, existing GitHub Actions release.

## Constraints and review focus

- Preserve `/branding/logo-mark.png` byte-for-byte.
- Keep real plan prices/credits and checkout routing; complex compute costs must be visible before purchase.
- Keep voice optional and typed drafts intact through signup.
- Verify desktop/mobile overflow, light/dark contrast and interactive prompt handoff.
- Do not weaken production release gates or bypass a missing provider requirement.

## Tasks

1. Update `src/premiumTheme.css` to explicit copper accents, cool neutrals and graphite dark mode, with solid surfaces and restrained shadows. Keep legacy token names compatible.
2. Centre the composer in `src/pages/LandingPage.tsx`; move workflow beneath it; simplify technical wording. Use boxed plan cards with descriptive plan links and existing prices. Add the same cost expectations above purchase on `src/pages/Pricing.tsx`.
3. Refine `src/components/BuildPromptComposer.tsx` chrome, shared navigation selected states, and `src/pages/Home.tsx` copy. Preserve all handlers and gates.
4. Run existing composer/handoff/home/pricing checks, lint, typecheck and build. Inspect desktop/mobile screenshots and keyboard focus in Chromium; check the logo hash and final diff.
5. Push a reviewable PR, require fresh CI/security/preview evidence, merge and observe normal production deployment. Verify served assets and customer interactions if deployment succeeds; report the exact blocker otherwise.
