# Sign-in providers (Supabase)

AppForge's browser sign-in runs against the Supabase project named in
`window.__APPFORGE_CONFIG__.supabaseUrl` / `VITE_SUPABASE_URL`
(currently `https://yihcwxmcvmcquvsulqkv.supabase.co`).

The UI only renders a social button for a provider Supabase reports as enabled.
`src/lib/supabase-client.ts` reads `GET /auth/v1/settings` and filters to
`SOCIAL_SIGN_IN_PROVIDERS` (`google`, `github`), so a provider that is off in the
dashboard is simply not offered — no code change is needed to turn one on.

## Required dashboard configuration

### Authentication → Providers

| Provider | Requirement                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| Email    | Enabled. `mailer_autoconfirm` must stay **off** so accounts confirm by email link before their first session. |
| Google   | Enabled with the OAuth client ID/secret from Google Cloud Console.                                            |
| GitHub   | Enabled with the client ID/secret from a GitHub OAuth App.                                                    |

Both social providers redirect through the Supabase callback, so the value
registered with each provider must be:

```
https://yihcwxmcvmcquvsulqkv.supabase.co/auth/v1/callback
```

- Google Cloud Console → **Authorized redirect URIs**
- GitHub OAuth App → **Authorization callback URL**

### Authentication → URL Configuration

Set **Site URL** to the production origin and add every origin AppForge is
served from to **Redirect URLs**:

```
https://appforge-unfurling-moon-9058.fly.dev/**
http://localhost:3000/**
```

Supabase validates `redirect_to` at the callback and silently falls back to the
**Site URL** when there is no match. If a local origin is missing from that list,
OAuth sign-in started on `localhost` bounces to the production site instead of
returning to the dev app, and the session never reaches the client.

## Verifying

The allow-list is only enforced at the callback, not at `authorize`, so a
`redirect_to` echoed back by `/auth/v1/authorize` does **not** prove it is
allowed. To check an origin:

1. `GET {SUPABASE_URL}/auth/v1/settings` with the publishable key and confirm the
   provider appears as `true` under `external`.
2. `GET {SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=<origin>/login`
   with the publishable key — expect a `302` to `accounts.google.com`.
3. Complete a real browser sign-in and confirm the session lands back on the
   expecting `/login` origin, not the Site URL root.

`src/lib/__tests__/socialAuthProviders.test.ts` covers step 1 plus the
authorize-URL construction; the browser round trip in step 3 has to be done by
hand.
