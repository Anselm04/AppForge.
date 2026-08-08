# Legacy server boundary

The browser application is deployed as a Vite client with Vercel Functions in `api/`.

The following source trees are legacy server or experimental code and are intentionally excluded from the client build until they are repaired and migrated behind explicit server entry points:

- `src/server.ts`
- `src/_core/`
- `src/routers/`
- `src/routes/`
- `src/services/`
- `src/agents/`
- `src/middleware/`
- `src/pages/`

Production client code is limited to `src/main.tsx`, `src/App.tsx`, the pricing component, Supabase client/auth helpers, billing client helper, shared database types, and Vercel Functions in `api/`.

Do not import legacy server modules into browser code. Server-side integration work belongs in `api/` and must keep secrets in Vercel environment variables.
