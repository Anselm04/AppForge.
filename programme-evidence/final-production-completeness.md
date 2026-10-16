# AppForge Final Production Completeness Programme Evidence

## Scope lock

This evidence record covers only the approved final production-completeness programme:

A. customer account + data lifecycle
B. AppForge public legal / trust surfaces
C. capability-claim truth system
D. generated-product update / migration / rollback lifecycle
E. customer operations / support / incident handling
F. final repository-wide production-completeness audit

No unrelated product-category expansion, redesign, infrastructure migration, broad refactor or speculative feature work belongs in this programme.

## Baseline

- Repository: `Anselm04/AppForge.`
- Baseline `main` SHA: `d2fae207e103bac5f3bd9692bc6ca5ccafba29fb`
- Baseline meaning: PR #193 Builder Resource Library foundation merged.
- Programme branch: `production-completeness-programme`
- Programme design commit: `8f079b63f059edc374dc66ecb5e84fb86779edf8`
- Programme plan commit: `f058a3cb008885764ff7676b5945c5c582d74c35`
- Deliberate additional infrastructure/service spend: NZ$0.

GitHub can prove committed branch state but cannot prove whether the user's separate Linux desktop checkout has unsaved/uncommitted files. This programme therefore treats the recorded `main` SHA above as the immutable repository baseline and will not make claims about unseen desktop working-tree state.

## Phase 0 — current-state audit

### Preserved existing functionality

The current repository already contains substantial working foundations that this programme must reuse rather than duplicate:

- email/password signup and email verification UX;
- verification resend with cooldown and enumeration-safe messaging;
- social sign-in through identity providers that Supabase reports as enabled;
- password reset/change;
- server/browser session refresh and local/other/global session revocation;
- Stripe subscription checkout, credit packs and billing portal;
- customer/project ownership checks and project source/GitHub export;
- ProductContract, ProductPlan and requirement manifests;
- project snapshots and versioned file writes;
- known-good recovery checkpoints and rollback/forward-repair guidance;
- database-migration safety instructions;
- adapter maturity, lifecycle, quarantine and verification evidence;
- generated-product certification evidence;
- Builder Resource Library resource maturity/version/evidence governance;
- application health/readiness surfaces, metrics and redacted logging expectations;
- Help Center and direct support contact.

### Genuine gaps established by the audit

1. **Account/data lifecycle is incomplete.** Account settings expose password/session controls but not the complete profile/preferences, verified email-change, account export, authoritative retention and account-deletion lifecycle required by this programme.
2. **AppForge's own public legal/trust routes are incomplete.** Public About/Help/Pricing/auth routes exist, but stable AppForge `/privacy`, `/terms`, `/acceptable-use`, `/refund-policy` and `/security` surfaces are absent.
3. **Capability truth has strong backend evidence foundations but incomplete public binding.** Adapter/resource/certification evidence exists, while public feature presentation remains substantially static.
4. **Generated-product evolution is partial.** Versioned writes, snapshots, recovery and migration primitives exist, but there is no first-class persisted machine-readable ChangeContract covering the full requested evolution impact surface.
5. **Support/incident operations are partial.** Help and observability primitives exist, but no complete persistent support-case lifecycle or unified formal incident workflow was established in the Phase 0 audit.
6. **A fresh ordinary-customer first-visit-to-safe-exit certification has not yet been proven at this baseline SHA.**

### Existing limitations / external evidence boundaries

- Provider-console configuration (for example Google/GitHub OAuth console state) must not be guessed from repository code.
- Live production-provider behavior must not be declared verified from mocks/configuration alone.
- Paid infrastructure or plan upgrades are outside the NZ$0 programme unless the user explicitly approves them.
- Legal text produced by this programme is an internally consistent product-behavior scaffold and must be marked for qualified legal review before final commercial reliance.

## Current readiness verdict

**NOT YET PRODUCTION-COMPLETENESS CERTIFIED.**

The Builder Resource Library and major execution/recovery foundations are present, but this new programme's lifecycle, public trust, claim-governance, update-lifecycle, customer-operations and complete ordinary-customer certification work remains to be implemented and evidenced.

## Phase evidence ledger

| Phase | Status | Evidence |
| --- | --- | --- |
| 0 Current-state audit | COMPLETE | Baseline and preserved/gap findings recorded above. |
| 1 Account/data lifecycle | IN PROGRESS | Pending implementation/tests. |
| 2 Public legal/trust | NOT STARTED | — |
| 3 Capability-claim truth | NOT STARTED | — |
| 4 ChangeContract | NOT STARTED | — |
| 5 DB/API migration safety | NOT STARTED | — |
| 6 Version/rollback lifecycle | NOT STARTED | — |
| 7 Support/failed-build UX | NOT STARTED | — |
| 8 Credits/failure settlement | NOT STARTED | — |
| 9 Incident/observability | NOT STARTED | — |
| 10 Customer journey | NOT STARTED | — |
| 11 Failure journey | NOT STARTED | — |
| 12 Security/privacy/accessibility/performance | NOT STARTED | — |
| 13 Fresh final-gap audit | NOT STARTED | — |
| 14 Production-readiness verdict | NOT STARTED | — |
