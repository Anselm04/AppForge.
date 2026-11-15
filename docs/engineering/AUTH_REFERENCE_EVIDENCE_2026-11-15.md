# Authentication engineering reference evidence — customer SMS defect

**Scope:** AppForge PR #343. Read the actual implementation files from the TrillionAI GitHub source-reference repositories before the repair; no third-party code has been copied into AppForge.

## Source references actually inspected

1. [Keycloak — UsernamePasswordForm.java](https://github.com/Anselm04/Keycloak-Source-Code-Reference/blob/main/services/src/main/java/org/keycloak/authentication/authenticators/browser/UsernamePasswordForm.java). This authenticator handles ordinary password authentication as a distinct authentication-flow component. The observed implementation validates the form and marks the password credential authentication successful; it does not equate a normal password credential with a required SMS credential.
2. [Keycloak — OTPFormAuthenticator.java](https://github.com/Anselm04/Keycloak-Source-Code-Reference/blob/main/services/src/main/java/org/keycloak/authentication/authenticators/browser/OTPFormAuthenticator.java). This is a separate step-up credential authenticator. It obtains the selected user OTP credential, checks session and user state, records invalid-credential failure and only succeeds after credential validation.
3. [OpenID Client — OIDC example](https://github.com/Anselm04/OpenID-Client-Source-Code-Reference/blob/main/examples/oidc.ts). Source demonstrates the protocol separation among discovery, PKCE/nonce binding, authorization-code exchange with ID token verification, and fetching user information for the authenticated subject.
4. [OpenID Client — source implementation](https://github.com/Anselm04/OpenID-Client-Source-Code-Reference/blob/main/src/index.ts). The library encapsulates protocol-level token and session validation, separate from downstream application permission checks.

## Applied AppForge architecture

- **Customer authentication:** a verified Supabase identity with confirmed email is sufficient for normal customer APIs; optional mobile metadata does not create a permission prerequisite.
- **Owner privileged boundary:** server-side owner allowlist + validated step-up authentication, not a UI-only check. Retain existing admin MFA authorization while moving toward owner TOTP separately.
- **Separation of authentication and authorization:** identity establishes *who* is signed in; privileged routing checks *what* that session can do. SMS endpoints are owner-only to avoid billable customer SMS dependency.
- **Verification:** preserve email confirmation enforcement in `src/middleware/supabaseAuth.ts`, protection in `src/_core/trpc.ts`, privileged checks in `src/routers/admin.ts` and REST middleware, and regression tests for normal customer and owner MFA boundaries.

These are architectural lessons derived from the inspected reference source, **not copied code**. AppForge remains Supabase-based; it does not become a Keycloak or openid-client dependency. The existing paid-hosting hold remains in force.

## Qualification

Exact PR source and tests must pass full offline CI before merge. No production deploy or billable provider test is part of this change.
