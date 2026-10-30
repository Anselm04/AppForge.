# Production-Ready Authentication & Account Lifecycle

AppForge uses Supabase for password storage, authentication and identity records.
Email and phone verification must complete on the same account before protected
application APIs become available. The owner account requires SMS approval before any protected account or
unlimited-build API can be used, in addition to the dashboard and god-code APIs.

## Delivery configuration

- Browser runtime configuration needs the Supabase URL and publishable key.
- Server account administration needs the matching Supabase URL and service key.
- `PUBLIC_APP_URL` (or `APP_URL`) must be the HTTPS origin used by customers.
- All customer and authentication emails use Cloudflare Email Sending. Configure
  `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_API_TOKEN` (or the existing
  `CLOUDFLARE_API_TOKEN`) and `APPFORGE_EMAIL_FROM` with a verified sending domain.
  Cloudflare Email Routing is the separate inbound service; enabled routing
  alone does not establish outbound sending readiness.
- Configure Supabase Auth's Send Email Hook to
  `https://YOUR_APP_ORIGIN/api/auth/email-hook` and set the matching
  `SUPABASE_SEND_EMAIL_HOOK_SECRET` in AppForge. The signed hook routes
  verification resends, password-change codes, email changes and security
  notifications through Cloudflare. The handler verifies the raw-body signature
  and rejects stale/forged payloads before sending.
- Initial confirmation and recovery also use Cloudflare directly. Email code
  never uses Twilio credentials or silently falls back to another provider.
- Customer account verification and owner MFA use Twilio Verify. Configure
  `TWILIO_VERIFY_SERVICE_SID`, destination geographic permissions, account credit
  and any trial-recipient restrictions. Owner MFA also needs `OWNER_PHONE`.
- Supabase's optional phone-only sign-in provider is separate from the linked
  account verification flow. Enabling it is not a substitute for Twilio Verify.
- Keep secure email change, confirmation requirements, password policy and
  session expiration configured in Supabase. Secrets stay on the server.

## Behavior covered by local regression tests

| Journey                      | Expected result                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Registration                 | Email, phone and password are submitted as one pending identity.                                                                      |
| Email confirmation           | One-time hashes are exchanged with the provider; credentials are removed from the address bar; the original destination is preserved. |
| Verification resend          | Existing identity and password are preserved; account existence is not disclosed.                                                     |
| SMS delivery failure         | One automatic attempt; retries require an explicit click; the customer can correct their number.                                      |
| SMS confirmation             | The target and expiry are server-controlled; invalid/expired codes never confirm a phone.                                             |
| Access control               | User-editable metadata cannot bypass phone verification; phone confirmation cannot stand in for email confirmation.                   |
| Password recovery            | Recovery emails lead to the password-reset page; invalid/expired links do not create a session.                                       |
| Account changes              | Email/password changes use the validated server token, including after cookie-backed refresh.                                         |
| Password-change verification | Customers can request a code and submit it as the provider's reauthentication nonce when secure password change requires it.          |
| Profile                      | A saved AppForge display name survives subsequent authenticated requests.                                                             |
| Logout                       | Current-device logout uses local revocation; separate controls revoke other/all sessions.                                             |
| Account deletion             | Active deletion requires verified identity and recent authentication; success clears browser state and private query data.            |
| Deletion reauthentication    | Refreshing an old login does not satisfy the recent-authentication requirement.                                                       |

## Real delivery and browser acceptance checks

Use a dedicated test account and a phone/inbox the tester controls. Do not
record passwords, OTPs, session tokens or confirmation URLs in test reports.

1. Register with email, international-format phone and matching passwords.
   Check inbox/spam, open the confirmation, and confirm the browser reaches
   phone verification on the intended AppForge origin.
2. Request a confirmation resend before confirming a second test account. Check
   delivery and confirm that its original password still works.
3. Complete the SMS challenge. Check incorrect, expired and already-used codes,
   resend, and correcting a mistyped number. Confirm protected APIs stay closed
   until both email and phone are verified.
4. Sign in, reload, and exercise cookie-backed refresh after the browser-held
   access token is removed/expired. Save a display name, reload again, and change
   the password and email. Confirm the email-change verification messages arrive.
5. Request password recovery, open the new email, set matching passwords, then
   sign out and sign in with the new password. Check an expired/reused recovery
   link and a repeated submit under React StrictMode.
6. Test current-device, other-device and all-device logout in separate sessions.
   Check protected routes after sign-out and after opening a fresh browser context.
   Supabase access JWTs can remain valid until expiry after remote sign-out;
   configure token lifetime to the application's revocation requirements.
7. Verify owner MFA blocks owner operations before a successful second factor.
8. Delete only the dedicated disposable test account. Reauthenticate first;
   confirm deletion clears the browser and that subsequent login fails. Check
   that project cleanup and subscription cancellation completed.

Local mocked-provider tests do not establish real inbox/SMS delivery, deployed
configuration, or that a particular deployed revision contains these fixes.
Record the deployed revision and results of these checks before calling the
release production-ready.

The existing Production Auth Lifecycle workflow also needs a dedicated
`APPFORGE_CANARY_PHONE` secret in addition to its canary inbox. Complete both
email and SMS verification in the browser opened from the confirmation email.
Its polling step checks account state without opening the SMS screen repeatedly.
Use a phone not already linked to a different Supabase identity.

## Owner account security

- Admin MFA always sends to server-configured `OWNER_PHONE`; the browser cannot
  select the recipient. Requests from other accounts cannot start that flow.
- A five-minute signed challenge is bound to the owner, browser and validated
  Supabase session. A code cannot be checked from another login's challenge.
- Successful approval lasts 15 minutes and survives access-token rotation within
  that same provider session. It cannot carry over to a different login.
- MFA cookies use a new signature version; old approvals must be renewed when
  this release is deployed. A signing secret shorter than 32 characters fails closed.
- Owner-only god-code creation/listing and other admin operations require both
  the owner identity and completed SMS. Unlimited entitlement alone never grants
  administrative privileges. The owner account's other protected APIs also
  require SMS approval.
- Failed Twilio delivery never unlocks admin. Trial-recipient restrictions must
  be resolved in Twilio; AppForge no longer initiates an unexpected voice call as
  an SMS fallback.
- Local tests prove access checks; they do not establish whether another person
  accessed the existing production account. Review session/audit history and
  revoke existing sessions through the account controls as part of live rollout.
