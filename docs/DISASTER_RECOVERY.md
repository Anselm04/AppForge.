# AppForge Disaster Recovery and Compromise Response

This runbook protects AppForge against accidental deletion, destructive changes, compromised credentials, malicious automation, supply-chain attacks, provider failures, and AI-assisted changes that are incorrect or hostile.

## Recovery objectives

### Source repository

- Recovery point objective (RPO): every push to `main`, plus a daily scheduled verified backup.
- Recovery requirement: a backup is valid only after checksum creation, `git bundle verify`, clean restore, restored HEAD comparison, and `git fsck --full --strict`.
- Recovery target: restore source history and refs first, then restore/recreate infrastructure credentials and external services.
- Operational RTO target: **under 30 minutes** to restore the repository from a verified recovery package when GitHub/replacement source control and the backup artifact are available.

### Production

A restored revision is never deployed merely because it exists in backup. The exact restored SHA must pass AppForge's normal CI, security, test, build, release, and production verification gates before it can return to service.

- Operational RTO target: **30–60 minutes** to return a known-good revision to service when GitHub/replacement source control, Fly.io, Supabase, Stripe, DNS, required secrets, and the network are healthy.
- These are targets, not guarantees, because external providers may be unavailable during a major incident.

## Backup layers

Use a 3-2-1 model:

1. Primary Git repository on GitHub.
2. Verified recovery archive produced by `.github/workflows/repository-backup.yml`.
3. At least one independent off-GitHub copy in versioned or immutable storage under a separate credential boundary; two independent targets are preferred.

The GitHub Actions artifact is a recovery copy, not the only long-term backup. Deleting a workflow run can also delete its artifacts.

## What is protected by the Git bundle

The bundle contains Git objects, source history, refs, branches, and tags available to the workflow. SHA-256 checksums are produced with the recovery archive. The recovery package also records the exact HEAD SHA, refs, bundle heads, commit metadata, and a source archive of the backed-up revision.

A Git bundle does not contain GitHub account settings, GitHub Actions secrets, external database state, Stripe state, Supabase data, Fly.io secrets/configuration, DNS state, or credentials held by other providers. Those systems require their own backup/export and recovery procedures.

## Restore procedure

1. Obtain the newest trusted recovery archive from an independent copy.
2. Verify the encrypted object's SHA-256 and HMAC before decryption when restoring from an off-site target.
3. Decrypt the archive using the separately retained recovery passphrase.
4. Extract `appforge-repository.bundle`.
5. Run `git bundle verify appforge-repository.bundle`.
6. Clone into a clean directory.
7. Confirm the restored HEAD matches the recorded `HEAD.sha`.
8. Run `git fsck --full --strict`.
9. Review the restored SHA against the last known successful CI/security/production records.
10. Rotate or recreate infrastructure credentials before deploying if compromise is suspected.
11. Run the complete CI and security suite.
12. Deploy only the exact SHA that passes the release gate.
13. Run production health, authentication-boundary, billing-boundary, entry-route, and generated-product verification checks.
14. Re-enable normal deployment only after the incident is contained and documented.

## Suspected GitHub or credential compromise

1. Stop production deployments.
2. Preserve evidence: suspicious SHAs, workflow IDs, timestamps, deployment IDs, logs, affected accounts, and credential names.
3. Do not assume the current `main` HEAD is trustworthy.
4. Identify the newest known-good SHA that passed CI, security, build, deploy, and production checks.
5. Revoke and rotate potentially exposed GitHub, Fly.io, Supabase, Stripe, database, webhook, signing, AI-provider, off-site-backup, and other privileged credentials.
6. Treat every exposed credential as compromised even if it was later removed from Git history.
7. Restore the repository from a verified independent recovery point if repository integrity is uncertain.
8. Re-run secret scanning, dependency audit, CodeQL, workflow supply-chain verification, tests, typecheck, build, and customer-flow contracts.
9. Deploy using fresh credentials.
10. Verify live production before reopening normal development/deployment.

