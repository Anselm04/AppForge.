# AppForge Internal Capability Broker & Composio Security Design

Date: 2026-10-05
Status: Approved architecture; design specification for implementation planning

## 1. Purpose

Composio is an internal AppForge capability provider only. It is not a customer-facing feature, admin-facing tool, or direct user integration surface. AppForge uses it autonomously when build orchestration determines that an external platform capability is needed to satisfy a user's build intent.

The security objective is to keep AppForge authoritative at all times: Composio may discover or execute approved external capabilities, but it may never decide its own permissions, broaden its own access, bypass AppForge policy, access unrelated customer/project data, touch AppForge billing/security administration, or become required for core AppForge availability.

## 2. Non-negotiable requirements

1. No public/user Composio router or UI.
2. Only AppForge orchestration/build agents may request capabilities.
3. Users express intent, never Composio tools.
4. Composio discovery remains available internally.
5. AppForge owns authorization and policy decisions.
6. External credentials are isolated to the applicable project/build connection.
7. High-risk and platform-administrative capabilities are denied by default.
8. Every capability operation is auditable with secrets redacted.
9. Composio is replaceable behind an internal provider interface.
10. AppForge can autonomously restrict, quarantine, or disable Composio without taking AppForge offline.
11. Security incidents and autonomous containment actions are surfaced in the AppForge admin dashboard.
12. AppForge source code, privileged secrets, billing, authentication, and unrelated TrillionAI products remain outside Composio's trust boundary.

## 3. Target architecture

AppForge User
→ Intent / Planning Agents
→ Task Manager / Build Orchestration
→ Internal Capability Broker
→ Policy & Permission Engine
→ Composio Security Watchdog
→ Composio Provider Adapter
→ Approved External Platform
→ Result to AppForge
→ Validation / Security Agents
→ Build Continues

Users and ordinary application routes never call Composio directly.

## 4. Components

### 4.1 CapabilityBroker

Single internal entry point for agent capability discovery and execution.

Responsibilities:
- validate internal execution context;
- enforce project/customer/build isolation;
- invoke policy evaluation before discovery/execution;
- select an enabled provider;
- call the provider through a provider-neutral interface;
- write audit events;
- pass results through validation/sanitization;
- fail closed for disallowed actions;
- degrade gracefully when a provider is unavailable.

Agents must depend on CapabilityBroker, not on `@composio/core`.

### 4.2 CapabilityProvider interface

Provider-neutral contract for discovery and execution so Composio can be replaced without changing build agents.

Initial provider: `ComposioProvider`.

Future providers may include native integrations or other brokers without changing the agent-facing interface.

### 4.3 Policy & Permission Engine

AppForge is the authority. Every requested capability is evaluated before a provider call.

Required execution context:
- customerId
- projectId
- buildJobId
- requestingAgent
- purpose
- requestedCapability
- requestedScopes
- correlationId

Default-deny categories include:
- AppForge authentication/MFA changes;
- AppForge billing/Stripe administration;
- AppForge platform-security changes;
- master/root/service-role credential retrieval;
- cross-customer or cross-project access;
- access to unrelated TrillionAI products;
- self-escalation or permission broadening;
- disabling logging, policy, watchdog, or audit controls;
- arbitrary platform administration not required by the active build;
- repository/account enumeration outside the active project scope.

Policy must be evaluated by AppForge code before any Composio execution.

### 4.4 ComposioProvider

Server-side adapter only.

Responsibilities:
- hold/use the server-side Composio API key;
- create AppForge-scoped sessions;
- perform internal tool discovery;
- execute only broker-approved actions;
- expose no public route;
- return normalized provider results to CapabilityBroker;
- never persist provider credentials into generated source or logs.

### 4.5 Composio Security Watchdog

Continuously evaluates provider activity and can autonomously change provider state.

Provider states:
- `healthy`
- `restricted`
- `quarantined`
- `disabled`

Signals include:
- denied permission-escalation attempts;
- cross-project/customer access attempts;
- unexpected tool/domain access;
- unusual request/error rates;
- repeated provider failures;
- requests involving protected AppForge assets;
- malformed or anomalous provider responses;
- credential-access patterns;
- policy bypass attempts;
- integrity/health check failures.

Autonomous responses may include:
- reject the current operation;
- lower allowed capability scope;
- quarantine the provider;
- set provider state to disabled;
- prevent new Composio calls;
- allow AppForge core/build processing to continue where possible;
- create a security incident record;
- raise an admin-dashboard alert.

Composio cannot alter its own watchdog state.

