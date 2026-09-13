# AppForge Recovery Inventory

This inventory defines what must be recoverable for AppForge to return to service after a severe incident. It intentionally records names, responsibilities, locations, and verification requirements — never secret values.

## Source control

System: GitHub repository `Anselm04/AppForge.`

Must be recoverable:
- Full Git history, refs, branches, and tags.
- Pull requests/issues/releases metadata backup.
- CI/security/deployment workflows.
- CODEOWNERS and review policy.
- Recovery governance policy.
- Latest known-good production SHA.

Recovery evidence:
- Verified Git bundle.
- SHA-256 checksums.
- Clean restore rehearsal.
- `git fsck --full --strict`.
- Exact restored SHA match.

## Off-site recovery storage

Must be recoverable:
- At least one independent encrypted repository backup.
- Prefer two independent providers/credential boundaries.
- Backup decryption key retained independently from GitHub.

Required non-secret configuration names:
- `OFFSITE_BACKUP_PASSPHRASE`
- `OFFSITE_1_ENDPOINT`
- `OFFSITE_1_REGION`
- `OFFSITE_1_BUCKET`
- `OFFSITE_1_ACCESS_KEY_ID`
- `OFFSITE_1_SECRET_ACCESS_KEY`
- Optional equivalent `OFFSITE_2_*` values.

Verification:
- Upload.
- Download.
- SHA-256 validation.
- HMAC validation.
- Decryption.
- Git bundle verification.
- Exact SHA recovery.

## Owner identity and privileged access

Must be recoverable:
- GitHub owner access.
- Password-manager recovery.
- At least two independent MFA/passkey/hardware-key paths.
- Offline provider recovery codes.

Never store recovery codes or private keys here.

## Domain registrar and DNS

Must be recoverable:
- Registrar ownership.
- Domain lock/unlock recovery procedure.
- DNS zone/configuration inventory.
- MFA and offline recovery path.

Verification:
- Confirm owner can access registrar independently of daily device.
- Export or otherwise document DNS configuration after material DNS changes.

## Supabase

Must be recoverable:
- Database data and schema.
- Migrations.
- Auth configuration.
- RLS/policies.
- Storage object inventory and restore procedure.
- Required Edge Functions/configuration if used.
- Environment/configuration inventory without secret values.

Verification target:
- Periodic restore into an isolated recovery environment/project.
- Authentication and authorization verification.
- Critical database/RLS checks.

## Fly.io

Must be recoverable:
- App identity and configuration.
- `fly.toml`.
- Required secret-name inventory.
- Deployment/release history sufficient to identify a known-good version.
- Independent record of a known-good production image/release where feasible.

Verification target:
- Recreate/redeploy exact trusted SHA.
- Health/readiness/auth-boundary smoke verification.

## Stripe

Must be recoverable:
- Product/price identifiers.
- Webhook endpoint configuration.
- Subscription/entitlement mapping logic.
- Required webhook secret recovery/rotation procedure.
- Billing reconciliation procedure.

Verification target:
- Controlled test-mode checkout/webhook path.
- No production secrets stored in repository backup.

## AI providers and automation services

Must be recoverable:
- Provider account ownership.
- Credential rotation path.
- Quota/limits/configuration required for AppForge agents.
- Safe fallback/degraded-mode expectations where applicable.

AI systems must never be the sole holder or chooser of recovery credentials or trusted restore points.

## Observability and incident evidence

Must be recoverable or independently accessible:
- Deployment logs.
- Security workflow results.
- CI status history where practical.
- Monitoring/alerting account access.
- Incident timeline records without secret values.

## Recovery dependency rule

Any new critical provider, database, deployment target, authentication mechanism, billing dependency, secret-management system, object store, or AI execution environment must be added to this inventory in the same change that makes it production-critical.

If a critical dependency cannot be independently recovered, it must be treated as an unresolved resilience risk.

## Quarterly owner review

Confirm:
- Two independent owner recovery paths.
- Independent backup decryption-key access.
- At least one off-site backup restore succeeds.
- Latest known-good production SHA is recorded.
- Provider ownership and recovery access still work.
- Recovery documentation matches current architecture.
- No discontinued provider remains an undocumented dependency.

This document contains no secret material by design.