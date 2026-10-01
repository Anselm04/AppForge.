# AppForge Production Gate: 93% → 100%

Current production-hardening checkpoint after `dc917394`.

## Completed in this pass

- [x] Project-chat Senior Dev trigger honors unlimited/lifetime credit entitlement.
- [x] Stripe checkout session creation centralized in `src/services/stripeCheckout.ts`.
- [x] Removed hard-coded Stripe price ID fallbacks from the active checkout implementation.
- [x] Enterprise excluded from self-serve Stripe plan provisioning.
- [x] Regression tests added for unlimited credit gates and canonical checkout boundaries.

## Remaining launch gates

- [x] Senior Dev approval-resume uses the unlimited/lifetime entitlement before checking raw balance and avoids charging unreserved credits for unlimited accounts; regression coverage is in `src/__tests__/unlimitedCreditGates.test.ts`.
- [ ] Verify exact-head CI and security workflows succeed after checkout consolidation.
- [ ] Verify production deployment completes on Fly.io.
- [ ] Run real authenticated signup → login → logout → relogin flow.
- [ ] Run real Starter/Builder/Studio Stripe test checkout and confirm webhook subscription reconciliation.
- [ ] Run real 50/100/250 credit-pack checkout and confirm exactly-once ledger crediting.
- [ ] Exercise Senior Dev collaborative flow: reserve → plan → approval → resume → completion.
- [ ] Exercise Senior Dev failure path and verify reservation refund occurs exactly once.
- [ ] Exercise disconnect/reconnect paths and confirm no duplicate charging or execution.
- [ ] Run a real production build through BullMQ/Redis/fallback execution and verify terminal SSE replay.
- [ ] Confirm Sentry/structured logs capture auth, checkout, build, Senior Dev, refund, and deployment failures without credentials/tokens.
- [ ] Final manual production approval before accepting paying customers.

## Code safeguards for the eight launch limitations

The repository now enforces these safeguards in code and regression tests:

- Structural-only mobile, desktop, Chrome extension, and Python stacks remain
  source deliverables; they have no supported live deployment or production
  certification path.
- GitHub Pages is not a deployment destination. Authenticated GitHub source
  export remains available.
- The 11 reviewed locale catalogs are explicit; all other locale choices are
  labeled as English fallback and use English text/direction.
- The legacy recipe-generated hosted runtime was removed. Hosted products use
  validated artifacts and isolated preview only.
- Generic project/build `completed` status is no longer treated as
  validation/certification; valid agent/task completion states are unchanged.
- Production Sentry source-map publication requires credentials and a
  deterministic exact-commit release, and uploads source maps under that same
  release.
- Production release verification fails if GitHub cannot confirm suitable
  branch protection or an active ruleset for `main`.
- Production release verification performs read-only live probes for Stripe
  and any enabled/configured Vercel, Netlify, or Supabase SSO provider. It
  records sanitized provider, timestamp, release SHA, artifact identity, and
  result evidence; it does not treat implementation/unit tests as live proof.

## External evidence required before paid launch

These code safeguards do not establish that external systems are configured
or that a real customer journey has succeeded. The exact release must pass the
production workflow with:

- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` in the protected
  `production` environment. The release ID is derived from the exact commit as
  `appforge@<RELEASE_SHA>`.
- A GitHub token able to read repository administration metadata. The workflow
  requests the least-privilege `administration: read` permission; missing or
  denied API access fails the gate.
- A live Stripe key and an enabled production webhook at the configured
  AppForge URL. The verifier uses read-only API calls and does not create a
  charge; the real checkout/webhook journey remains a separate required check.
- Credentials and resource IDs for every enabled Vercel/Netlify deployment
  provider. Set `APPFORGE_REQUIRED_LIVE_PROVIDERS` for additional mandatory
  adapters and `APPFORGE_OPTIONAL_LIVE_PROVIDERS` for enabled optional ones.
- `SUPABASE_SSO_ENABLED=true` and Supabase URL/service-role credentials when
  SSO is enabled. The verifier confirms an active SSO provider; an actual SSO
  login journey must still be exercised separately.

`npm run provider:verify -- --dry-run` is available for non-production
validation only. Dry-run records `dry_run`, never `verified`, and production
rejects it. A successful unit test or dry run is not external live evidence.
The production workflow retains the sanitized verification artifact. Do not
claim a provider or Sentry workflow is live-verified until that workflow has
successfully completed against the intended release with real credentials.

## Release rule

Do not mark AppForge approved for paying customers until every unchecked launch gate above has passed against the deployed production revision.

For an owner-run staging sequence and first-tester handoff, follow
[the self-test and first-tester playbook](SELF_TEST_AND_FIRST_TESTER.md). Its
checklists must be completed with evidence; the document itself does not
constitute a successful test run.
