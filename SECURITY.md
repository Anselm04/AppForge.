# Security Policy

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately using GitHub's private vulnerability reporting:

1. Go to the [Security tab](../../security) of this repository.
2. Click **Report a vulnerability**.
3. Include a description, steps to reproduce, and the potential impact.

## What to Expect

- We aim to acknowledge reports within **3 business days**.
- We will keep you updated as we investigate and fix the issue.
- Once a fix is released, we are happy to credit you if you wish.

## Supported Versions

Security fixes are applied to the `main` branch and the currently deployed production release.

## Scope

In scope: the AppForge application, its APIs, and the code in this repository.

Out of scope: social engineering, denial-of-service testing against production, and vulnerabilities in third-party services we depend on (please report those to the vendor).

## Dependency and Supply-Chain Security

- Dependabot checks npm packages and GitHub Actions weekly (see `.github/dependabot.yml`).
- Never commit secrets. If you find an exposed credential, report it using the process above.

## Related Documentation

- [HTTP security headers guide](docs/SECURITY_HEADERS.md)
