# AppForge Generate → /login loop V2

**Date:** 2026-09-19 ~14:25 NZST (PT / UTC+12)  
**Repo:** `/workspace/AppForge-audit-main`  
**Fly app:** `appforge-unfurling-moon-9058`  
**Prior failed claim:** Fly **v320** (cookie-hydrate only) — Anselm confirmed still bounced to `/login` after Generate.

## Honest root cause (v320 was not enough)

v320 fixed cookie *hydration probes* but introduced / left a fatal client bug:

1. **`signIn` correctly stored `accessToken` in memory** and best-effort POSTed `/api/auth/session` for HttpOnly cookies.
2. **`rememberAuthenticatedUser({ user })` rebuilt the session with NO `accessToken`** — Login/TopNav called this and **wiped the bearer** right after login.
3. **`refreshSession()` deliberately stripped the bearer** before probing `GET /api/auth/me` *without* `Authorization`.
4. When cookie sync lagged or failed (swallowed by best-effort sync), `/api/auth/me` returned **401**, cleared the client marker, and Home Generate navigated to **`/login?next=/`**.

## Fix

| Change | Why |
|---|---|
| `rememberAuthenticatedUser` preserves existing `accessToken` | Login `me` effect must not strip bearer |
| `refreshSession` does **not** strip bearer; sends `Authorization` when present | Probe works with bearer even if cookies missing |
| `ensureFreshSession` returns fresh bearer immediately; no localStorage-only resurrect after failed refresh | Stops fake logged-in → create → UNAUTHORIZED → `/login` |
| `signIn` retries cookie sync once, keeps bearer if sync fails | Cookies preferred; bearer is the safety net |
| Home Generate only bounces when hydrate **and** `auth.me` say signed out | Avoid false bounce while `user` is live |

## Deploy proof (2026-09-19 ~14:28 NZST / PT)

- **Fly release v323** complete on `appforge-unfurling-moon-9058`
- Image: `deployment-01M2VQSBP8WRNMJAAFQM0ZDR2H`
- Live bundle contains `/api/auth/me` with `Authorization: Bearer` when token present (no pre-strip) and `ensureFreshSession` → `return t||null`
- `GET /api/auth/me` unauthenticated → **401** `AUTH_REQUIRED`
- Auth unit tests passed (4/4)
