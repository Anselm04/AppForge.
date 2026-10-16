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

## Phase 0 audit and preserved systems

The implementation reuses ProductContract and intake resolution, ProductPlan, requirement manifests, agent coordination, the 19 existing build-capability IDs, capability hints, creative orchestration, specialist studios, the customer-facing Template Marketplace, stack adapters, the Universal Adapter SDK maturity/evidence model, research/redesign, iterative repair, sandbox/build validation, artifact persistence, certification, billing, auth, deployment and recovery. The private resource system sits beneath those systems rather than becoming a parallel product factory or public template catalogue.

The existing customer-facing Template Marketplace was audited separately and preserved. Its current source inventory contains 15 public categories and 6 customer-facing starters (SaaS, ecommerce, CRM, project management, analytics and social). None of those public starters was deleted or repurposed as the private Builder Resource Library. A customer-facing starter can consume private internal resources, but the private warehouse remains a separate builder-internal concern.

## Resource architecture implemented

The private library has machine-readable manifests and deterministic registry/query behavior for atoms, components, modules, domain packs and reference architectures. Manifests carry identity/version, stack/runtime/platform compatibility, dependencies/integration points, input/output/API/data/event contracts, environment/secret requirements, adaptation hooks, composition metadata, implementation/export policy, evidence, provenance/license/governance, maturity and quarantine/deprecation state.

Selection is ProductContract/ProductPlan/requirement-manifest aware and records internal rationale, evidence ledger references and requirement IDs. Compatibility, maturity, freshness, allowed use, security state, dependencies and capability fit are considered before selection. Canonical full resources are preferred over narrow components that merely advertise the same broad capability, while quarantined, deprecated or incompatible candidates fail closed. Transitive resource dependencies are closed only when a compatible active dependency exists, and dependency selections carry explicit `dependency-of:<resource@version>` decision evidence tied back to the parent's requirement IDs.

Resource versioning is fail-closed. Creating a new semantic resource version never silently inherits verified/production evidence from the prior version. A changed version is reset to at most experimental maturity, clears verification timestamps and evidence ledger references, and must accumulate fresh build/runtime/security/behavioral/reproducibility evidence before later promotion.

## Adaptation, composition and real builder materialization

Adaptation exposes configurable fields plus branding, localization, authorization, database, replacement and extension points. Composition checks routes, database migrations, package versions, state namespaces, navigation, declared dependencies, environment-variable kinds, API contracts, event producers, permission policies, styling assignments, platform capabilities and deployment policies. Unsafe or unresolved conflicts remain visible to planning/repair rather than being hidden.

The normal agent-coordination path now does more than pass resource IDs. After ProductContract-driven selection, each specialist task receives only the selected reusable implementations relevant to that task's requirement IDs. The materialization layer performs supply-chain checks, loads bounded source excerpts plus machine-readable contracts/adaptation/composition metadata, and injects that task-scoped material into the normal coder context. It defaults to at most 6 task-relevant resources, 2 source paths per resource, 2,500 characters per source and 18,000 total source characters, so the entire warehouse is never dumped into model context.

The specialist instruction is explicit: adapt the reusable implementation to the ProductContract and task-owned files, never force the customer product to fit a resource, never expose AppForge-internal paths or require a live private-library connection at exported runtime, and generate normal custom code for anything the selected resources do not satisfy. This converts the library from metadata-only selection into an active private implementation input while preserving customer uniqueness.

## Resource inventory

The branch contains a substantial source-backed private catalog rather than an empty-file inventory. The source-derived catalog contains 118 reusable resource entries across all five requested levels: 8 atoms, 10 components, 49 modules, 23 domain packs and 28 reference architectures. The runtime registry summary remains the authoritative count if entries change before merge.

Atoms include validated fields, async/loading/error state, date ranges, notification-token records, API validation results, modals, list items and accessible chart wrappers. Reusable components include login, profile editing, pricing, search, file upload, data tables, adaptable booking selection and accessible data charts. Cross-cutting modules cover authentication, account, authorization, database/persistence, API/backend boundaries, storage, notifications, billing/monetization, webhooks, background work, search, analytics, security and observability, with substantial source-backed contract packs underneath the original broad capability metadata.

## Existing 19 capability categories

