# AppForge Front-Door Authentication Stabilization

## Intent

Make the beginning of AppForge reliable enough to test the actual product factory end to end: create an account or sign in, confirm email, verify the account phone, persist the session, sign out/in again, and enter the normal builder without being diverted into owner-admin MFA.

## Goals

- Keep Supabase as the identity and email/password/OAuth authentication system.
- Keep Twilio Verify as the SMS verification provider for account phone verification and separate owner/admin MFA.
- Remove the accidental Twilio Email dependency from signup, resend, and password recovery.
- Preserve signup phone metadata on the same pending Supabase identity, then require server-confirmed phone verification before protected product APIs.
- Prevent concurrent refresh-token rotation across AppForge's two Fly Machines from racing the same Supabase refresh token.
- Let the normal production release gate deploy once the real runtime dependencies for this architecture are present; do not require unused Twilio Email or Supabase Send Email Hook secrets.
- Preserve all existing billing, build, authorization, CSRF, abuse-rate-limit, owner-only, recovery, and exact-SHA release controls.

## Non-goals

- Do not weaken phone verification or owner/admin MFA.
- Do not bypass CI, security scanning, production readiness, exact-SHA checks, two-Machine checks, or live browser verification.
- Do not claim Supabase's default hosted email service is a sufficient public production mail service; public launch still requires a suitable SMTP configuration in Supabase.
- Do not add a new email vendor to AppForge code.

## Architecture

### Account and email authentication

The AppForge server retains its rate-limited signup endpoint, but it delegates account creation to Supabase Auth using a public Supabase key. `supabase.auth.signUp()` creates the pending identity and asks Supabase to send its configured confirmation email. The signup phone is stored only as untrusted pending metadata until Twilio Verify succeeds.

Resend uses `supabase.auth.resend()`. Password recovery uses `supabase.auth.resetPasswordForEmail()`. Email-change messages remain Supabase Auth's responsibility. AppForge no longer creates admin confirmation links and no longer sends auth mail through Twilio.

### SMS verification

Twilio Verify remains unchanged as the SMS provider. After email authentication, the existing account-phone verification service reads the stored target server-side, sends/checks Twilio Verify challenges, and only then updates the authoritative phone-confirmed state required by protected AppForge procedures.

Owner/admin SMS MFA remains a separate higher-privilege gate and must never block ordinary verified-account builder APIs.

### Cross-machine session refresh

Keep the existing in-process single-flight as the first layer. Add Redis-backed cross-machine coordination keyed only by a SHA-256 digest of the refresh token. One Machine obtains a short lock and performs the Supabase refresh. It stores the rotated session result briefly in Redis for concurrent requests on the other Machine. A Machine that does not own the lock waits briefly for that result rather than rotating the same token itself. Raw refresh tokens must never be used as Redis keys or logged.

If Redis coordination is unavailable, retain the existing fail-safe behavior rather than silently accepting an invalid identity. Production already requires Redis.

## Release behavior

The Fly runtime-secret gate must continue requiring Supabase, Twilio Verify SMS, Stripe, Redis, owner identity, database, cookie/JWT, and an LLM provider. It must stop requiring `SUPABASE_SEND_EMAIL_HOOK_SECRET`, `TWILIO_EMAIL_FROM`, or `APPFORGE_EMAIL_FROM` because those are not dependencies of the selected architecture.

The release still has to pass the existing exact-commit CI/security validation, deploy, two-Machine capacity check, health/readiness probes, anonymous fail-closed checks, public customer-entry routes, exact running SHA verification, and live-browser shell verification.

## Acceptance criteria

1. Email signup invokes Supabase Auth signup with the normalized email, password, redirect URL, and pending signup phone metadata.
2. Resend and password recovery use Supabase Auth's standard APIs without Twilio Email configuration.
3. Production source and release workflow no longer depend on Twilio Email or a Supabase Send Email Hook secret.
4. Twilio Verify SMS remains required and unchanged for phone verification.
5. Normal authenticated builder APIs remain separate from owner/admin MFA.
6. Two concurrent refreshes for the same refresh token across separate server instances result in one provider refresh and both requests receiving the same rotated session result.
7. Existing authentication, security, build, billing, and release tests remain green.
8. The exact merged `main` SHA deploys successfully and the live browser serves that SHA before the repair is called complete.
