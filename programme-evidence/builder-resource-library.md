# AppForge Builder Resource Library Programme Evidence

## Scope lock

This programme implements only the private internal Builder Resource Library specified on 16 October 2026. It strengthens AppForge's autonomous builder and does not replace or duplicate working ProductContract, ProductPlan, requirement-manifest, capability, studio, adapter, template-marketplace, billing, auth, deployment, repair or recovery systems.

## Baseline

- Repository: `Anselm04/AppForge.`
- Baseline `main` SHA: `a82b0f64f0e00d0b6e8c5742129c6dadff7dab4a`
- Baseline meaning: PR #192 merged; the previous agreed capability/Golden Product foundation list was complete before this programme began.
- Working branch: `builder-resource-library-foundation`
- Pull request: #193
- Deliberate additional infrastructure/service spend: NZ$0

## Existing systems confirmed and preserved

The implementation reuses ProductContract and intake resolution, ProductPlan, requirement manifests, agent coordination, the 19 existing build-capability IDs, capability hints, creative orchestration, specialist studios, the customer-facing Template Marketplace, stack adapters, the Universal Adapter SDK maturity/evidence model, research/redesign, iterative repair, sandbox/build validation, artifact persistence, certification, billing, auth, deployment and recovery. The private resource system sits beneath those systems rather than becoming a parallel product factory or public template catalogue.

## Architecture implemented

The private library now has machine-readable manifests and deterministic registry/query behavior for atoms, components, modules, domain packs and reference architectures. Manifests carry identity/version, stack/runtime/platform compatibility, dependencies/integration points, contracts, environment/secret requirements, adaptation hooks, composition metadata, implementation/export policy, evidence, provenance/license/governance, maturity and quarantine/deprecation state.

Selection is ProductContract/ProductPlan/requirement-manifest aware and records internal rationale and evidence. Compatibility, maturity, freshness, allowed use, security state, dependencies and capability fit are considered before selection. Canonical full resources are preferred over narrow components that merely advertise the same broad capability, while quarantined, deprecated or incompatible candidates still fail closed.

Adaptation and composition are explicit. Composition checks routes, database migrations, package versions, state namespaces, navigation, declared dependencies, environment-variable kinds, API contracts, event producers, permission policies, styling assignments, platform capabilities and deployment policies. Declared resource dependencies are closed transitively before composition where a compatible active version exists; unsafe or unresolved conflicts remain visible to planning/repair rather than being hidden.

Resource-level governance supports semantic versions, usage records, evidence-gated promotion, demotion, quarantine, quarantine clearing, deprecation and explicit replacements. A customer-derived candidate cannot enter the shared library without generalization, removal of customer data/secrets, deduplication, license review, security review, tests and a manifest, and it cannot enter above experimental maturity.

Generated products remain export-independent: Builder Resource manifests fail closed if a reusable resource requires the live private library merely to run after export.

## Resource inventory

The branch contains a substantial source-backed private catalog rather than an empty-file inventory. The source-derived catalog contains 118 reusable resource entries across all five requested levels: 8 atoms, 10 components, 49 modules, 23 domain packs and 28 reference architectures. The runtime registry summary remains the authoritative count if entries change before merge.

Atoms include validated fields, async/loading/error state, date ranges, notification-token records, API validation results, modals, list items and accessible chart wrappers. Reusable components include login, profile editing, pricing, search, file upload, data tables, adaptable booking selection and accessible data charts. Cross-cutting modules cover authentication, account, authorization, database/persistence, API/backend boundaries, storage, notifications, billing/monetization, webhooks, background work, search, analytics, security and observability, with substantial source-backed contract packs underneath the original broad capability metadata.

## Existing 19 capability categories

All 19 existing AppForge build-capability categories are represented by private reusable resources and detailed domain contracts linked to existing AppForge source/studios where applicable. Current programme maturity for these packs is intentionally reported as STRUCTURAL unless stronger evidence exists; registration or schema presence is not treated as runtime or production certification.