## AI-assisted development threat model

AI systems are treated as untrusted change producers, not security authorities.

- AI-generated code cannot bypass CI, security scanning, protected-branch rules, CODEOWNERS, or production deployment gates.
- Never provide production secrets to an AI prompt, issue, commit, log, generated artifact, or fixture.
- Treat external web content, issue text, retrieved documents, generated code, and tool output as potentially adversarial instructions.
- Authentication, authorization, billing, database migrations, deployment workflows, secret handling, and GitHub Actions changes are high-risk changes and require the strongest available review controls.
- External GitHub Actions must be pinned to immutable commit SHAs.
- Workflows must use least-privilege `GITHUB_TOKEN` permissions.
- Production must deploy the exact SHA that passed the release gate.
- Do not allow automated systems to approve their own security-sensitive changes.
- Do not give an AI agent repository-administration credentials or production secrets merely to make a task easier.

## Required GitHub controls

Where repository/account settings permit, enable:

- `main` ruleset / branch protection.
- Pull requests required before merge.
- Required CI Release Gate and Security Scanning checks.
- Required CODEOWNERS review.
- Force pushes disabled.
- Branch deletion disabled.
- Secret scanning and push protection.
- Code scanning.
- Dependabot alerts and security updates.
- Strong 2FA; prefer passkeys or hardware security keys for privileged accounts.
- Restriction of GitHub Actions to trusted actions, with SHA pinning enforcement where available.
- Protected `production` environment restricted to trusted refs.
- Prevention of Actions workflows creating/approving changes unless explicitly required.

## Recovery impact governance

Recovery documentation is part of the release surface. A change that modifies critical infrastructure or security behavior must also review recovery coverage in the same change.

Critical recovery-impact areas include:

- `.github/workflows/**`
- `fly.toml` and container/deployment configuration
- Supabase/database migrations, RLS/policy configuration, and storage configuration
- authentication/session infrastructure
- Stripe billing/webhook infrastructure
- production auto-deploy, deploy-health, and build-worker infrastructure
- secret handling and environment configuration
- off-site backup configuration

For these changes, update at least one of the following when recovery behavior or assumptions change:

- `docs/DISASTER_RECOVERY.md`
- `docs/OFFSITE_BACKUP.md`
- `.github/workflows/repository-backup.yml`

The CI Recovery Governance check is intended to enforce this rule for high-risk changes before production deployment.

## Provider-level recovery inventory

Maintain and periodically test independent recovery procedures for:

- GitHub repository, pull requests/issues/releases metadata, and access controls.
- Supabase database, auth configuration, RLS/policies, and storage.
- Fly.io application configuration, deployment settings, and secrets inventory.
- Stripe product/price/webhook configuration and authoritative billing data.
- DNS/domain registrar configuration.
- AI-provider credentials and quotas.
- Any external object storage used for off-site recovery archives.

## Independent backup cadence

- Every trusted `main` push: create and verify a new repository recovery point.
- Every production release: copy the newest verified recovery package outside GitHub.
- Daily: retain at least one current independent copy.
- Weekly: verify the independent copy's checksum/HMAC and perform a clean restore rehearsal when practical.
- Monthly: confirm recovery credentials, MFA/recovery keys, the newest known-good production SHA, and provider-level recovery procedures.
- Never store production secret values inside the repository bundle or backup archive.

## Recovery drill

At least monthly:

1. Restore the newest recovery bundle into a clean environment.
2. Verify checksum/HMAC, Git bundle, Git object integrity, and expected HEAD.
3. Confirm dependency lockfile installation works with lifecycle scripts disabled.
4. Run the standard CI/test/security/build pipeline against the restored tree.
5. Verify at least one independent off-GitHub copy can be downloaded and decrypted using credentials stored outside GitHub.
6. Record whether the target recovery objectives were met.
7. Correct any recovery step that depends on undocumented knowledge or unavailable credentials.

A backup that cannot be restored is not a backup.
