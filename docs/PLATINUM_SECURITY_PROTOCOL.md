# AppForge Platinum Security Protocol

This protocol defines the highest-assurance security and owner-recovery standard for AppForge. Its purpose is to make compromise difficult while ensuring the legitimate owner can still recover the platform after account loss, device loss, malicious automation, provider failure, ransomware, destructive AI-assisted changes, or a full GitHub compromise.

## Core rule: never create a single point of lockout

No critical AppForge recovery path may depend on only one of the following:

- one device
- one GitHub login
- one email account
- one MFA method
- one encryption key copy
- one cloud provider
- one password manager
- one repository host
- one person remembering undocumented steps

Security controls must increase attacker resistance without removing the owner's independent recovery path.

## Owner break-glass recovery kit

Maintain two independent recovery kits. They must not both live in the same physical or cloud location.

Each kit should contain or provide access to:

1. GitHub account recovery codes or equivalent owner recovery material.
2. A spare passkey or hardware security key where supported.
3. The off-site backup decryption passphrase or a secure method to retrieve it.
4. Recovery access for the primary email account.
5. Domain registrar recovery information and registrar-lock recovery procedure.
6. Supabase owner/project recovery information.
7. Fly.io owner/account recovery information.
8. Stripe owner/account recovery information.
9. A record of the newest known-good AppForge production SHA.
10. The disaster-recovery and off-site-backup procedures.

Do not store raw production API keys, database passwords, Stripe secret keys, or other live credentials in this repository or in an unencrypted printed recovery document.

## Authentication standard

For privileged accounts:

- Prefer passkeys or hardware-backed security keys.
- Keep at least two independent MFA methods where the provider permits it.
- Keep recovery codes offline and outside the device used for normal administration.
- Do not rely on SMS as the only recovery factor.
- Do not reuse passwords between GitHub, email, Supabase, Fly.io, Stripe, registrar, backup storage, or AI providers.
- Use a password manager protected by strong MFA, but do not make that password manager the only place containing the backup decryption recovery path.

## Privilege separation

Daily development credentials must not automatically possess every recovery or administrative capability.

Use separate trust boundaries for:

- normal source-code development
- production deployment
- backup upload/read
- repository administration
- billing administration
- database administration
- domain/DNS administration
- emergency recovery

Backup credentials should have the minimum permissions required to upload and verify backups and should not have account-administration rights.

## AI and automation trust boundary

AI systems and automation are treated as untrusted change producers.

They may propose code, tests, configuration, or documentation, but they must not be the sole authority that approves security-sensitive changes.

AI or automated tooling must never be given broad owner credentials merely for convenience. In particular, do not expose:

- GitHub owner/admin credentials
- backup decryption material
- registrar master credentials
- Stripe owner credentials
- Supabase owner credentials
- Fly.io owner credentials
- password-manager master credentials

A malicious prompt, poisoned dependency, compromised tool, retrieved web page, issue body, pull-request text, or generated file must never be able to cross directly into privileged administration without independent controls.

## Critical-change protocol

Changes affecting any of the following are security-critical:

- GitHub Actions or repository security policy
- authentication/session handling
- billing or Stripe webhooks
- Supabase schema, RLS, migrations, storage, auth, or service-role access
- production deployment and rollback
- Fly.io configuration
- backup encryption, off-site storage, or recovery workflows
- DNS/domain ownership
- secrets handling
- privileged AI-agent capabilities

For a critical change:

1. Identify the exact files and systems affected.
2. Confirm the recovery path still works if the change fails catastrophically.
3. Update recovery documentation when assumptions or procedures change.
4. Run CI, security, tests, and recovery-governance checks.
5. Deploy only an exact SHA that passed the required gates.
6. Verify production after deployment.
7. Keep the previous known-good release/recovery point available until the new release is verified.

## Emergency break-glass procedure

Use break-glass recovery only when normal administration is unavailable or untrusted.

1. Stop or freeze production deployment if compromise is suspected.
2. Use an independent clean device where possible.
3. Recover the owner's primary identity through a trusted recovery method.
4. Revoke suspicious sessions, OAuth grants, app passwords, tokens, deploy keys, and API credentials.
5. Rotate potentially exposed GitHub, email, Supabase, Fly.io, Stripe, database, webhook, AI-provider, registrar, and backup-storage credentials.
6. Do not trust current `main` merely because it is the newest revision.
7. Select the newest known-good SHA supported by CI/security/deployment evidence.
8. Restore from an independently verified backup if repository integrity is uncertain.
9. Run the complete CI/security/build/recovery verification suite from a clean environment.
10. Deploy only the verified SHA using fresh credentials.
11. Verify authentication, billing, build, deploy, health, and customer-flow boundaries.
12. Document the incident and replace any recovery material that may have been exposed.

## Owner lockout prevention

Before enabling a security feature that could deny access, confirm at least one independent owner recovery path remains available.

Examples:

- Before enforcing hardware-key-only access, register and test a spare key.
- Before rotating the backup passphrase, verify the new passphrase can decrypt a test backup and retain the previous passphrase until all retained backups are accounted for.
- Before changing email or domain ownership, verify the alternate recovery contact.
- Before enabling stricter GitHub rules, verify the owner can still perform documented emergency recovery without disabling security blindly.
- Before changing production credentials, preserve an independent record of which services require recreation or rotation.

## Recovery key handling

The off-site backup decryption passphrase must exist outside GitHub.

Minimum standard:

- one encrypted/durable copy in a trusted password manager or equivalent vault
- one independent offline copy stored securely in a different location

Never commit the passphrase to source control, issues, pull requests, CI logs, documentation, or generated artifacts.

When rotating it:

1. Create a verified new backup using the new passphrase.
2. Download and decrypt that backup from an off-site target.
3. Verify its checksum/HMAC and exact Git SHA.
4. Only then mark the rotation successful.
5. Preserve access to historical backups encrypted with older keys until retention expires or they are deliberately re-encrypted.

## Recovery objectives

Target objectives, assuming external providers are available:

- Repository/source recovery: under 30 minutes from a verified recovery package.
- Known-good production restoration: 30–60 minutes for a clean incident.
- Backup RPO: every trusted `main` push plus daily verification.

These are operational targets, not guarantees. Provider outages, database restoration, credential compromise, DNS propagation, or large-scale incidents can extend recovery time.

## Platinum recovery drill

At least quarterly, conduct a full owner-access disaster simulation from a clean environment:

1. Assume the normal GitHub session is unavailable.
2. Verify an independent owner recovery factor exists.
3. Retrieve the backup decryption material without relying on GitHub.
4. Retrieve a recovery package from an independent storage location.
5. Verify SHA-256/HMAC and decrypt it.
6. Restore the repository and verify the expected SHA.
7. Run CI/security/build validation.
8. Verify provider recovery information for Supabase, Fly.io, Stripe, email, and the domain registrar.
9. Confirm the newest known-good production SHA is identifiable.
10. Record the measured recovery time and any undocumented dependencies.

A security control that the legitimate owner cannot recover from is a failed security control.