| Category | Programme status | Notes |
| --- | --- | --- |
| Web search / research | STRUCTURAL | official/primary/community source ranking, freshness, provenance, conflict detection and cache contracts |
| Graphics / design | STRUCTURAL | design tokens/families, accessible controls/layouts, branding/localization hooks |
| Video | STRUCTURAL | storyboard/scene/timeline/caption/media contracts linked to existing video studio |
| Music / audio | STRUCTURAL | player/track/playlist/timing/audio metadata contracts linked to existing music studio |
| Marketing | STRUCTURAL | landing/funnel/SEO/analytics/consent-oriented contracts linked to existing marketing systems |
| AR / XR | STRUCTURAL | permission/capability/fallback/scene contracts linked to existing AR studio |
| Education | STRUCTURAL | course/module/lesson/enrollment/progress/assessment/roles/reporting contracts |
| Invention / patent | STRUCTURAL | invention/prior-art/specification/claims/figure/revision/review contracts with legal safeguards |
| Architecture / BIM | STRUCTURAL | brief/site/space/BIM/materials/coordination/document/change/handover contracts with professional-review safeguards |
| Game development | STRUCTURAL | game-state/input/scene/entity/progression/save/audio/UI/multiplayer-oriented contracts |
| CAD / product design | STRUCTURAL | units/dimensions/materials/components/assemblies/export/BOM/version contracts |
| Legal | STRUCTURAL | editable jurisdiction-aware legal scaffold contracts; no claim of legal-advice equivalence |
| Fintech / billing | STRUCTURAL | products/prices/subscriptions/credits/ledger/idempotency/refunds/reconciliation/audit contracts |
| Healthcare | STRUCTURAL | roles/appointments/consent/sensitive-data/access/audit/retention/tenant boundaries; no compliance-certification claim |
| Mobile | STRUCTURAL | navigation/auth/storage/API/offline/deep-link/push/permissions/lifecycle/accessibility/release capability contracts |
| Voice / speech | STRUCTURAL | speech/TTS/confirmation/interruption/cancellation/privacy/platform-hook contracts |
| Data / BI | STRUCTURAL | schemas/events/KPIs/charts/tables/filtering/import/export/aggregation/access contracts |
| Localization | STRUCTURAL | translation keys/locale detection/fallback/formatting/pluralization/RTL/persistence/accessibility contracts |
| Realtime collaboration | STRUCTURAL | rooms/membership/presence/editing/roles/conflict/version/WebSocket/reconnect/offline/history contracts |

## Design-system library

The library provides multiple configurable design families rather than one mandatory look: product-neutral, dense-dashboard, editorial-content and immersive-media. Families carry responsive behavior, typography, light/dark/system theming, loading/empty/error/success/disabled states, accessibility constraints, RTL/content-expansion safety and branding/localization hooks. Existing AppForge design-system controls remain reused rather than replaced.

## Reference architectures

Composable reference architectures cover SaaS, ecommerce, marketplace, CRM, project management, analytics/data, social/community, education, healthcare, fintech, booking/reservations, real estate, fitness, travel, restaurant, portfolio/content, content/news, AI agent, automation, API service, mobile consumer, desktop, browser extension, game and IoT, plus programme packs for data application, realtime collaboration and subscription application. They are reference-only compositions with configurable requirements, data/auth/monetization/integration/test/security/deployment metadata; they do not override the ProductContract.

## Builder integration

The normal agent-coordination path creates a resource plan from the same canonical ProductContract, ProductPlan and requirement manifest used by the rest of AppForge. Selected resource versions and evidence are carried into task context. Missing customer-specific functionality remains normal custom generation; the resource library does not force a customer request into a starter/template shape.

The retrieval layer is metadata-first. Full resource content is loaded only after selection, and tests require compact selected-resource context rather than dumping the full catalog into model prompts.

## Adaptation, composition and autonomous repair

Adaptation plans expose configurable fields and branding, localization, authorization, database and extension hooks. Composition has an explicit conflict matrix and dependency resolution. Failure diagnosis distinguishes resource defects, resource-version incompatibility, adaptation defects, composition/integration conflicts and generated custom-code defects so repair can target the smallest responsible scope. Confirmed reusable-resource regressions can demote/quarantine the resource instead of allowing it to remain treated as proven.

## Security and supply chain

Private resources carry provenance, license and allowed-use metadata. Supply-chain review rejects missing provenance/license, disallowed internal-generation use, external proprietary copying, credential-like embedded values and unsafe non-registry package sources; unusual package constraints are surfaced. Existing repository security scanning remains authoritative for dependency vulnerabilities.

## Test and composition evidence

