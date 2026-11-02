# AppForge Front-Door Authentication Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AppForge account entry and session continuity reliable enough to reach and test the real builder while restoring the intended Supabase-email + Twilio-Verify-SMS architecture.

**Architecture:** Supabase Auth owns email/password/OAuth account lifecycle and auth email delivery through its configured mail path. Twilio Verify owns SMS phone verification. Redis coordinates refresh-token rotation across the two Fly Machines so one-time Supabase refresh tokens are not raced by separate Node processes.

**Tech Stack:** TypeScript, React, Express, Supabase Auth, Twilio Verify, Redis, Vitest, GitHub Actions, Fly.io.

**Spec:** `docs/superpowers/specs/2026-11-03-front-door-auth-stabilization.md`

## Global Constraints

- Supabase remains identity/email authentication; Twilio Verify remains SMS verification.
- Do not add or require Twilio Email.
- Do not weaken phone verification or owner/admin MFA.
- Do not bypass CI, security, exact-SHA, two-Machine, readiness, or browser release gates.
- Raw refresh tokens must never be logged or used as Redis keys.
- Public production launch still requires a suitable outbound mail configuration in Supabase even though AppForge code does not own that provider.

## Review Focus

- Two Fly Machines receive the same expired session concurrently: only one Supabase refresh request occurs and both callers receive the rotated result.
- Redis is slow/unavailable during refresh: authentication fails safely without leaking tokens or looping indefinitely.
- Signup preserves the phone only as pending metadata until server-confirmed Twilio verification.
- Supabase signup/resend/recovery errors remain non-enumerating and user-safe.
- Owner/admin MFA remains isolated from normal customer builder access.

---

### Task 1: Restore Supabase-native auth email lifecycle

**Files:**
- Modify: `src/services/authEmailDelivery.ts`
- Modify: `src/__tests__/authResend.test.ts`
- Modify/create focused auth-email tests as needed
- Modify: `src/__tests__/authLifecycleComplete.contract.test.ts`

**Interfaces:**
- Consumes: Supabase URL plus publishable/anon key already used by AppForge browser auth.
- Produces: `createSignupConfirmation`, `resendSignupConfirmation`, `sendPasswordRecovery` with unchanged route-facing semantics.

- [ ] **Step 1: Write failing tests** proving signup calls Supabase Auth signup with `emailRedirectTo` and `{ signup_phone, signup_phone_verified: false }`, resend does not require Twilio Email/hook variables, and recovery uses Supabase Auth reset-password delivery.
- [ ] **Step 2: Run focused tests and confirm RED** on the existing Twilio Email implementation.
- [ ] **Step 3: Implement the minimal Supabase-native delivery path** while preserving non-enumeration, validation, and route response contracts.
- [ ] **Step 4: Run focused tests and confirm GREEN.**
- [ ] **Step 5: Commit.**

### Task 2: Remove obsolete Twilio Email release dependencies

**Files:**
- Modify: `.github/workflows/deploy-production.yml`
- Modify: `.github/workflows/auth-email-readiness.yml` or retire it if it only certifies the obsolete path
- Modify: `.env.auth.example`
- Modify: `docs/AUTH_RECOVERY_RELEASE.md`
- Modify affected release/environment contract tests

**Interfaces:**
- Consumes: runtime secret-name list from Fly.
- Produces: production gate requiring only dependencies actually used by AppForge.

- [ ] **Step 1: Write failing contract tests** proving the production gate does not require `SUPABASE_SEND_EMAIL_HOOK_SECRET`, `TWILIO_EMAIL_FROM`, or `APPFORGE_EMAIL_FROM`, while it still requires Twilio Verify SMS and Supabase server credentials.
- [ ] **Step 2: Run focused tests and confirm RED.**
- [ ] **Step 3: Remove obsolete email-hook/sender requirements and update recovery/config documentation.**
- [ ] **Step 4: Run focused tests and confirm GREEN.**
- [ ] **Step 5: Commit.**

### Task 3: Coordinate refresh-token rotation across Fly Machines

**Files:**
- Modify: `src/middleware/supabaseAuth.ts`
- Modify: `src/lib/redis.ts` only if a shared URL-capable client/helper is required
- Create/modify: focused refresh coordination tests under `src/middleware/`

**Interfaces:**
- Consumes: `REDIS_URL`, Supabase refresh token, existing local single-flight.
- Produces: distributed refresh coordination returning a `RefreshedSession | null` without exposing the raw refresh token.

- [ ] **Step 1: Write failing concurrency tests** using two independent coordinator instances against one shared Redis abstraction and assert the provider refresh executes once.
- [ ] **Step 2: Run focused tests and confirm RED.**
- [ ] **Step 3: Implement hashed-key lock/result coordination** with bounded lock/result TTLs and bounded wait time. Preserve the existing in-process map as a fast path.
- [ ] **Step 4: Add and run Redis-unavailable/timeout tests** proving fail-safe bounded behavior.
- [ ] **Step 5: Run focused tests and confirm GREEN.**
- [ ] **Step 6: Commit.**

### Task 4: Verify the complete front-door contract

**Files:**
- No production changes unless verification exposes a defect.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: evidence suitable for merge/release.

- [ ] **Step 1: Run the complete repository test suite.** Expected: zero unexpected failures.
- [ ] **Step 2: Run typecheck, lint/format, production build, and relevant security/release contract checks.**
- [ ] **Step 3: Confirm the auth lifecycle contract still proves owner MFA does not gate ordinary builder access.**
- [ ] **Step 4: Review the diff for secret leakage and provider-role regressions.**
- [ ] **Step 5: Commit any verification-only fixes.**

### Task 5: Merge, deploy, and verify the live entry path

**Files:**
- No source changes unless hosted checks expose a defect.

**Interfaces:**
- Consumes: a green PR and production provider configuration.
- Produces: live exact-SHA evidence.

- [ ] **Step 1: Require hosted CI/security checks on the final PR head.**
- [ ] **Step 2: Merge only a green final head to `main`.**
- [ ] **Step 3: Observe the normal production workflow; do not bypass the gate.**
- [ ] **Step 4: Verify Fly is serving the exact merged SHA on both Machines.**
- [ ] **Step 5: Verify `/`, signup/login/pricing routes and the production browser shell.**
- [ ] **Step 6: Run a real owner test through GitHub OAuth or email confirmation, normal phone verification, session continuity, and entry into the builder.**
- [ ] **Step 7: Only after the real entry path succeeds, continue to first prompt → project creation → build/preview testing.**
