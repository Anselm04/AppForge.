# AppForge Disaster Recovery and Compromise Response

This runbook protects AppForge against accidental deletion, destructive changes, compromised credentials, malicious automation, supply-chain attacks, provider failures, and AI-assisted changes that are incorrect or hostile.

## Recovery objectives

### Source repository

- Recovery point objective (RPO): every push to `main`, plus a daily scheduled verified backup.
- Recovery requirement: a backup is valid only after checksum creation, `git bundle verify`, clean restore, restored HEAD comparison, and `git fsck --full --strict`.
- Recovery target: restore source history and refs first, then restore/recreate infrastructure credentials and external services.

### Production

A restored revision is never deployed merely because it exists in backup. The exact restored SHA must pass AppForge's normal CI, security, test, build, release, and production verification gates before it can return to service.

## Backup layers

Use a 3-2-1 model:

1. Primary Git repository on GitHub.
2. Verified recovery archive produced by `.github/workflows/disaster-recovery.yml`.
3. At least one independent off-GitHub copy in versioned or immutable storage.

The GitHub Actions artifact is a recovery copy, not the only long-term backup. Deleting a workflow run can also delete its artifacts.

## What is protected by the Git bundle

The bundle contains Git objects, source history, refs, branches, and tags available to the workflow. SHA-256 checksums are produced with the recovery archive.

A Git bundle does not contain GitHub account settings, GitHub Actions secrets, external database state, Stripe state, Supabase data, Fly.io secrets/configuration, DNS state, or credentials held by other providers. Those systems require their own backup/export and recovery procedures.

## Restore procedure

1. Obtain the newest trusted recovery archive from an independent copy.
2. Verify the archive SHA-256 checksum before extraction.
3. Extract `appforge-repository.bundle`.
4. Run `git bundle verify appforge-repository.bundle`.
5. Clone into a clean directory.
6. Confirm the restored HEAD matches `HEAD_SHA.txt`.
7. Run `git fsck --full --strict`.
8. Review the restored SHA against the last known successful CI/security/production records.
9. Rotate or recreate infrastructure credentials before deploying if compromise is suspected.
10. Run the complete CI and security suite.
11. Deploy only the exact SHA that passes the release gate.
12. Run production health, authentication-boundary, billing-boundary, entry-route, and generated-product verification checks.
13. Re-enable normal deployment only after the incident is contained and documented.

## Suspected GitHub or credential compromise

1. Stop production deployments.
2. Preserve evidence: suspicious SHAs, workflow IDs, timestamps, deployment IDs, logs, affected accounts, and credential names.
3. Do not assume the current `main` HEAD is trustworthy.
4. Identify the newest known-good SHA that passed CI, security, build, deploy, and production checks.
5. Revoke and rotate potentially exposed GitHub, Fly.io, Supabase, Stripe, database, webhook, signing, AI-provider, and other privileged credentials.
6. Treat every exposed credential as compromised even if it was later removed from Git history.
7. Restore the repository from a verified independent recovery point if repository integrity is uncertain.
8. Re-run secret scanning, dependency audit, CodeQL, tests, typecheck, build, and customer-flow contracts.
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

## Provider-level recovery inventory

Maintain and periodically test independent recovery procedures for:

- GitHub repository and access controls.
- Supabase database, auth configuration, RLS/policies, and storage.
- Fly.io application configuration, deployment settings, and secrets inventory.
- Stripe product/price/webhook configuration and authoritative billing data.
- DNS/domain registrar configuration.
- AI-provider credentials and quotas.
- Any external object storage used for off-site recovery archives.

## Recovery drill

At least monthly:

1. Restore the newest recovery bundle into a clean environment.
2. Verify checksum, Git bundle, Git object integrity, and expected HEAD.
3. Confirm dependency lockfile installation works with lifecycle scripts disabled.
4. Run the standard CI/test/security/build pipeline against the restored tree.
5. Record whether the target recovery objectives were met.
6. Correct any recovery step that depends on undocumented knowledge or unavailable credentials.

A backup that cannot be restored is not a backup.