All 19 existing AppForge build-capability categories have private reusable resources linked to existing AppForge source/studios where applicable. In addition to the original broad domain schemas, every category now has a machine-readable feature-contract pack describing concrete requested reusable features, configuration keys, adaptation hooks, test obligations and security obligations. This prevents category-name/prompt-only population from being mistaken for substantive implementation. Current programme maturity for these packs is intentionally STRUCTURAL unless stronger runtime evidence exists.

| Category | Programme status | Substantive reusable coverage |
| --- | --- | --- |
| Web search / research | STRUCTURAL | official/API/SDK/package/pricing/compatibility/security/legal research, source ranking, provenance/citation, freshness, conflicts, cache, summary contracts |
| Graphics / design | STRUCTURAL | tokens, responsive/navigation/dashboard/settings/auth/landing/pricing/form/dialog/state/onboarding/icon systems, contrast/accessibility, typography, branding, themes, mobile adaptation, assets, multiple design families |
| Video | STRUCTURAL | storyboard, scenes, timeline, captions, overlays, title cards, transitions, audio tracks, thumbnails, aspect presets, exports, media-player and social layouts |
| Music / audio | STRUCTURAL | player, track metadata, playlists, waveform, lyric display, timing, BPM/key, assets, sequencing, narration, transcripts/accessibility and rights metadata |
| Marketing | STRUCTURAL | landing architecture, lead/newsletter capture, funnels, pricing/CTA, SEO, structured data, sitemap/OpenGraph, campaign attribution, email structure, analytics, A/B, publishing, consent/cookies |
| AR / XR | STRUCTURAL | camera permission, WebXR bootstrap, placement, hit testing, 3D fallback, model loading, orbit controls, scene lifecycle, manipulation, manifests, device checks, fallbacks |
| Education | STRUCTURAL | course/module/lesson/enrollment/roles/progress/quizzes/assessment/question banks/grading/gradebook/attendance/scheduling/assignments/submissions/feedback/certificates/media/discussion/notifications/accessibility/curriculum/AR/whiteboard/resources/reporting/guardian roles/tenancy |
| Invention / patent | STRUCTURAL | invention schema, relationships, novelty/prior-art workflows, references, specification, claims, drawings/figures, revisions, jurisdiction, export and attorney-review checkpoints |
| Architecture / BIM | STRUCTURAL | brief/site/zoning/space/floor-plan/concept/BIM/materials/structural/MEP/clashes/accessibility/egress/fire/sustainability/site/interiors/construction docs/specs/quantities/permits/change orders/RFIs/submittals/snagging/handover/post-occupancy/versioning/approvals |
| Game development | STRUCTURAL | loop/scenes/input/keyboard/touch/controllers/entities/player/NPC/physics/collision/scoring/progression/save-load/settings/audio/HUD/menu/inventory/achievements/levels/multiplayer/assets/state tests/deterministic harness |
| CAD / product design | STRUCTURAL | dimensions, units, materials, hierarchy, mesh metadata, annotations, assemblies, manufacturing notes, export metadata, glTF/GLB, OBJ, Three.js preview, camera/orbit, tolerances, BOM, versioning |
| Legal | STRUCTURAL | editable privacy/terms/NDA/service/contractor/consent/DPA/AUP/cookie/disclaimer scaffolds with jurisdiction metadata and qualified-review safeguards |
| Fintech / billing | STRUCTURAL | products/prices/subscriptions/one-time/entitlements/credits/invoices/webhooks/idempotency/ledger/history/refunds/reconciliation/plan changes/trials/failures/portal/permissions/audit/KYC structures |
| Healthcare | STRUCTURAL | patient/provider roles, appointments, consent, access controls, sensitive-data boundaries, audit, encryption requirements, retention, secure messaging, documents, notification privacy, record abstractions, emergency contacts, clinic tenancy |
| Mobile | STRUCTURAL | Flutter/Android/iOS/RN-Expo metadata, navigation/auth/secure tokens/API/offline/deep links/push/local notifications/camera/photos/mic/audio/location/jobs/biometrics/sharing/contacts/calendar/permissions/lifecycle/app links/accessibility/theme/localization/analytics/crash/store assets/packaging/release configuration |
| Voice / speech | STRUCTURAL | speech input, TTS, confirmation, platform-respecting activation, interruption/cancellation/prompts/intents/confidence/accessibility/transcript privacy, Siri/App Intents and Android voice-action hooks without unrestricted always-listening assumptions |
| Data / BI | STRUCTURAL | relational patterns, events/KPIs/charts/tables/filter/sort/pagination/export/dashboard/reports/CSV validation/ETL/aggregation/realtime/access permissions/row ownership |
| Localization | STRUCTURAL | keys, locale detection/fallback, date/time/number/currency, pluralization, RTL, extraction, lazy loading, validation, persistence and accessible language selection |
| Realtime collaboration | STRUCTURAL | rooms/membership/presence/cursors/editing/roles/permissions/optimistic updates/conflicts/version history/WebSockets/reconnect/offline/event ordering/audit/comments/approvals/shared assets |

