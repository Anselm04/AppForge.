# AppForge AUTH SESSION 401 FIX

**Date:** 2026-09-19 ~15:25 NZST (PT / UTC+12)  
**Fly app:** `appforge-unfurling-moon-9058`  
**Fly version:** **v325** (proven live)  
**Branch:** `fix/auth-session-401-upsert-email`

## Root cause
JWT verified OK; `upsertUserFromAuth` INSERT failed on `users.email` UNIQUE because Anselm row had stale `open_id` (`ced60619…` vs Supabase `b0d34e7c…`). Catch masked DB error as HTTP 401.

## Fix
Link by email when openId missing; session returns 200; upsert failures return 500 not 401; TopNav portal + SPA bearer chrome.

## Live proof (v325)
- `POST /auth/session` → **200** `userId:407` + `supabase_auth_session_cookies_set`
- `GET /api/auth/me` → **200** (cookies and bearer)
- `POST /projects.create` → **200** project **id:55** `status:completed` — no login bounce
- byEmail relink proven: mismatched open_id → session 200 restored correct open_id
- Anselm row healed: `open_id` set to `b0d34e7c-982c-4ae4-b6e3-cc39b0a8b653`
