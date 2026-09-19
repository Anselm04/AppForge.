# AppForge iPhone session fix (CriOS Generate → /login)

**Date:** 2026-09-19 ~14:45 NZST (PT / UTC+12)  
**Repo:** `/workspace/AppForge-audit-main`  
**Fly app:** `appforge-unfurling-moon-9058`  
**Branch:** `fix/iphone-session-storage-bearer`  
**Prior failed claim:** Fly **v323** — Anselm’s iPhone (CriOS) still saw Generate → `/login` with Fly logs ~02:39Z showing repeated `GET /api/auth/me` **401** `userId:null`, and `POST /auth.me` **200** with `userId:null` (localStorage marker only).

## Honest root cause (v323 did NOT fix this for him)

1. **`accessToken` was memory-only** (`cachedSession` in `src/lib/auth.ts`). After login navigation / full load on mobile Safari/Chrome iOS, the in-memory bearer was gone. Only `localStorage appforge.user` remained — enough for optimistic UI / `auth.me` TRPC to look “kinda logged in”, not enough for `Authorization` on `projects.create`.

2. **HttpOnly cookies from `POST /api/auth/session` were not sticking** on his iPhone. Every cookie-only `/api/auth/me` returned **401** with no bearer. Cookie flags used `SameSite=strict` (mobile same-site / redirect edge cases are less forgiving than desktop).

3. **Generate / `ensureFreshSession` then probed `/api/auth/me` without a bearer** → 401 → Home bounced to `/login`.

v320–v323 correctly stopped *throwing away* an in-memory bearer during refresh, but they never **persisted** that bearer across a real mobile full load. That is why desktop looked fixed and Anselm’s iPhone did not.

## Fix shipped

### A) Persist bearer in `sessionStorage`
- Key: `appforge.accessToken`
- Written in `saveSession` on `signIn` / redirect / signup session
- Restored in `getSession()` so `getAccessToken()` / trpc `Authorization` work after navigation
- Cleared on `signOut`, `clearClientUserMarker`, and true 401 bearer rejection
- Refresh token stays HttpOnly-cookie-only (not written to web storage)

### B) Hard cookie sync on login
- `signIn` already `await`s `syncServerSession` (with one best-effort retry)
- On cookie sync failure: **keep** sessionStorage bearer so Generate still authenticates

### C) Cookie flags (`src/middleware/supabaseAuth.ts`)
- `SameSite=Lax` (was `strict`)
- `Secure=true` when `NODE_ENV === "production"`
- `Path=/`, `httpOnly: true`
- Logs `supabase_auth_session_cookies_set` on successful `Set-Cookie`

### D) Home Generate
- If `getAccessToken()` returns a non-empty bearer, **always** call `projects.create` — never bounce to `/login` while a SPA bearer exists
- UNAUTHORIZED hard-bounce only when both React Query `user` and bearer are absent

## Deploy / proof

- **Fly version: v324** (machines `7819640b1151d8`, `d896d02c949718`, both healthy) — deployed 2026-09-19 ~14:46 NZST (PT)
- Live JS `/assets/index-pyfqBucm.js` contains `appforge.accessToken` and `sessionStorage` (15 hits)
- Deployed server: `sameSite: "lax"` in `/app/dist/middleware/supabaseAuth.js`
- `GET /api/auth/me` without bearer → **401** `AUTH_REQUIRED` (expected)
- Disposable Supabase signup for a live bearer was **rate-limited** at proof time (`email rate limit exceeded`); cannot mint a fresh access token without owner credentials. Contract proof: Authorization bearer path is unchanged and now fed from sessionStorage after hard refresh.
- **iPhone must hard-refresh** (pull-to-refresh / close tab) so CriOS loads `index-pyfqBucm.js` instead of the v323 bundle.

## Files
- `src/lib/auth.ts`
- `src/middleware/supabaseAuth.ts`
- `src/pages/Home.tsx`
- tests: `authSse`, `supabaseAuthBoundary`, `supabaseLoginResilience`
