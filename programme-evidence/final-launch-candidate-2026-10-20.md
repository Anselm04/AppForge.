# AppForge Final Launch Candidate Evidence — 20 October 2026

This record supersedes older programme-status summaries where later exact-SHA evidence now proves the previously open repository/runtime gates.

## Current launch-candidate SHA

`b06ad4f44219fccef513d7bae803062c78ba2b24`

## Proven green on the same main SHA

- Main CI run `39367818204`: success.
  - Product Factory Validation: success.
  - Lint/format: success.
  - Typecheck: success.
  - Full test suite: success.
  - Existing-host isolation checks: success.
  - Fly capacity safety tests: success.
  - Production golden path: success.
  - Production Build: success.
  - CI Release Gate: success.
- Security Scanning run `39367818201`: success.
  - CodeQL: success.
  - npm production dependency audit: success.
  - Secret scanning: success.
  - Workflow supply-chain gate: success.
- Recovery Readiness run `39367818119`: success.
- Repository Backup & Restore Drill `39367818508`: success.
- Deploy Production run `39368320341`: success.
  - exact release SHA/freshness checks: success;
  - live Fly deployment: success;
  - redundant Fly capacity verification: success;
  - prepared non-root build runtime on every serving Machine: success;
  - production runtime/auth boundaries: success;
  - customer entry/deep-link routes: success;
  - Fly released-SHA verification: success;
  - live Chromium customer-shell verification: success.

## Capacity-policy reconciliation

PR #209 removed the stale exact-two production/runtime contradiction. The authoritative policy is now documented in `docs/PRODUCTION_CAPACITY_POLICY.md`: production requires at least two healthy current-release serving Machines; healthy excess blue/green capacity is permitted and all per-Machine/runtime/security checks remain mandatory.

## Repository status after this evidence

The core product, production deployment path and recovery-readiness path are no longer blocked by the previously reported Fly machine-count contradiction. Completed programmes must not be reopened without new defect evidence.

## Items that remain outside source-only certification

These items require owner/admin access, provider truth or controlled real-world evidence and must not be fabricated from source code:

- GitHub `main` ruleset / branch protection with required release/security checks and force-push/deletion protection.
- Controlled real email-confirmation inbox proof.
- Fresh full ordinary-customer production journey/canary where credentials/provider state are available.
- Isolated production database restore/recovery proof after current lifecycle migrations.
- Required external provider-console approvals/truth, including OAuth/app-store/provider state where applicable.
- Qualified legal review of public policy/retention wording.
- Fresh accessibility evidence, including assistive-technology checks.
- Fresh production load/performance evidence against explicit targets.

These are launch-certification/governance evidence items, not evidence that the already-green core engineering programmes are incomplete.
