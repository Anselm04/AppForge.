# AppForge Independent Off-Site Backup Protocol

## Purpose

The repository backup workflow creates a verified Git recovery bundle and source archive inside GitHub. This document defines the independent backup-of-backup layer used when GitHub itself, the GitHub account, or a connected automation is unavailable or compromised.

## Recovery copies

Maintain at least these copies:

1. Primary GitHub repository.
2. GitHub Actions verified recovery artifact.
3. Independent encrypted off-site target 1.
4. Preferably independent encrypted off-site target 2 or an offline encrypted copy.

Do not treat two copies inside the same provider/account as independent disaster recovery.

## Off-site target requirements

Use an S3-compatible object-storage account that is separate from the GitHub account. Prefer a provider/account with:

- object versioning;
- immutable/object-lock retention where available;
- MFA on the storage account;
- security alerts and audit logs;
- credentials restricted to the AppForge backup prefix;
- no delete permission for the GitHub backup credential.

The workflow only needs to upload and read the objects it creates so it can immediately download and restore-test each copy. The GitHub credential used for backup should not be able to delete objects, alter bucket retention, disable versioning, or administer the storage account.

## Required GitHub Actions secrets

Encryption:

- `OFFSITE_BACKUP_PASSPHRASE`

Target 1:

- `OFFSITE_1_ENDPOINT`
- `OFFSITE_1_REGION`
- `OFFSITE_1_BUCKET`
- `OFFSITE_1_ACCESS_KEY_ID`
- `OFFSITE_1_SECRET_ACCESS_KEY`

Optional target 2:

- `OFFSITE_2_ENDPOINT`
- `OFFSITE_2_REGION`
- `OFFSITE_2_BUCKET`
- `OFFSITE_2_ACCESS_KEY_ID`
- `OFFSITE_2_SECRET_ACCESS_KEY`

Do not commit any of these values to the repository.

## Encryption-key survival rule

Keep a copy of `OFFSITE_BACKUP_PASSPHRASE` outside GitHub in a trusted password manager and preferably one additional offline recovery record. A total GitHub account loss must not also destroy the only copy of the decryption key.

Do not store the passphrase in the same object-storage bucket as the backups.

## What the workflow does

For every main-branch backup it:

1. verifies Git object integrity;
2. creates a complete Git bundle containing repository history and refs;
3. creates a source archive for the exact commit;
4. records the exact HEAD SHA and recovery manifest;
5. calculates SHA-256 checksums;
6. restores the Git bundle into a clean directory;
7. verifies the restored dependency lockfile can install with lifecycle scripts disabled;
8. packages the verified recovery data;
9. encrypts the off-site package with AES-256 and PBKDF2 key derivation;
10. authenticates the encrypted file with HMAC-SHA256;
11. uploads the encrypted object, checksum and HMAC under a commit-specific path;
12. downloads the object back from each configured off-site provider;
13. verifies ciphertext integrity/authentication;
14. decrypts and verifies the exact backed-up HEAD SHA and Git bundle again.

A successful upload alone is not considered a successful backup. Restore verification must also pass.

## Object naming and overwrite protection

Backups are written beneath paths shaped like:

`appforge/YYYY/MM/DD/<commit-sha>/...`

A different repository commit therefore gets a different path. Configure the storage provider to enforce versioning and/or immutable retention so an attacker cannot replace or delete earlier recovery points.

## Credential permissions

The backup credential should be capable only of the equivalent of:

- PutObject under the AppForge backup prefix;
- GetObject under the AppForge backup prefix.

Do not grant it DeleteObject, bucket-policy administration, user administration, retention-policy administration, or unrelated bucket access unless a provider absolutely requires something additional.

## Incident recovery order

When compromise is suspected:

1. Stop production deployment and freeze destructive administration.
2. Identify a known-good SHA from independent recovery records.
3. Rotate compromised GitHub/storage/Fly/Supabase/Stripe credentials as appropriate.
4. Retrieve a recovery object from the independent off-site provider.
5. Verify the encrypted-object SHA-256 and HMAC.
6. Decrypt the recovery archive using the separately retained passphrase.
7. Verify `SHA256SUMS` and run `git bundle verify`/`git fsck --full --strict`.
8. Restore to a clean repository/account.
9. Run AppForge CI, security, build and customer-flow gates.
10. Deploy only the verified known-good SHA.
11. Rotate remaining credentials and investigate the original compromise before reopening normal write access.

## Recovery objective

Repository RPO is designed to be the latest successfully backed-up main-branch commit because the workflow runs on pushes to main and on a daily schedule.

Repository restoration should normally be a tens-of-minutes operation once trusted credentials and a verified recovery object are available. Full production recovery can take longer when database state, payment systems, DNS, cloud accounts, or credentials are also involved.

## Monthly drill

At least monthly, confirm:

- the scheduled workflow is still succeeding;
- target 1 is configured and restore-verifying;
- target 2/offline copy is current;
- the offline decryption passphrase is still accessible to the owner;
- storage retention/versioning remains enabled;
- backup credentials still have no delete/admin permissions;
- a known recovery archive can be restored into a clean temporary repository.
