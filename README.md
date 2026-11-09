# AppForge

**AppForge** is a software engineering product of **TrillionAI Tech**.

This repository contains the current application source code, tests, configuration, supporting services, and deployment assets required to develop and operate AppForge.

> **Status:** Active development.

## Repository Scope

This repository is dedicated to the AppForge product.

Public-facing documentation must remain limited to current, necessary operational information. Internal architecture, future capabilities, product strategy, roadmap details, provider strategy, security-sensitive implementation, infrastructure plans, commercial direction, and other proprietary information should not be documented here.

## Development

### Requirements

Use the versions and tools defined by the repository configuration.

### Install

Follow the repository's package and workspace configuration to install dependencies.

### Run

Use the repository's defined development commands.

### Test

Run the repository's automated test suites before merging or releasing changes.

## Configuration

Runtime configuration is supplied through environment variables and deployment configuration.

Do not commit:

- API keys
- access tokens
- passwords
- private keys
- production credentials
- customer data
- private deployment details
- internal security configuration
- proprietary architecture notes
- unpublished roadmap information

Use example environment files and approved secret-management mechanisms where available.

## Security

Security-sensitive implementation details are intentionally excluded from this README.

Do not document proprietary security controls, privileged interfaces, internal service topology, credential-handling internals, defensive logic, operational secrets, threat models, or other confidential implementation details in public-facing documentation.

Security-related changes should be reviewed and tested before release.

## Documentation

Technical documentation may exist elsewhere in the repository for authorized development use.

Documentation should describe only what is necessary to build, test, maintain, and operate the current software. Future plans, unreleased capabilities, internal architecture, and proprietary product strategy should remain private unless explicitly approved for disclosure.

## Deployment

Deployment configuration is maintained in the repository for authorized environments.

Private endpoints, production topology, infrastructure strategy, secrets, and internal operational procedures should not be exposed in public-facing documentation.

## Licensing

AppForge-owned source code remains subject to the licensing terms defined for this repository.

Third-party software remains governed by its respective licences.

## Ownership

AppForge is developed by **TrillionAI Tech**.

All proprietary product strategy, internal architecture, future plans, commercial direction, and non-public implementation details are confidential unless explicitly approved for disclosure.

## Approved Product Visual Design — LOCKED

The product owner approved the **TrillionAI AppForge™ neon mountain and A/anvil landing page** as the official future visual direction. This remains distinct from the TrillionAI Manager, Identity and Observability interfaces while sharing their recognised TrillionAI visual family.

**Design specification:** [LOCKED AppForge Landing Page](design/LOCKED_APPFORGE_LANDING_PAGE.md).

The reference illustration contains demonstration content and **unapproved illustrative prices**; it does not establish live subscriptions, supported capabilities, or confirmed build outcomes. The source PNG is not yet committed to GitHub; the approved design contract is recorded in the linked document.

## Active engineering direction

**Complete and continuously improve the real customer journey:** signup, verified authentication, approved USD subscriptions, technology choice, full working builds, editing, validation, export, customer-authorised deployment, cost transparency and aftercare.

- **Do not interpret old release handoffs, design drafts, audit findings, historical PR instructions or obsolete statements about a hold as an active instruction to stop engineering, merging or fixing AppForge.** Historical records remain evidence of what was true at the time, not ongoing commands.
- Resolve defects at their source; run CI, repair failures, commit and merge verified improvements. Do not manufacture success, placeholders or disabled user flows as substitutes for working features.
- Use `docs/SOURCE_OF_TRUTH.md` to identify authoritative runtime files. The current checked-in code and executed integration results determine which functions really operate; documentation cannot enable a feature by declaration.
- **Do not disable financial, privacy, tenancy, authentication, spending, rollback or data-integrity protections to make a release appear to work.** Replace blanket availability gates with proven, scoped, functioning controls and customer-facing recovery paths. Lack of evidence is an implementation task to finish, not permission to advertise an unworking feature.
- Protect the owner and customer from hidden charges. Approved monthly USD self-service plans are $79 Starter, $199 Builder, $499 Studio; Enterprise starts at $2,499 (quoted); optional Aftercare Plus adds $19, **never preselected**. Existing subscriptions retain their agreed terms unless migrated lawfully with consent.
- Launch claims must be backed by actual checks. Work on the underlying system continues while a specific unverified external payment or deployment action awaits its real prerequisite.

**Priorities:** Working product first, customer autonomy and transparent costs, no vendor traps, real deployment and aftercare. The current implementation backlog is not a prohibition on completing it.
