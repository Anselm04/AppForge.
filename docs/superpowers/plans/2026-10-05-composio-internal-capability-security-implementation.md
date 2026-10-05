# AppForge Internal Capability Broker & Composio Security Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Follow TDD: write the failing test first, run it, implement the smallest correct change, rerun the focused test, then continue. Do not skip the final verification gate.

**Goal:** Convert Composio from an authenticated user-facing integration into a zero-trust, internal AppForge capability provider controlled exclusively by build orchestration, with persisted policy/audit/watchdog state, autonomous containment, and owner-dashboard security alerts.

**Architecture:** AppForge build orchestration calls a provider-neutral `CapabilityBroker`. The broker validates project/customer/build context, evaluates AppForge-owned policy, reads persisted provider state, records secret-redacted audit events, and invokes a `CapabilityProvider` only when allowed. Composio becomes one replaceable server-side provider. A persisted watchdog state machine can move Composio through `healthy`, `restricted`, `quarantined`, and `disabled` across all production machines. Security incidents are persisted and surfaced through the existing owner+SMS-MFA admin dashboard. Users never call or select Composio tools directly.

**Tech Stack:** TypeScript, Node.js 22, tRPC, Drizzle/PostgreSQL, React/TanStack Query, Vitest, existing AppForge generated agent pipeline, Prometheus/Grafana-compatible operational metrics, `@composio/core`.

**Approved design:** `docs/superpowers/specs/2026-10-05-composio-internal-capability-security-design.md`

---

## Task 1: Lock down the public surface before adding new functionality

**Files:**
- Modify: `src/routers/index.ts`
- Delete: `src/routers/composio.ts`
- Create: `src/__tests__/composioInternalOnly.test.ts`

**Step 1 — Write the failing contract test**

Create `src/__tests__/composioInternalOnly.test.ts` that reads `src/routers/index.ts`, `src/pages`, and the future capability-provider paths and asserts:
- `composioRouter` is not imported or registered in `appRouter`;
- no client code contains `trpc.composio`, `composio.searchTools`, or direct Composio execution;
- only the dedicated Composio provider module may import `@composio/core` once that provider exists.

**Step 2 — Run the focused test and confirm it fails**

Run:
`npx vitest run src/__tests__/composioInternalOnly.test.ts`

Expected failure: current `src/routers/index.ts` still imports/registers `composioRouter` and `src/routers/composio.ts` exists.

**Step 3 — Remove the route**

Delete `src/routers/composio.ts` and remove both the import and `composio: composioRouter` registration from `src/routers/index.ts`.

Do not expose a replacement Composio endpoint under `admin`, `capabilities`, `system`, or any other router.

**Step 4 — Rerun the test**

`npx vitest run src/__tests__/composioInternalOnly.test.ts`

Expected: pass for the public-surface assertions.

**Step 5 — Commit**

Commit message: `security: remove public Composio surface`

---

## Task 2: Define provider-neutral capability contracts and deterministic policy

**Files:**
- Create: `src/capabilities/types.ts`
- Create: `src/capabilities/policy.ts`
- Create: `src/capabilities/redaction.ts`
- Create: `src/__tests__/capabilityPolicy.test.ts`
- Modify: `src/__tests__/productHardeningGuardrails.test.ts`

**Step 1 — Write failing policy tests**

Tests must cover `CapabilityExecutionContext` with:
- `customerId`
- `projectId`
- `buildJobId`
- `requestingAgent`
- `taskId` when available
- `purpose`
- `requestedCapability`
- `requestedScopes`
- `correlationId`

Define provider-neutral interfaces/types including:
- `CapabilityProviderState = "healthy" | "restricted" | "quarantined" | "disabled"`
- risk level (`low | medium | high | critical`)
- discovery request/result
- execution request/result
- `CapabilityProvider` interface with `id`, `isConfigured`, `discover`, and `execute`.

Policy tests must prove default denial for requests involving:
- AppForge source repository/platform source paths;
- `.env`, CI secrets, root/master/service-role credentials;
- AppForge auth/MFA;
- AppForge Stripe/billing administration;
- AppForge platform security/policy/audit/watchdog settings;
- other TrillionAI products;
- cross-project or cross-customer access;
- self-escalation/permission broadening;
- unrelated repository/account enumeration.

Also prove a narrowly scoped customer-project integration request can be allowed.

**Step 2 — Run the failing tests**

`npx vitest run src/__tests__/capabilityPolicy.test.ts src/__tests__/productHardeningGuardrails.test.ts`

