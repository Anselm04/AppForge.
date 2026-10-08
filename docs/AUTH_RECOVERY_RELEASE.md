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
- Fly dashboard and CLI need authentication before provider diagnosis or deployment can proceed.
- Privacy/terms/support publication needs the operator's approved content and contact.

The live customer journey has not passed. This candidate is not a paying-customer certification.
