# TrillionAI Audit bridge — optional, fail-closed integration

This bridge is wired into the **post-build immutable snapshot** security verification path. It sends the exact generated file map to the standalone TrillionAI Audit HTTP endpoint, verifies the source receipt, stores a project evidence event linked to the current artifact hash, and refuses success when static audit checks fail.

**Activation is explicitly optional** until Audit is deployed and approved. No endpoint or credential is configured by default; no infrastructure is provisioned. When `TRILLION_AUDIT_API_URL` is present, a missing token, timeout, HTTP error, invalid receipt or blocking finding stops the final verification path.

Variables:
- `TRILLION_AUDIT_API_URL`: HTTPS Audit service URL (loopback HTTP permitted for local tests)
- `TRILLION_AUDIT_API_TOKEN`: 15-minute service token scoped to `audit:run`, issued to the appropriate tenant

The token has a finite expiry: production integration requires a secure short-lived token issuance/renewal mechanism, not a manually hardcoded long-lived secret. The static service does not independently certify runtime behaviour, payments, deployment or app store acceptance. AppForge retains its existing isolated-runtime and artifact gates.

Do not send customer source to a third-party host without appropriate processing terms and customer authorisation. Reconcile the standalone service's evidence hashes and source revisions; never accept unverified client-side claims as external certification.
