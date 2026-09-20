# AppForge AUTH SESSION 401 FIX

**Date:** 2026-09-19 ~15:32 NZST (PT / UTC+12)  
**Fly app:** `appforge-unfurling-moon-9058`  
**Fly version:** **v325** (complete, both machines healthy)  
**Branch:** `fix/auth-session-401-upsert-email`

## Root cause (proven from Fly logs 03:12:19Z)

Not CSRF. Not wrong path. Not JWT failure.

1. Supabase email/password login succeeded (JWT valid).
2. `POST /api/auth/session` verified JWT via `getUser`.
3. `upsertUserFromAuth` looked up **only by open_id**, then INSERT.
4. INSERT hit `users.email` UNIQUE — Anselm row had stale `open_id` (`ced60619…` vs Supabase `b0d34e7c…`).
5. Catch masked the DB error as **HTTP 401**.
6. Cascade: no cookies → `/api/auth/me` 401 → TopNav Sign in → `projects.create` 401.

v324 sessionStorage could not help: every authenticated request runs the same upsert and failed.

## Fix (deployed on v325)

- Link existing users by confirmed email when openId is new.
- Session success → **200** + HttpOnly cookies (`SameSite=Lax`).
- Upsert failure → **500** `SESSION_UPSERT_FAILED` (never fake 401).
- TopNav: trust SPA bearer; portal mobile drawer.
- Healed Anselm `open_id` → `b0d34e7c-982c-4ae4-b6e3-cc39b0a8b653`.

## Live self-test proof

| Step | Result |
|------|--------|
| `POST /api/auth/session` | **200** userId 407 + cookies_set |
| `GET /api/auth/me` | **200** (cookies + bearer) |
| `projects.create` | **200** project id **55** completed |
| byEmail relink | mismatched open_id → session **200** |

Fly: `POST /auth/session status=200 userId=407` then `POST /projects.create status=200 userId=407`.
