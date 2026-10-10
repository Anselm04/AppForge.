# Provider-neutral isolated execution

AppForge supports an operator-controlled isolated runner using:

- ISOLATED_BUILD_URL: validation endpoint.
- ISOLATED_PREVIEW_URL: preview endpoint.
- ISOLATED_EXEC_URL: optional shared build/preview/agent endpoint.
- ISOLATED_HEALTH_URL: independent authenticated health endpoint.
- ISOLATED_RUNTIME_TOKEN: server-only bearer credential.
- ISOLATED_PREVIEW_HOST_SUFFIXES: explicitly trusted preview host suffixes.

Any generic configuration takes precedence over legacy configuration. Partial
generic configuration fails closed and never falls back to another provider.

Production sets SPRITES_DISABLED=true at the owner's explicit request. This
blocks legacy build, preview, agent and health calls, including generic URLs
pointing at sprites.app. Do not invoke or provision Sprites.

Validation still requires install, security, tests, build and runtime evidence,
an isolation identity, and matching artifact SHA-256 and selected stack. Existing
production host-execution prohibitions remain enforced. Configuring a URL or
passing a health probe is not full generated-product certification.

Preview caches are bound to the provider and endpoint as well as the saved
snapshot and artifact integrity. Approved preview URLs must remain HTTPS in
production and within the configured endpoint or explicit host suffixes.

## Existing-host qualification

The Qualify Existing Build Host workflow uses the existing deployment credential
to inspect the existing two-machine AppForge fleet. It does not create a token
or machine, change the plan, or install software. Its reviewed fixture checks
that Bubblewrap hides application files and host environment and rejects
external networking. The reviewed fixture is attached to temporary memory, CPU and process-count
cgroups before execution; their usage is checked and the groups are removed. This qualification is not a production build runner or proof of
dependency-installation, product tests, production builds, or customer use.