## Design-system library

The library provides multiple configurable design families rather than one mandatory look: product-neutral, dense-dashboard, editorial-content and immersive-media. Families carry responsive behavior, typography, light/dark/system theming, loading/empty/error/success/disabled states, accessibility constraints, RTL/content-expansion safety and branding/localization hooks. Existing AppForge design-system controls remain reused rather than replaced.

## Reference architectures

Composable reference architectures cover SaaS, ecommerce, marketplace, CRM, project management, analytics/data, social/community, education, healthcare, fintech, booking/reservations, real estate, fitness, travel, restaurant, portfolio/content, content/news, AI agent, automation, API service, mobile consumer, desktop, browser extension, game and IoT, plus programme packs for data application, realtime collaboration and subscription application. They are reference compositions with configurable requirements, data/auth/monetization/integration/test/security/deployment metadata; they do not override the ProductContract or become hard-coded customer products.

## Governance, promotion and autonomous repair

Resource-level governance supports semantic versions, exact usage records, evidence-gated promotion, demotion, quarantine, quarantine clearing, deprecation and explicit replacements. A customer-derived candidate cannot enter the shared library without generalization, removal of customer data/secrets, deduplication, license review, security review, tests and a manifest, and it cannot enter above experimental maturity.

Failure diagnosis distinguishes a reusable resource defect, resource-version incompatibility, adaptation defect, composition/integration conflict, missing dependency/platform mismatch and generated custom-code defect so repair targets the smallest responsible scope. Confirmed reusable-resource regressions can demote/quarantine the resource instead of allowing it to remain treated as proven.

Generated products remain export-independent: Builder Resource manifests fail closed if a reusable resource requires the live private library merely to run after export.

## Security and supply chain

Private resources carry provenance, license and allowed-use metadata. Supply-chain review rejects missing provenance/license, disallowed internal-generation use, external proprietary copying, credential-like embedded values and unsafe non-registry package sources; unusual package constraints are surfaced. Selected resource material is supply-chain checked again before source excerpts are injected into specialist context. Existing repository dependency/security scanning remains authoritative for dependency vulnerabilities.

## Test and composition evidence

Builder Resource tests cover manifest validation, registry/query behavior, evidence-gated maturity, selection rationale, requirement-linked dependency evidence, adaptation, composition, dependency conflicts, governance/versioning/quarantine, fresh-evidence requirements for new versions, promotion sanitation, supply-chain checks, research freshness/conflicts, design families, all 19 domain schemas and feature-contract packs, reference architectures, resource discovery, metadata-first retrieval, bounded task materialization, coordination persistence and controlled Golden Product comparison.

Composition tests include AUTH+BILLING, AUTH+MULTITENANCY, AUTH+REALTIME, BILLING+WEBHOOKS, MOBILE+PUSH, MOBILE+VOICE, BOOKING+BACKGROUND JOBS+PUSH, EDUCATION+VIDEO+AR, MARKETPLACE+PAYMENTS+MESSAGING, FINTECH+AUDIT+SECURITY, HEALTHCARE+ACCESS CONTROL+AUDIT, GAME+INPUT+SAVE, and LOCALIZATION+RTL+FORMS.

During implementation, CI exposed real selection/composition defects rather than being bypassed: canonical capability selection, missing booking dependencies, reference-architecture registry scope, research-claim normalization, target-compatible string handling and formatting were corrected in code. Final branch completion still requires the latest PR #193 head to pass its complete CI/security/preview/native qualification suite.