Builder Resource tests cover manifest validation, registry/query behavior, evidence-gated maturity, selection rationale, adaptation, composition, dependency conflicts, governance/versioning/quarantine, promotion sanitation, supply-chain checks, research freshness/conflicts, design families, all 19 domain contracts, reference architectures, resource-level discovery, metadata-first retrieval, coordination persistence and controlled Golden Product comparison.

Composition tests include AUTH+BILLING, AUTH+MULTITENANCY, AUTH+REALTIME, BILLING+WEBHOOKS, MOBILE+PUSH, MOBILE+VOICE, BOOKING+BACKGROUND JOBS+PUSH, EDUCATION+VIDEO+AR, MARKETPLACE+PAYMENTS+MESSAGING, FINTECH+AUDIT+SECURITY, HEALTHCARE+ACCESS CONTROL+AUDIT, GAME+INPUT+SAVE, and LOCALIZATION+RTL+FORMS.

During implementation, CI exposed real selection/composition defects rather than being bypassed: canonical capability selection, missing booking dependencies, reference-architecture registry scope and research-claim normalization were corrected in code. The final branch must pass the complete PR #193 CI/security/qualification checks before merge; the PR checks are the authoritative final whole-branch evidence.

## Performance evidence

The library implements deterministic metadata-first lookup and a benchmark that compares catalog-wide content loading with selected-resource loading. Programme tests require retrieval to avoid more than 90% of naive content loads for a focused query. A controlled build-comparison model records generated/reused code units, repair cycles, pass rate, requirement coverage, defects, tool calls, build time and runtime-verification state instead of assuming reuse is automatically faster or better.

## Golden Product validation

Golden Product #1 uses the normal AppForge intake resolver and Builder Resource planning path; there is no restaurant-specific bypass. The controlled comparison measures baseline generation against resource-aware selection/adaptation/composition and records selected resource versions, generated versus reused capabilities, generator calls, generated files/bytes, missing capabilities and elapsed time. The Golden test also explicitly refuses to present the controlled harness as proof of a live reservation provider, App Store/Play Store signing or unrestricted external runtime certification.

Secondary composition validation is limited to product classes inside the current capability envelope and is exercised through the reference-architecture and composition suites rather than by fabricating unsupported certifications.

## Programme phase status

| Phase | Status |
| --- | --- |
| 0 — Inventory/audit | VERIFIED in repository scope |
| 1 — Resource architecture | IMPLEMENTED; final whole-branch verification required before merge |
| 2 — Core cross-cutting packs | STRUCTURAL / source-backed |
| 3 — Design-system library | STRUCTURAL / source-backed |
| 4 — Existing 19 capability categories | STRUCTURAL / source-backed |
| 5 — Reference architectures | STRUCTURAL / composition-validated |
| 6 — Builder retrieval/selection | IMPLEMENTED |
| 7 — Adaptation | IMPLEMENTED |
| 8 — Composition validation | IMPLEMENTED |
| 9 — Autonomous resource-level repair/governance | IMPLEMENTED |
| 10 — Performance/retrieval controls | IMPLEMENTED |
| 11 — Golden Product validation | CONTROLLED VERIFIED; external live certifications remain explicitly separate |

## External evidence not fabricated

The programme does not convert unavailable third-party evidence into a production-certified claim. Real reservation-provider authorization, real APNs/FCM delivery, mobile-store signing/submission and any other credential-bound external service proof remain external evidence requirements where those capabilities are selected. They do not justify weakening the private library or pretending that structural resources are production-certified.

## Maturity reporting

AppForge maturity remains:

`unsupported → discovered → experimental → structural → buildable → runnable → packageable → deployable → verified → production-certified`

Programme roll-ups use:

`NOT PRESENT / SCAFFOLD / STRUCTURAL / BUILDABLE / RUNNABLE / VERIFIED / PRODUCTION-CERTIFIED`

A resource is never promoted merely because a file, prompt, schema, plan or compile result exists. Regression can demote or quarantine previously stronger evidence.

## Completion rules

- ProductContract always outranks resource availability.
- The private library remains separate from the customer-facing Template Marketplace.
- No customer secret, proprietary data or identifiable customer content is automatically promoted into shared resources.
- No proprietary competitor source is copied.
- No deliberate paid infrastructure was provisioned for this programme.
- Resource versions used by a product are recorded for reproducibility and repair.
- Exported customer products remain functional without a live private-library connection unless an AppForge-hosted runtime service was explicitly selected.
- PR #193 is not merge-complete until its final whole-branch CI, security, preview/release and relevant qualification evidence is green.
