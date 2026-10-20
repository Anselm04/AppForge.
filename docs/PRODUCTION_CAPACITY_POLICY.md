# AppForge Production Capacity Policy

Status: authoritative production/recovery capacity policy as of 20 October 2026.

AppForge production requires **at least two healthy, started Fly `app` Machines** serving the same current approved release SHA. Two is the minimum redundancy floor, not a maximum fleet size.

This policy supersedes older recovery/documentation wording that describes the production fleet as requiring **exactly two** started Machines or instructs operators to run a generic `flyctl scale count 2` / revive stopped historical Machines merely to satisfy a count.

## Required invariants

A production/recovery verification is green only when:

- at least two `app` Machines are started;
- every serving Machine is on the expected current release SHA where an exact release SHA is supplied;
- serving Machines expose the required release metadata/labels;
- Fly health checks pass on every serving Machine;
- PostgreSQL and shared Redis readiness remain green;
- the prepared non-root build runtime is qualified on every serving Machine;
- authorization, billing, execution, customer-route and browser smoke gates remain fail-closed/green as applicable;
- production auto-stop remains disabled, auto-start remains enabled and `min_machines_running = 2` remains configured;
- verification does not blindly restart or globally scale historical blue/green replacement Machines.

Healthy temporary or steady excess capacity (for example three current-release healthy Machines after a blue/green replacement) is not a certification failure. Fewer than two serving Machines, mixed/stale release SHAs, failed checks, missing release metadata, failed readiness or failed runtime isolation remain certification failures.

## Canonical implementation

`scripts/verify-fly-capacity.mjs` is the canonical production capacity verifier. `scripts/verify-production-build-runtime.mjs` and `scripts/probe-existing-fly-isolation.mjs` must follow the same minimum-two capacity rule while retaining their stronger per-Machine runtime/isolation checks.

The production deployment and Recovery Readiness workflows must not reintroduce an exact-two assertion that conflicts with this policy.

## Proven release evidence

The policy was proven on main SHA `b06ad4f44219fccef513d7bae803062c78ba2b24` on 20 October 2026:

- Recovery Readiness run `39367818119`: success.
- CI run `39367818204`: success, including CI Release Gate.
- Security Scanning run `39367818201`: success.
- Deploy Production run `39368320341`: success, including live Fly deploy, capacity verification, prepared non-root runtime on every serving Machine, runtime/auth boundaries, customer routes, exact released SHA verification and Chromium customer-shell verification.

If another document contains older exact-two wording, this file and the executable canonical verifier define the current policy until that historical wording is edited.