## Performance and retrieval evidence

The library uses deterministic metadata-first lookup. Full resource implementation content is only loaded after selection and then only for requirement-relevant specialist tasks. Tests require focused retrieval to avoid more than 90% of naive catalog content loads, and the task materializer applies hard limits to resource count, source count and character volume.

The controlled Golden comparison records all programme-requested measurement fields: build time, AI/tool-call count, generated-code volume, actual source-backed reused-code volume, repair cycles, test pass rate, defects, requirement coverage, runtime-success state and output-quality score. The harness does not silently convert missing observations into success; metrics are nullable unless supplied/measured.

## Golden Product validation

Golden Product #1 uses the normal AppForge intake resolver and normal Builder Resource planning path; there is no restaurant-specific resource-selection bypass. The comparison contrasts ordinary capability generation against resource-aware selection/adaptation/composition and records exact selected resource versions, generator calls, generated files/bytes, selected/reused source volume, missing capabilities and elapsed time.

The controlled test supplies deterministic repair/test/defect/quality observations to prove the comparison plumbing and calculations. Those fixture observations are not represented as measured live-production improvements. Runtime/provider/store claims remain evidence-gated separately. The test explicitly does not claim a live reservation-provider integration, APNs/FCM delivery, App Store/Play Store signing or unrestricted external runtime certification without their real credentials and evidence.

Secondary composition validation remains limited to product classes inside the current capability envelope and is exercised through reference-architecture/composition tests rather than fabricated certifications.

## Programme phase status

| Phase | Status |
| --- | --- |
| 0 — Inventory/audit | VERIFIED in repository scope |
| 1 — Resource architecture | IMPLEMENTED; final whole-branch verification pending |
| 2 — Core cross-cutting packs | STRUCTURAL / source-backed |
| 3 — Design-system library | STRUCTURAL / source-backed |
| 4 — Existing 19 capability categories | STRUCTURAL / source-backed with explicit feature contracts |
| 5 — Reference architectures | STRUCTURAL / composition-validated |
| 6 — Builder retrieval/selection | IMPLEMENTED |
| 7 — Adaptation | IMPLEMENTED and task-scoped reusable implementation materialization wired into normal coder context |
| 8 — Composition validation | IMPLEMENTED |
| 9 — Autonomous resource-level repair/governance | IMPLEMENTED |
| 10 — Performance/retrieval controls | IMPLEMENTED |
| 11 — Golden Product validation | CONTROLLED VERIFIED; external live certifications explicitly separate |

## External evidence not fabricated

The programme does not convert unavailable third-party evidence into a production-certified claim. Real reservation-provider authorization, real APNs/FCM delivery, mobile-store signing/submission and any other credential-bound external service proof remain external evidence requirements where those capabilities are selected. They do not justify weakening the private library or pretending structural resources are production-certified.

## Maturity reporting

AppForge maturity remains:

`unsupported → discovered → experimental → structural → buildable → runnable → packageable → deployable → verified → production-certified`

Programme roll-ups use:

`NOT PRESENT / SCAFFOLD / STRUCTURAL / BUILDABLE / RUNNABLE / VERIFIED / PRODUCTION-CERTIFIED`

A resource is never promoted merely because a file, prompt, schema, plan or compile result exists. Regression can demote or quarantine previously stronger evidence, and every new resource version must earn fresh verification.

## Completion rules

- ProductContract always outranks resource availability.
- The private library remains separate from the customer-facing Template Marketplace.
- Selected reusable implementation material reaches the normal specialist coder path only after metadata-first selection and requirement matching.
- Missing/custom customer functionality continues through normal generation.
- No customer secret, proprietary data or identifiable customer content is automatically promoted into shared resources.
- No proprietary competitor source is copied.
- No deliberate paid infrastructure was provisioned for this programme.
- Resource versions used by a product and internal selection rationale are persisted for reproducibility, repair and upgrades.
- Exported customer products remain functional without a live private-library connection unless an AppForge-hosted runtime service was explicitly selected.
- PR #193 is not merge-complete until its final whole-branch CI, security, preview/release and relevant qualification evidence is green.
