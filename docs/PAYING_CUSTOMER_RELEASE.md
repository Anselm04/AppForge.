# Paying-customer release evidence — 5 October 2026

**Decision: unrestricted paid launch is not certified.** Do not tag a first
paying-customer release from local test results alone.

The inspected baseline is `56fc72744eb7d5f38032a7ce81c22272796363cb`.
GitHub Actions records successful CI, Security Scanning, Deploy Production,
customer-entry smoke, capacity, and backup/recovery-readiness runs for that SHA.
No Production Auth Lifecycle, Production Admin MFA Challenge, or Production Full
Customer Journey run appeared in the retrieved exact-SHA run list. A challenge
request alone would not certify successful owner MFA verification in any case.

## Implemented blockers

1. Fix owner MFA input validation: ordinary six-digit codes were rejected by an
   over-escaped regex. Exercise the real procedure with successful, malformed,
   rejected, unavailable-provider, and unauthorized-customer inputs.
2. Require the successful audit write before minting privileged access.
3. Close the comma-separated tRPC batch bypass of Express prefix-mounted owner
   MFA limiters. Exercise real HTTP requests and the actual in-memory limiter,
   including separate three-send and ten-check limits. Production Redis-backed
   enforcement still requires live evidence on both machines.
4. Re-read current Stripe subscription state for delayed subscription updates
   and failed-payment events. Scope cancellation to the affected subscription.
   Exercise the real webhook handler with provider/database boundary doubles.

These are bounded fixes, not a claim that every concurrency, ordering, or
database failure scenario has been proven. For example, the event replay lock
serializes the same event ID, not all distinct events for one customer.

## Live read-only observations

- AppForge readiness returned `{"status":"ok","ready":true}`.
- The live Stripe account has an enabled webhook at AppForge's existing
  `/api/webhooks/stripe` endpoint, subscribed to its seven handled event types.
- Starter, Builder, Studio, Enterprise and 50/100/250-credit products have active
  live prices. This establishes catalog existence, not correct Fly secret
  mappings or successful checkout/fulfillment.
- The Supabase auth project referenced by `fly.toml` is active. Its public tables
  have RLS enabled, and the replay ledger denies anon/authenticated direct table
  access. Owner predicates were inspected; direct multi-tenant access tests
  remain necessary.
- Supabase's security advisor reports leaked-password protection disabled.
  Resolve the setting or document a deliberate release decision. See
  <https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>.
- That inspected Supabase database lacks the `users`, `subscriptions`,
  `user_credits`, and `credit_transactions` tables expected by the Node backend.
  This does **not** establish that Fly's separate `DATABASE_URL` points there.
  Identify and reconcile the actual runtime database before payment testing;
  do not alter an unrelated database to make a checklist green.
- The production signup form renders. Creating new credentials and completing
  live signup/owner SMS verification require secure interactive handoffs.

## Required immutable certification

Choose one full candidate SHA after integration. Record every run URL, tested
deployment identity, test account identifier, and redacted ledger evidence
against that same SHA. Keep confirmation links, passwords, SMS codes, cookies,
Stripe secrets, and payment details out of workflow inputs and artifacts.

| Gate                                                          | Required evidence                                                                                             | Current classification                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Clean install / lint / format / types / tests / audit / build | Fresh CI and build results for candidate SHA                                                                  | Local checks; candidate CI required                            |
| Docker/runtime                                                | Clean image build and started-container health/readiness                                                      | Docker unavailable in local environment; candidate CI required |
| Customer authentication                                       | Ten fresh confirmed accounts, repeated logout/login, fresh contexts, project return/resume                    | Unverified                                                     |
| Stripe subscriptions and credit packs                         | Checkout → signed webhook → actual runtime ledger → account UI for each purchasable offering                  | Live catalog inspected; payments unverified                    |
| Billing failures and retries                                  | Duplicate/delayed events, partial/full refunds, failures/recovery, upgrades/downgrades, cancellation/expiry   | Focused regressions; live settlement unverified                |
| Paid builds                                                   | Debit-once accounting through pause/disconnect/relogin/resume, success/failure/refund                         | Existing local coverage; production ledger proof unverified    |
| Senior Developer recovery                                     | Deliberate compile/dependency/deployment failures with repair or safe failure and correct billing             | Production injection unverified                                |
| Generated products                                            | New website, SaaS, auth/database, AI, multi-page product built through UI and independently exercised         | Unverified                                                     |
| Observability                                                 | Induced failures produce usable alerts with release identity and stack traces                                 | Unverified                                                     |
| Destructive recovery                                          | One-machine loss, worker restart, queue outage, expiry and replay without corrupt state/duplicate billing     | Actual fault injection unverified                              |
| Owner security                                                | Real email login → SMS → admin; wrong/expired/reused codes, logout, rate limits and customer denial           | Behavioral regressions; live SMS verification unverified       |
| IP/secrets                                                    | Repository visibility decision and full-history credential review                                             | Repository remains public; full-history scan performed         |
| Final release                                                 | All evidence green at one SHA, production deployed identity and post-deploy smoke, then protected release tag | Blocked by missing live evidence                               |

Enterprise remains sales-assisted rather than self-serve in the current checkout
service. Certify its actual supported purchase path rather than inventing a
self-serve Enterprise checkout for this audit.

## Observability boundary

The baseline CI source-map upload is conditional on Sentry configuration. Its
skipped state is not proof that monitoring is intentionally unused or working.
Before certification, choose and verify the actual monitoring provider. If
Sentry is used, prove upload for the deployed bytes, matching release identity,
and readable stack traces from an induced error. If another provider is used,
record its alert-delivery proof and the explicit decision to omit Sentry. Never
upgrade a log statement or a skipped upload into a passed alert gate.

## Secret-history scan

Gitleaks 8.24.3, checked against the vendor release checksum, scanned 3,159
reachable commits and approximately 14.28 MB. Its default rules reported eight
signals: six in test fixtures and two historical Supabase publishable-key
assignments. No confirmed live secret was established by this scan. Fixture
signals and publishable keys are not automatically compromised credentials;
this is also not a guarantee that undiscovered secrets do not exist. Retain the
redacted local scan evidence and continue the existing verified-secret CI scan.
Making the repository private does not invalidate any previously exposed secret.

## Execution limits

No real money was charged/refunded, no Fly machine was killed, no Redis state
was changed, no production database was migrated, and no release was tagged.
The GitHub connector does not expose a repository-visibility mutation. The
repository has neither a Coordinator project marker nor an initialized SDLC
runtime; no formal SDLC run or Coordinator board certification is claimed.
