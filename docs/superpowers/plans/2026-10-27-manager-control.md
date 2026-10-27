# AppForge Manager control implementation plan

Goal: let TrillionAI Manager operate AppForge through its existing production build, approval, repair, recovery, evidence and deployment capabilities.

1. Keep the existing AppForge runtime and qualification pipeline. Fix REST generation's missing execution preflight before any enrichment or project creation.
2. Add a server-to-server Manager router with a dedicated bearer credential, explicitly configured company account, capability scopes and daily action limits. Cookie sessions, request-supplied user identities and browser origins cannot authorize this router. Mount it separately from browser CSRF routes; keep browser CSRF unchanged.
3. Add an append-only migration for a durable command ledger. Deduplicate commands by account/request ID and immutable input fingerprint; record pending, successful and failed outcomes. Uncertain commands are reconciled or flagged rather than blindly executed twice.
4. Delegate all work to the existing protected projects router. Preserve account lifecycle, project ownership, credit, approval, build-runtime, artifact and deployment checks. No administrative account changes, billing-policy changes, deletion or direct shell tools are exposed.
5. Expose independent job verification using the current artifact/evidence. Source-only output never counts as production delivery.
6. Test authentication, scope boundaries, duplicate/conflicting requests, unknown outcomes, real procedure delegation and migration permissions. Run the complete suite, lint, typechecks and production build; publish the verified source. Live deployment still requires GitHub Actions runners to start; the current account budget rejects jobs before any runner step.