**Step 3 — Implement types and policy**

Implement pure deterministic policy functions. Policy input must include both the active trusted context and the requested target/scope so cross-project/customer mismatches are mechanically rejected, not left to LLM judgment.

Reuse the existing `assertSafeExternalPayload` guard where appropriate, but do not weaken it. Add a separate recursive sanitizer/redactor for persisted metadata so logging a rejected request never leaks secret-like fields.

The sanitizer must redact keys matching credential concepts such as authorization, cookie, password, secret, token, API key, private key, service role, access key, refresh token, and session; it must bound recursion and output size.

**Step 4 — Run focused tests**

Expected: all policy/guardrail tests pass.

**Step 5 — Commit**

Commit message: `security: add capability policy and redaction contracts`

---

## Task 3: Persist audit events, provider state, and security incidents across machines

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/ensureSchema.ts`
- Create: `src/capabilities/store.ts`
- Create: `src/__tests__/capabilityPersistenceContract.test.ts`

**Step 1 — Write failing schema contract tests**

Assert schema/runtime migration source defines three durable stores:

1. `capability_audit_events`
   - correlation ID
   - customer/user ID
   - project ID
   - build job ID
   - requesting agent/task
   - provider
   - capability/tool identifier
   - purpose
   - policy decision
   - risk level
   - granted/denied scopes JSON
   - provider state
   - result status
   - latency
   - sanitized metadata JSON
   - containment action
   - timestamp

2. `capability_security_incidents`
   - provider
   - correlation ID
   - severity
   - project/build references
   - reason
   - attempted capability
   - containment action
   - provider state
   - sanitized evidence JSON
   - acknowledged timestamp
   - resolved timestamp
   - created timestamp

3. `capability_provider_states`
   - provider primary key/unique identity
   - state
   - reason
   - failure/anomaly counters if needed
   - updated timestamp

Add indexes for provider/state, project, correlation ID, unresolved incidents, and recent timestamps.

**Step 2 — Run the failing test**

`npx vitest run src/__tests__/capabilityPersistenceContract.test.ts`

**Step 3 — Implement Drizzle schema and authoritative runtime migration**

Add the tables to both `src/db/schema.ts` and `src/db/ensureSchema.ts`. The latter is AppForge’s authoritative production migration path, so both must stay synchronized.

Implement `src/capabilities/store.ts` helpers for:
- recording audit events;
- reading/upserting provider state transactionally;
- creating incidents;
- listing unresolved/recent incidents;
- acknowledging/resolving incidents.

Use database state as the source of truth so AppForge’s redundant production machines cannot disagree on whether Composio is quarantined or disabled.

**Step 4 — Rerun focused tests**

Expected: schema contract tests pass.

**Step 5 — Commit**

Commit message: `security: persist capability audits and provider state`

---

## Task 4: Add kill switches and production environment validation

**Files:**
- Modify: `.env.example`
- Modify: `src/_core/env.ts`
- Modify: `src/utils/env-validator.ts`
- Modify: `src/__tests__/productionEnvValidator.test.ts`

**Step 1 — Add failing environment tests**

Extend `productionEnvValidator.test.ts` to prove:
- core AppForge remains valid when Composio is disabled/unconfigured;
- `COMPOSIO_ENABLED=true` requires `CAPABILITY_BROKER_ENABLED=true`;
- `COMPOSIO_ENABLED=true` requires `COMPOSIO_API_KEY`;
- `COMPOSIO_API_KEY` is never a `VITE_*` variable;
- invalid boolean flag values are rejected.

**Step 2 — Run focused tests and confirm failure**

`npx vitest run src/__tests__/productionEnvValidator.test.ts`

**Step 3 — Implement configuration**

Add server-only environment controls:
- `CAPABILITY_BROKER_ENABLED`
- `COMPOSIO_ENABLED`
- `COMPOSIO_API_KEY`

Recommended safe defaults:
- broker enabled only when explicitly configured for production rollout;
- Composio disabled unless explicitly enabled and keyed.

Expose normalized booleans and the server-only key through `ENV`; never through browser build variables.

**Step 4 — Rerun the environment tests**

Expected: pass.

**Step 5 — Commit**

Commit message: `security: validate capability provider kill switches`

---

## Task 5: Replace the current Composio service with a scoped provider adapter

**Files:**
- Create: `src/capabilities/providers/composioProvider.ts`
- Create: `src/__tests__/composioProvider.test.ts`
- Delete after migration: `src/services/composio.ts`
- Replace/delete: `src/__tests__/composio.service.spec.ts`

**Step 1 — Write failing provider tests**

Prove that:
- only the provider imports `@composio/core`;
- provider reports unconfigured when disabled or no API key exists;
- session identity is project-scoped, e.g. `appforge:customer:<id>:project:<id>`, while build/job correlation remains in AppForge audit context;
- discovery uses `COMPOSIO_SEARCH_TOOLS` internally;
- execution accepts only a broker-approved tool request and never accepts raw user identity/input as authorization;
- returned provider data is normalized and bounded;
- provider errors do not expose the API key.

**Step 2 — Run focused tests**

`npx vitest run src/__tests__/composioProvider.test.ts src/__tests__/composioInternalOnly.test.ts`

**Step 3 — Implement provider**

Move all Composio SDK knowledge into `composioProvider.ts`. Keep the SDK client server-side and singleton-safe, but make project scope part of session creation.

Do not give the provider authority to choose scopes, change policy, alter watchdog state, or call arbitrary AppForge services.

Delete `src/services/composio.ts` only after all imports have moved.

**Step 4 — Rerun tests**

Expected: provider and internal-only tests pass.

**Step 5 — Commit**

Commit message: `refactor: isolate Composio behind provider interface`

---

## Task 6: Build the internal CapabilityBroker and provider registry

**Files:**
- Create: `src/capabilities/providerRegistry.ts`
- Create: `src/capabilities/broker.ts`
- Create: `src/__tests__/capabilityBroker.test.ts`

**Step 1 — Write failing broker tests using fake providers**

Use an injected fake `CapabilityProvider` so tests do not call Composio or the network.

Prove:
- disabled broker returns a scoped unavailable result without taking AppForge down;
- disabled/quarantined provider is never invoked;
- restricted provider can perform discovery but is denied execution unless policy explicitly permits the restricted operation;
- policy is evaluated before provider invocation;
- every allowed/denied/unavailable operation attempts an audit record;
- provider substitution works without changing the broker caller;
- provider exceptions become contained results, not process crashes;
- cross-project/customer mismatches are blocked before provider invocation.

**Step 2 — Run focused tests**

`npx vitest run src/__tests__/capabilityBroker.test.ts`

**Step 3 — Implement registry and broker**

`CapabilityBroker` is the only supported AppForge entry point for provider discovery/execution. It must:
1. validate trusted execution context;
2. verify the project belongs to `customerId` using persisted project ownership;
3. read the persisted provider state;
4. evaluate policy;
5. write denied audit events before returning denial;
6. invoke only an enabled provider;
7. bound/sanitize the result;
8. write success/failure audit events;
9. send outcome signals to the watchdog;
10. return normalized results to orchestration.

Do not create a tRPC route for the broker.

**Step 4 — Rerun broker tests**

Expected: pass.

**Step 5 — Commit**

Commit message: `feat: add internal AppForge capability broker`

---

## Task 7: Add the autonomous Composio Security Watchdog

**Files:**
- Create: `src/capabilities/watchdog.ts`
- Create: `src/__tests__/capabilityWatchdog.test.ts`
- Modify: `src/lib/operationsObservability.ts`
- Modify: `monitoring/alerts.yml`
- Modify: `monitoring/grafana/dashboards/appforge-operations.json`

**Step 1 — Write failing watchdog tests**

Test state transitions for explicit signals:
- normal success keeps `healthy`;
- repeated provider failures can move to `restricted`;
- policy-bypass, protected-source/credential access, or cross-project/customer attempts move directly to at least `quarantined`;
- confirmed critical integrity/security signal can move to `disabled`;
- quarantine/disable is persisted before any later call is allowed;
- containment creates a security incident with sanitized evidence;
- provider cannot change its own state;
- recovery to a less restrictive state is an AppForge-owned operation with explicit evidence/thresholds, never a Composio response field.

**Step 2 — Run focused watchdog tests**

`npx vitest run src/__tests__/capabilityWatchdog.test.ts`

**Step 3 — Implement watchdog and telemetry**

Use persisted provider state as authority. Add bounded counters/metrics such as:
- `appforge_capability_requests_total{provider,result}`
- `appforge_capability_policy_denials_total{provider,risk}`
- `appforge_capability_security_incidents_total{provider,severity}`
- provider-state gauge without customer/project IDs in Prometheus labels.

Add monitoring alerts for Composio quarantine/disable and elevated capability policy denials. Do not put project IDs, user IDs, secrets, or raw tool arguments into metrics labels.

**Step 4 — Rerun tests and observability tests**

`npx vitest run src/__tests__/capabilityWatchdog.test.ts src/__tests__/section23OperationsObservability.test.ts`

Expected: pass.

**Step 5 — Commit**

Commit message: `security: add autonomous Composio watchdog`

---

## Task 8: Wire capability discovery/execution into the real build orchestration path

**Files:**
- Modify: `src/agents/.pipeline_parts/part0.txt`
- Modify: `src/agents/.pipeline_parts/part1.txt`
- Modify: `src/agents/.pipeline_parts/part2.txt`
- Regenerate via: `scripts/assemble-pipeline.mjs` (do not hand-edit generated source)
- Modify/Create tests: `src/__tests__/capabilityPipelineIntegration.test.ts`

**Step 1 — Write failing pipeline contract tests**

Assert the source-of-truth pipeline parts:
- import/use `CapabilityBroker`, not Composio directly;
- derive capability context from persisted `projectId` + project owner + build/task identity;
- call internal discovery only for requirements/tasks where an external integration capability is relevant;
- feed only sanitized discovery guidance/results into agent context;
- never expose raw Composio tool selection to the user;
- never let an agent bypass broker policy by importing the provider directly;
- treat provider unavailable/quarantined as a capability limitation while allowing unrelated build work to continue where possible;
- retain all existing validation, security audit, evidence, and production-certification gates.

**Step 2 — Run failing test**

`npx vitest run src/__tests__/capabilityPipelineIntegration.test.ts`

**Step 3 — Implement orchestration integration**

Extend the pipeline’s persisted project query to include owner/user ID. Build internal broker context from trusted data, not user-provided IDs.

For integration-owned product-plan tasks, allow the pipeline to ask the broker for relevant capabilities from the task purpose/product contract. The LLM receives sanitized capability descriptions, not authority to choose unrestricted provider actions.

Execution of a discovered external tool is allowed only through a second broker call with an explicit capability, scoped arguments, and policy decision. The broker remains the sole executor.

Preserve `scripts/assemble-pipeline.mjs` as the generated-pipeline source of truth and regenerate before tests/build.

**Step 4 — Run focused plus pipeline tests**

`node scripts/assemble-pipeline.mjs`

`npx vitest run src/__tests__/capabilityPipelineIntegration.test.ts src/lib/__tests__/agentCoordination.test.ts src/lib/__tests__/productPlan.test.ts`

Expected: pass.

**Step 5 — Commit**

Commit message: `feat: let AppForge orchestration use internal capabilities`

---

## Task 9: Surface persisted security incidents in the owner dashboard

**Files:**
- Modify: `src/routers/admin.ts`
- Modify: `src/pages/Admin.tsx`
- Create: `src/__tests__/capabilityAdminSecurity.test.ts`
- Modify: `src/__tests__/section23OperationsObservability.test.ts`

**Step 1 — Write failing admin-security tests**

Prove:
- only `ownerOnlyProcedure` can read capability security status/incidents;
- owner-only query returns provider state, unresolved incidents, recent sanitized audit events, and counts;
- owner can acknowledge an incident;
- owner can resolve an incident only through AppForge admin logic, not by changing raw provider fields;
- dashboard includes a `Security` tab;
- unresolved critical incidents render a prominent persistent banner even when another tab is selected;
- UI never renders secret-bearing raw payloads;
- provider state (`healthy/restricted/quarantined/disabled`) is visible.

**Step 2 — Run failing tests**

`npx vitest run src/__tests__/capabilityAdminSecurity.test.ts src/__tests__/section23OperationsObservability.test.ts`

**Step 3 — Implement admin API and UI**

Add owner-only procedures such as:
- `admin.capabilitySecurity`
- `admin.acknowledgeCapabilityIncident`
- `admin.resolveCapabilityIncident` if resolution semantics are implemented in the same task.

Poll security status at a modest interval (e.g. 10–15 seconds) only after owner MFA is verified. Keep critical unresolved alerts visible until acknowledged/resolved.

No end-user/project route should expose these records.

**Step 4 — Rerun focused tests**

Expected: pass.

**Step 5 — Commit**

Commit message: `feat: alert owner to capability security incidents`

---

## Task 10: Add architecture-level anti-bypass and secret-leak regression tests

**Files:**
- Create: `src/__tests__/capabilityArchitectureGuardrails.test.ts`
- Modify: `src/__tests__/productHardeningGuardrails.test.ts`
- Modify if needed: `scripts/recovery-governance.sh`

**Step 1 — Write architecture guardrail tests**

Scan production source and assert:
- `@composio/core` appears only in the provider adapter;
- no router imports a Composio provider;
- no page/client module imports any internal capability provider/broker server code;
- pipeline imports broker only;
- no provider module imports Stripe billing, admin MFA, owner, secret-store, or platform source-management code;
- no `VITE_COMPOSIO*` variable exists;
- Composio key never appears in generated files/test fixtures;
- recovery governance treats capability broker, watchdog, schema/migration, policy, and provider files as security/recovery critical.

**Step 2 — Run failing tests**

`npx vitest run src/__tests__/capabilityArchitectureGuardrails.test.ts src/__tests__/productHardeningGuardrails.test.ts`

**Step 3 — Make the minimum governance updates**

If `scripts/recovery-governance.sh` does not cover the new critical subsystem paths, add them to the governed regex/list so changes cannot silently bypass recovery/security review.

**Step 4 — Rerun tests**

Expected: pass.

**Step 5 — Commit**

Commit message: `test: enforce capability security architecture`

---

## Task 11: Run the complete production verification gate

**Files:**
- No new product functionality. Fix only regressions caused by this implementation.

**Step 1 — Regenerate the pipeline**

`node scripts/assemble-pipeline.mjs`

**Step 2 — Run all capability-focused tests**

`npx vitest run src/__tests__/composioInternalOnly.test.ts src/__tests__/capabilityPolicy.test.ts src/__tests__/capabilityPersistenceContract.test.ts src/__tests__/productionEnvValidator.test.ts src/__tests__/composioProvider.test.ts src/__tests__/capabilityBroker.test.ts src/__tests__/capabilityWatchdog.test.ts src/__tests__/capabilityPipelineIntegration.test.ts src/__tests__/capabilityAdminSecurity.test.ts src/__tests__/capabilityArchitectureGuardrails.test.ts`

Expected: all pass.

**Step 3 — Run the full unit/coverage suite**

`npm run test -- --coverage --run`

Expected: pass with existing enforced coverage thresholds.

**Step 4 — Run type/lint/format gates**

`npm run typecheck`

`npm run lint`

Run Prettier check on all changed TypeScript/TSX files.

Expected: all pass.

**Step 5 — Run production build and golden-path E2E**

`npm run build`

`npm run test:e2e`

Expected: pass; generated server/client artifacts are non-empty.

**Step 6 — Run production dependency audit**

`npm audit --omit=dev --audit-level=moderate`

Expected: no moderate-or-higher production dependency vulnerability blocks release.

**Step 7 — Verify git/source invariants**

Confirm pipeline assembly/build did not mutate unintended tracked source and confirm no Composio key value is present in tracked files.

**Step 8 — Push and inspect GitHub CI/release gate**

Require the repository’s existing CI jobs to pass: lint/format, typecheck, test/coverage, security, product-factory validation, production build, and CI Release Gate. Then verify the production customer-flow smoke and recovery checks on the resulting commit before considering the change production-certified.

**Step 9 — Final security review**

Review the diff specifically for:
- public Composio re-exposure;
- broad provider credentials;
- raw provider-result logging;
- bypass imports;
- in-memory-only provider state;
- missing owner alerts;
- failures that could take AppForge core offline.

**Step 10 — Final commit if verification-only fixes were required**

Commit message: `chore: certify internal capability security gates`

---

## Implementation invariants

These must remain true throughout the work:

1. **Composio is not an AppForge authority.** It cannot approve itself, scopes, provider state, billing, security, source changes, or customer ownership.
2. **No user-facing Composio API exists.** Users provide build intent only.
3. **Project/customer identity comes from trusted AppForge persistence/build context, never provider/user-supplied IDs.**
4. **AppForge source and platform secrets stay outside the provider trust boundary.** Customer generated artifacts/workspaces are distinct from AppForge platform source.
5. **Provider state is shared/persisted.** A two-machine fleet must make the same quarantine/disable decision.
6. **Fail closed for security; degrade gracefully for availability.** A denied/unavailable provider does not become a bypass and does not crash unrelated AppForge functionality.
7. **Every capability decision is auditable, but secrets are never audit data.**
8. **The existing validation/security/recovery/production-certification system remains authoritative.** Capability success alone never means a build is production certified.
9. **Composio remains replaceable.** Agent/build code depends on `CapabilityBroker`, not provider-specific SDK APIs.
10. **Owner alerts are persistent and MFA-protected.** Security information is visible in the admin dashboard without exposing raw secrets.