## 5. Credential isolation

- `COMPOSIO_API_KEY` remains server-only and must never appear in `VITE_*`, browser code, generated apps, logs, or customer-visible output.
- External account connections should be scoped to the specific customer/project/build context that requires them.
- No universal privileged GitHub, Stripe, database, Cloudflare, infrastructure, MFA, or TrillionAI credential is supplied through the capability provider.
- Provider results and logs must pass through secret-redaction before persistence.
- Credential references should be opaque identifiers where feasible rather than raw secrets.

## 6. Source-code protection

Composio is not trusted with unrestricted AppForge source access.

Rules:
- no repository-wide source export through Composio;
- no AppForge `.env`, secret-store, CI secret, billing, auth, or security configuration disclosure;
- no provider action may alter AppForge's own source repository unless a separately designed internal maintenance capability is explicitly introduced in the future;
- generated customer-project artifacts are handled through the active build's scoped workspace, not AppForge's platform source tree;
- attempts to address protected platform paths are denied and audited.

## 7. Audit model

Each capability event records, at minimum:
- timestamp
- correlationId
- buildJobId
- projectId
- customerId
- requestingAgent
- provider
- capability/tool identifier
- purpose
- policy decision
- risk level
- scopes granted/denied
- provider state
- result status
- latency
- sanitized result/error metadata
- autonomous containment action, if any

Raw credentials, access tokens, secret headers, and sensitive payload fields are never written to the audit record.

## 8. Kill switches and fail-safe behavior

Environment/config controls:
- `CAPABILITY_BROKER_ENABLED`
- `COMPOSIO_ENABLED`

Behavior:
- disabling Composio must not disable AppForge;
- broker may select another provider when available;
- otherwise it returns a scoped capability-unavailable result to orchestration;
- no direct fallback that bypasses policy is allowed;
- provider state can be changed autonomously by the watchdog on confirmed security triggers.

## 9. Admin dashboard alerts

Security incidents appear in the owner/admin dashboard with:
- severity;
- timestamp;
- affected project/build;
- provider and attempted capability;
- policy/watchdog reason;
- whether the operation was blocked;
- autonomous action taken (`restricted`, `quarantined`, `disabled`);
- sanitized evidence/correlation ID;
- current provider health/state;
- remediation status.

Critical incidents must be visually prominent and persistent until acknowledged/resolved. The dashboard must never expose raw secrets in alert details.

## 10. Public surface removal

Remove the current public/authenticated Composio router and router registration. No customer or admin UI should expose `composio.searchTools`, provider credentials, raw tool lists, or direct provider execution.

Internal discovery is invoked only by AppForge orchestration through CapabilityBroker.

## 11. Integration with existing build system

The broker should be invoked from existing orchestration/build-agent paths, not as a parallel user API.

The build worker/task manager supplies the execution context and intent. Capability results are validated before they can affect generated artifacts or deployment steps.

Existing queue, recovery, evidence, and production-certification controls remain authoritative. Capability-provider failure must not bypass build evidence or certification requirements.

## 12. Testing and acceptance criteria

Implementation is not complete until tests prove:

1. no Composio public router exists;
2. authenticated users cannot directly invoke Composio;
3. agents cannot bypass CapabilityBroker for Composio operations;
4. cross-customer access is denied;
5. cross-project access is denied;
6. AppForge billing access is denied;
7. AppForge auth/MFA/security administration access is denied;
8. unrelated TrillionAI product access is denied;
9. protected AppForge source/secrets cannot be exposed through provider actions;
10. audit logs redact secrets;
11. every allowed/denied operation creates the expected audit event;
12. `COMPOSIO_ENABLED=false` prevents execution;
13. disabling/quarantining Composio does not take AppForge offline;
14. internal capability discovery continues to work while enabled;
15. permitted scoped capability execution works;
16. abnormal behavior can move provider state to restricted/quarantined/disabled;
17. autonomous containment creates an admin-dashboard security alert;
18. provider substitution can occur without changing build-agent interfaces;
19. type checks, unit tests, build, security/release gates and production smoke tests remain green.

## 13. Security posture

Composio is treated as an untrusted external capability provider operating behind AppForge-controlled boundaries. AppForge does not assume a third party can never be compromised; instead, it minimizes blast radius, enforces least privilege, detects abnormal behavior, contains incidents autonomously, and keeps core AppForge availability independent of the provider.

This design preserves AppForge's role as the sole authority over capability use and protects platform source, secrets, billing, security controls, customer isolation, and other TrillionAI products.
