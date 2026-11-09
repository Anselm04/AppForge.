> **POINT-IN-TIME AUDIT (8 November 2026).** The issue states below are dated evidence, **not instructions to stop current engineering, block merges or reinstate historical prices**. Some findings have since changed (the README, owner-approved Stripe price catalogue, customer aftercare and source documentation were updated). Always re-check the current `main` branch and executed tests before reporting a finding as open or closed. Continue implementing repairs while respecting customer billing, consent, privacy and spending controls.

# AppForge launch audit — confirmed source findings (2026-11-08)

## Scope and evidence standard

Repository: `Anselm04/AppForge.`. Baseline: `main` at `05430567d446d2b1d5a1b29c5173fcdb1d339117`; audit tooling proposed in PR #258.

This is an **initial confirmed source-level finding register**, not an assertion that every source file has been read by a human, that CI has passed, or that the customer journey works. The `npm run audit:launch -- --json` command is designed to inventory production source and configuration files and collect review candidates at their exact line numbers. Review its results, trace each candidate's runtime call paths, and use functional tests to close each finding. Do not mark something PASS merely because its source contains a test.

## Confirmed launch blockers (must be corrected before verified release)

| ID | Severity | Confirmed evidence | Customer consequence | Required correction and release proof | Status |
|---|---|---|---|---|---|
| AF-001 | P0 | `src/services/customerComputeLaunchGate.ts`: `customerComputeLaunchCertified` only returns true for test/development; production calls reject customers | Paying customers cannot start legitimate AI builds | Complete atomic provider budget enforcement on every billable attempt, verify accounting/retry behavior, then replace the blanket production stop with a checked capability; execute real paid-build test when authorised | OPEN |
| AF-002 | P0 | `src/services/appForgeCommercialCheckoutGate.ts` blocks non-test/development checkout | Paid customers cannot purchase plan or top-ups | Finish Stripe price mapping, tax/terms, idempotent checkout/webhook/entitlement/refund lifecycle and checked cutover; run Stripe test-mode and authorised live acceptance | OPEN |
| AF-003 | P0 | `src/pages/Pricing.tsx`: `PRICING_PROPOSAL_MODE = true` | Purchase controls deliberately disabled in UI | Complete matching backend commerce, display approved USD amounts and clearly priced top-ups, then enable validated purchase controls | OPEN |
| AF-004 | P0 | `src/services/guardedProviderOperation.ts`, `src/services/providerSpendLedger.ts`, `docs/APPFORGE_NO_SPEND_RELEASE_HANDOFF.md` | Ledger is preparatory and the actual billable transport/retry paths are not fully protected; simply unblocking builds risks uncontrolled costs | Wire every provider request/attempt to atomic budget reservation, quoted maximum, verified settlement or retained uncertain charge, and bounded retries; reconcile receipts | OPEN |
| AF-005 | P1 | `src/services/app-builder.ts`: `iterate`, `deploy`, `exportToGitHub` throw errors | Calling the legacy adapter cannot complete editing, deployment or export | Locate all callers; remove dead adapter from shipped surface or delegate each method to the persisted, authorised production project pipeline; add functional tests | OPEN |
| AF-006 | P0 | `docs/APPFORGE_NO_SPEND_RELEASE_HANDOFF.md` identifies unverified signup email, reset, Twilio SMS, and session recovery | First-time customers may not be able to create/verify/recover accounts | Test actual new-account and existing-account journeys in authenticated browser and sanctioned provider test environment | UNVERIFIED |
| AF-007 | P0 | Same handoff identifies incomplete full paid customer journey and incorrect/missing provider-price verification | No evidence that checkout→entitlement→generation→reopen→export→deploy works | Run integration/browser acceptance with persisted DB and provider sandbox; run authorised live test only after safety qualification | UNVERIFIED |
| AF-008 | P1 | `src/__tests__/offlineCustomerAcceptance.test.ts` asserts production gates remain closed, and checks policy strings | Tests can be green while real sales and builds are disabled | Add stateful customer tests, test real checkout/webhooks, revise gate-focused assertions only when implementations and release proof change | OPEN |
| AF-009 | P1 | `docs/APPFORGE_NO_SPEND_RELEASE_HANDOFF.md` describes incomplete cost accounting for sandbox, storage, egress, retries, SMS and deployment | Fixed credit prices may not cover all variable provider costs | Add attributable priced cost envelopes, caps, alerts, full cost reporting and fail-closed accounting to every chargeable path | OPEN |
| AF-010 | P1 | `README.md` says all development, integrations and production deployments on hold | Contradicts active release objective; may mislead tooling or contributors | Merge PR #257 after ordinary checks, replace stale release-hold documentation where contradicted by implementation | FIX PREPARED, NOT MERGED |
| AF-011 | P1 | `docs/APPFORGE_NO_SPEND_RELEASE_HANDOFF.md` identifies security scan, exact-SHA CI, actual Fly.io health, backup/restore and rollback as release requirements | Source tests alone do not certify safe deployment | Verify CI/security/migration/restore/rollback artifacts on the exact release candidate | UNVERIFIED |
| AF-012 | P1 | `docs/APPFORGE_NO_SPEND_RELEASE_HANDOFF.md` identifies uncompleted owner-approved landing design | Visual/customer messaging may not reflect the approved product | Compare locked design contract with actual desktop/mobile/accessibility screenshots and implement deviations | UNVERIFIED |

## Not defects and not to be deleted

- Out-of-credits denial until the user tops up or receives their next authorised refill.
- Authentication and authorization checks, customer/project ownership checks, CSRF protection, rate limits and audit logging.
- Provider spending caps and idempotency safeguards after they have been integrated correctly.
- Build validation, explicit user approvals, retry accounting and rollback checkpoints.
- Test-only mock code confined to test suites; these are not production mocks unless reachable in production.

## Investigation queue before closeout

1. Enumerate all source/configuration paths with `npm run audit:launch -- --json`, review **every** finding and prioritise reachable code over dead paths.
2. Trace routes, frontend controls, webhooks, workers, provider dispatches and project persistence; audit all `throw`, test-only environment branches, import-time adapter paths and feature flags that prevent actual customer tasks.
3. Review migrations and production database behavior, webhook idempotency, concurrent saves, refund/account deletion, subscription entitlement events, and environment secrets references.
4. Execute TypeScript checks, lint, formatting, Vitest suites, integration and browser tests, security/dependency checks, migration smoke and exact-SHA CI. Record test command, revision, environment, failure log and pass/fail.
5. Fix each confirmed issue in reviewable PRs, retest adjacent flows after each fix, then repeat **the complete audit** against the merged release candidate.
6. Close only after signed-off real-customer acceptance: registration, email/SMS, checkout, entitlement, product generation, edits, save/reopen, validation, export, deployment, subscription management, refunds, rollback.

## Current conclusion

**NOT RELEASE CERTIFIED.** The known blocker list is incomplete until the full scanner output, runtime call-path review and executed customer-journey tests are collected. Do not conflate a source audit, mocked unit tests, or a documentation fix with a functioning paid commercial release.
