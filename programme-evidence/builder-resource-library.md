# AppForge Builder Resource Library Programme Evidence

## Scope lock

This programme implements only the private internal Builder Resource Library specified on 16 October 2026. It must strengthen AppForge's existing autonomous builder and must not replace or duplicate working ProductContract, ProductPlan, requirement-manifest, capability, studio, adapter, template-marketplace, billing, auth, deployment, repair or recovery systems.

## Baseline

- Repository: `Anselm04/AppForge.`
- Baseline `main` SHA: `a82b0f64f0e00d0b6e8c5742129c6dadff7dab4a`
- Baseline meaning: PR #192 merged; previous agreed capability/Golden Product foundation list completed.
- Working branch: `builder-resource-library-foundation`

## Existing systems confirmed and preserved

- ProductContract and intake resolution
- ProductPlan
- Requirement manifests and requirement-linked validation
- Agent coordination and pipeline parts
- `buildCapabilities` with 19 existing capability categories
- `capabilityHints`
- `creativeOrchestrator`
- Existing specialist studios
- Customer-facing Template Marketplace and template factory
- Stack adapters
- Universal Adapter SDK maturity/evidence model
- Existing research, build validation, deployment, recovery and certification systems
- Previously merged Flutter + Node/native capability foundation from PR #192

## Missing foundation confirmed before implementation

Repository audit did not find a dedicated private reusable-resource manifest/registry/query architecture matching the requested Builder Resource Library. The first implementation chunk therefore adds that missing layer underneath existing systems rather than replacing them.

## Programme phases

0. Inventory/audit
1. Resource architecture
2. Cross-cutting core packs
3. Design-system library
4. Existing 19 capability categories
5. Reference architectures
6. Builder retrieval/selection
7. Adaptation
8. Composition validation
9. Resource-level autonomous repair
10. Performance
11. Golden-product validation

## Evidence ledger

### Phase 0 — Inventory

**Status:** STRUCTURAL / ongoing

Confirmed baseline and authoritative integration points. No duplicate resource architecture found.

### Phase 1 — Resource architecture

**Status:** IN PROGRESS

Target foundation:

- machine-readable manifest
- compatibility/dependency model
- evidence/maturity binding
- provenance/licensing metadata
- registry/query interface
- deterministic metadata-first filtering/ranking
- quarantine/deprecation handling

Test-first implementation begins on branch `builder-resource-library-foundation`.

## Maturity reporting

Use AppForge's actual maturity language where it applies:

`unsupported → discovered → experimental → structural → buildable → runnable → packageable → deployable → verified → production-certified`

For programme/category summaries also report requested roll-up labels where useful:

`NOT PRESENT / SCAFFOLD / STRUCTURAL / BUILDABLE / RUNNABLE / VERIFIED / PRODUCTION-CERTIFIED`

## Rules

- A file existing is not proof of functionality.
- Prompt text is not runtime implementation.
- Schema-only work is not a runnable module.
- Compile-only evidence is not behavioral proof.
- No resource is production-certified without the required evidence.
- Previously proven resources can be demoted/quarantined if they regress.
- Generated customer products must not require a live Builder Resource Library connection after export unless the customer explicitly chooses an AppForge-hosted service.
