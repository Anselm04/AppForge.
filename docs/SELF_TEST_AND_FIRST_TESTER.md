# AppForge self-test and first-tester playbook

Use this playbook to validate AppForge yourself before inviting the first tester.
It is a test procedure, not evidence that any environment or provider has passed.
Run it against a dedicated non-production deployment and test data only.

## 1. Prepare the test environment

- Deploy a specific revision to an isolated staging/test environment. Record the
  URL and Git commit SHA. Do not point test billing at live Stripe.
- Configure separate test database, Redis, authentication, AI, and webhook
  credentials. Never copy production customer data or production secrets into
  the test environment.
- Confirm `/api/health/live` returns HTTP 200 and `/api/health/ready` returns
  HTTP 200. Liveness alone is not readiness; readiness must confirm startup,
  database, and production-mode Redis dependencies.
- Create a normal test user with the narrowest access needed. Verify sign-up,
  sign-in, refresh/reopen, sign-out, and sign-in again.
- Confirm you can access the test user's build history and sanitized logs, and
  can retry a failed build without giving the test user owner/admin permissions.
- Use synthetic prompts and data. Record failures with timestamps and project,
  task, artifact, and release IDs, but remove access tokens, credentials, and
  personal data from screenshots and logs.

Stop if the environment is production, uses live payment credentials, or its
database, Redis, or account boundaries cannot be distinguished from production.

## 2. Self-test six independent build categories

Run each as a separate project. Pick a supported runnable web stack when
previewing behavior. A successful generation status or non-empty ZIP alone is
not a passing functional test.

| Category         | Example prompt focus                                                 | Minimum behavior to exercise                                                                    |
| ---------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| App              | A small task tracker with create, edit, complete, and filter actions | Create and update records; refresh and confirm persistence if storage is requested              |
| Agent            | An agent that categorizes a supplied list and explains each result   | Submit a bounded input; check the result, error handling, and that no unrequested action occurs |
| Game             | A simple playable browser game with start, score, and restart        | Load the actual preview; play, observe score/state changes, and restart                         |
| Tool             | A unit or text converter with input validation                       | Check known inputs, invalid/empty input, and boundary values                                    |
| Software product | A minimal inventory or contact manager with search and CRUD          | Exercise the main workflow, validation, and persistence if requested                            |
| Website          | A multi-page informational website with navigation and contact form  | Check routes, responsive layout, links, form validation, and submission behavior                |

For every project, record the prompt, stack, build result, generated files,
preview or source-export result, actions tested, errors, rebuild result, and
artifact identity using the record below. If a requested integration needs
provider credentials, mark it unverified until tested against an isolated test
account; do not substitute a mock as live proof.

### Structural-only outputs

Mobile, desktop, Chrome extension, and Python adapters are source deliverables
only. For one of those outputs, inspect/download the source and follow its
documented local toolchain instructions if that category requires it. Record
“source export inspected” and the limitation; do not record native preview,
deployment, or production certification as passed.

### Per-project evidence record

Copy this block once per project and retain it with the test session:

```text
Category:
Test date/time (UTC):
Environment URL:
AppForge Git SHA:
Project ID:
Prompt:
Selected stack / structural-only:
Build status and terminal event:
Artifact version and SHA-256:
Generated files inspected:
Preview URL or source export:
Core actions and expected results:
Actual results:
Persistence/integration evidence, if applicable:
Errors and sanitized log references:
Rebuild result and artifact identity:
Pass / fail / blocked:
Follow-up issue:
```

Pass only when the category's requested behavior works in the actual preview or
the documented source-deliverable checks, terminal status agrees with the
artifact evidence, and a rebuild is reproducible. Mark unavailable or
credential-dependent checks **blocked**, not passed.

## 3. Repeat reliability and recovery checks

- Sign in, refresh/reopen, sign out, and sign in again with the test account.
- Cause a safe, reproducible build failure (for example, a deliberately
  impossible requirement); verify a truthful failure state and retry.
- Confirm the build event stream reaches a terminal event and its final status,
  project record, and artifact identity agree.
- Reopen successful previews and repeat the important actions. Confirm required
  project data persists after reload.
- Verify logs and screenshots are useful but do not expose secrets, cookies,
  payment details, or another user's data.
- Record recovery actions and the final state. Stop on duplicate execution,
  duplicate credit changes, ownership leaks, false success, or unrecoverable
  state; do not invite a tester until fixed and rechecked.

## 4. Test billing only after the self-test gate

Keep this step in Stripe test mode and on the isolated environment. Confirm
“one month god code” means the intended one-month test subscription/entitlement
and its actual tier before starting; do not assume it is a Stripe product name
or grant lifetime/owner access.

1. Use a dedicated test customer and test-mode price IDs, secret key, and
   webhook signing secret. Confirm the webhook points only to the test
   environment. Use Stripe test cards and, where supported, a Stripe test clock
   to exercise time-based renewal/cancellation without real charges.
2. Complete checkout and verify the signed webhook is accepted, processed
   idempotently, and updates the same test account's entitlement and billing
   history. Confirm no other account is changed.
3. Build once while the test entitlement is active. Record the build/artifact
   identity and verify the account receives exactly the intended access.
4. Exercise cancellation/expiry or downgrade using the test clock or equivalent
   supported test procedure. Verify entitlement changes at the expected time;
   do not infer expiry behavior from a successful checkout.
5. Build again after the entitlement transition and verify the expected allowed
   or denied outcome. Check credit balances/ledger entries and webhook
   idempotency for duplicates.
6. Keep checkout, webhook, entitlement, post-transition build, and refund/
   cancellation evidence separate. All must pass before reporting the billing
   test as successful.

Never use a real payment method for this pre-tester sequence. If Stripe test
credentials or an isolated webhook are unavailable, leave billing **blocked**
and defer tester access.

## 5. First-tester handoff gate

Invite the tester only after:

- all six project records have a result, with no unresolved release-blocking
  failures;
- runnable projects pass their real preview workflows, and structural-only
  outputs are accurately labeled as source exports;
- sign-in/out, failure/retry, terminal event, artifact identity, and recovery
  checks are repeatable;
- test-mode checkout, webhook reconciliation, entitlement, cancellation/expiry,
  and the follow-up build have been verified, if payment testing is in scope;
- the environment URL and revision are recorded and confirmed non-production;
- the tester has a narrow test account, exact scenarios, expected outcomes, and
  a private channel for reporting issues.

Give the tester a short session window and ask them to stop and report any
unexpected charge, permission/data leak, false success, or inability to recover.
Do not grant broad owner/admin access. Keep screenshots and logs in a private,
access-controlled location.

## 6. Record the tester session

```text
Tester/session ID (avoid unnecessary personal data):
Environment URL and Git SHA:
Start/end time (UTC):
Scenarios attempted:
Expected vs actual result:
Project/task/artifact IDs:
Sanitized log or screenshot references:
Payment test-mode event IDs (never card data or secrets):
Issues filed and severity:
Retest result:
Access revoked / test data cleaned:
```

This playbook does not replace the external production release evidence and
manual approval required by the [production gate](PRODUCTION_GATE_93_TO_100.md).
