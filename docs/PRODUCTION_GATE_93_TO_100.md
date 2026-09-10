# AppForge Production Gate: 93% → 100%

Current production-hardening checkpoint after `dc917394`.

## Completed in this pass

- [x] Project-chat Senior Dev trigger honors unlimited/lifetime credit entitlement.
- [x] Stripe checkout session creation centralized in `src/services/stripeCheckout.ts`.
- [x] Removed hard-coded Stripe price ID fallbacks from the active checkout implementation.
- [x] Enterprise excluded from self-serve Stripe plan provisioning.
- [x] Regression tests added for unlimited credit gates and canonical checkout boundaries.

## Remaining launch gates

- [ ] Fix Senior Dev resume-after-approval credit gate so unlimited/lifetime accounts are never blocked by raw balance.
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

## Release rule

Do not mark AppForge approved for paying customers until every unchecked launch gate above has passed against the deployed production revision.
