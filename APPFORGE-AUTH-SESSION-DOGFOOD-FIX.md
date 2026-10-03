# AppForge auth/session dogfood fix (GitHub only)

**Date:** 2026-10-03 (PT / UTC+13)  
**Branch:** `fix/auth-session-dogfood-consolidate`  
**Repo:** `Anselm04/AppForge.`  
**Constraint:** No Fly / Vercel deploys. Consolidates unfinished work from open PRs #53, #54, #55 onto current `main`.

## Live symptom (Fly stale behind main)

- `GET /api/auth/me` and sometimes session continuity 404/401 → Generate bounced to `/login`
- Open PRs #53–#55 covered pieces of the fix but were based on older `main` and conflicted

## What this branch lands

1. **`GET /api/auth/me`** — real Express route returning `{ id, email, name, supabaseUid }` or `401 AUTH_REQUIRED`
2. **`POST /api/auth/session`** — `200` + cookies on success; upsert failures stay **`500 SESSION_UPSERT_FAILED`** (never fake 401)
3. **`upsertUserFromAuth`** — link by confirmed email when `openId` is new (email UNIQUE conflict was masking as 401)
4. **Client session continuity** — keep SPA bearer in `sessionStorage` (`appforge.access-token`); never strip it before `/api/auth/me`; Home Generate does not bounce while a bearer exists
5. **SameSite=Lax** for CSRF + auth cookies (mobile / CriOS)

## Explicitly not done

- No `flyctl deploy`, no Fly machines/sprites, no Vercel deploy, no Fly credit spend
