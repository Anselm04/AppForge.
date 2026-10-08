# AppForge authentication recovery release

This candidate restores the public signed-out home, keeps the private builder behind server-confirmed authentication, adds verification recovery, prevents duplicate auth submissions, and rejects foreign-origin mutations even with a valid CSRF token.

## Required operator configuration

- `PUBLIC_APP_URL` (or `APP_URL`) must be a trusted HTTPS origin. Confirmation redirects never use the request Host header.
- `SUPABASE_SERVICE_ROLE_KEY` and the configured Supabase URL are required for initial signup confirmation-link generation.
- Initial signup email currently uses Twilio Email: retain `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and an authorized `TWILIO_EMAIL_FROM` sender (the existing owner email fallback remains supported).
- Verification resend uses Supabase Auth resend with a server or Vite publishable/anon key; verify the project's SMTP sender, delivery, and redirect allowlist separately from the initial Twilio email flow.
- Retain shared `REDIS_URL` production coordination. Signup and resend share the same auth abuse bucket across Fly machines.

Configuration validation is evidence of configured values, not evidence of delivered mail. Production must pass signup, received confirmation, confirmation consumption, login, logout, relogin, reset and resend with controlled accounts. Never approve paying-customer readiness based on these local tests alone.

## Recovery and rollback

Keep the previous immutable production revision available. Roll back the candidate through the existing release workflow if auth regressions occur. Retain the trusted redirect configuration and production Redis; never restore a working signup by disabling CSRF, accepting request Host redirects, bypassing email confirmation, or granting admin privileges to test accounts.

For a failed email request, inspect sanitized provider errors and configuration before retrying. The candidate preflights initial signup credentials before generating a user. Check whether an account was already created before a provider delivery failure; do not delete customer accounts or change their passwords as a recovery shortcut.

## Evidence from this local run

- Live base: `2794fb6119395745c8c149aa37801a5184fdabc2` is the source checkout, not an established deployed revision.
- Live server liveness and database/Redis readiness: HTTP 200.
- Live integration readiness: HTTP 503 with `productionReady: false`.
- Live anonymous build request: HTTP 401.
- Approved test signup: HTTP 503 `CONFIRMATION_DELIVERY_FAILED`; no matching test user was created in the connected Supabase project and no email was found in the approved Gmail mailbox.
- Connected Stripe exposes existing AppForge products in a shared live account; no sandbox/test account is exposed.
- Fly dashboard access was obtained through the existing GitHub sign-in. Release v405 is running on two machines. Its protected secret inventory lacks `SUPABASE_SERVICE_ROLE_KEY`; its public configuration already includes the trusted AppForge HTTPS origin. The operator approved copying the existing server key; it was stored in the protected Fly secret manager on 8 October 09:49 UTC. Fly secret deployment v406 completed on 8 October 10:10 UTC; both replacement machines are Started with 2/2 checks and the pending secret badge is gone. The local Fly CLI has no token.
- Privacy/terms/support publication needs the operator's approved content and contact.

The live customer journey has not passed. This candidate is not a paying-customer certification.

## Verified source candidate

Draft PR: https://github.com/Anselm04/AppForge./pull/124 . Source commit `93213e0a54627f44200750e9efe57906900b60ee`. Local full run: 1,171 passed, one skipped, across 185 files. Typecheck, lint, production build, and changed-source formatting passed. Production dependency audit: zero findings; full audit: six high development-tool findings remain. GitHub CI security, lint/format, coverage/full tests, explicit golden-path contracts, typecheck, and product-factory validation also passed; production build subsequently passed; CI Pipeline, Security Scanning, Deploy Preview and the corrected PR Checklist all passed. Contract tests are not live customer-journey evidence.

## Production account and email findings

The operator requested existing real accounts only; no further synthetic or tagged signup accounts will be used. The existing operator Supabase account is email-confirmed and has signed in before. This proves its auth record exists, not that AppForge currently establishes its backend session. Production custom SMTP is disabled in Supabase. Customer reset and resend email must be configured with a verified production sender before those journeys can pass. Keep live Stripe product configuration in the operator’s existing shared account; never replace it with sandbox values to claim live readiness.

Source formatting cleanup is independently saved in draft PR #125: https://github.com/Anselm04/AppForge./pull/125 . It reformats 112 previously failing files, passes the whole-source check and lint, and preserves compiled program structures. It is merged; deployment of the combined source candidate is pending.

## Authorized release progress

The operator approved merging and deploying PRs #124 and #125; both are merged. All four GitHub workflows passed for each candidate. The existing real Google account successfully signs into AppForge and is recognized as its owner. Real generation journey build 68 is running. This is progress evidence, not paying-customer approval.
