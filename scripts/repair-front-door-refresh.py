from pathlib import Path

middleware_path = Path("src/middleware/supabaseAuth.ts")
middleware = middleware_path.read_text()

import_marker = 'import { logger } from "../_core/logger.js";\n'
import_line = 'import { coordinateRefreshAcrossMachines } from "../lib/refreshCoordinator.js";\n'
if import_line not in middleware:
    if import_marker not in middleware:
        raise SystemExit("supabaseAuth logger import marker not found")
    middleware = middleware.replace(import_marker, import_marker + import_line, 1)

old = '''  const flight = refreshAccessToken(refreshToken)
    .then((result) => {
      if (result) {
        recentRefreshes.set(key, {
          result,
          expiresAt: Date.now() + REFRESH_GRACE_MS,
        });
      }
      return result;
    })
    .finally(() => {
      refreshFlights.delete(key);
    });
'''
new = '''  const flight = coordinateRefreshAcrossMachines(key, () =>
    refreshAccessToken(refreshToken),
  )
    .then((result) => {
      if (result) {
        recentRefreshes.set(key, {
          result,
          expiresAt: Date.now() + REFRESH_GRACE_MS,
        });
      }
      return result;
    })
    .finally(() => {
      refreshFlights.delete(key);
    });
'''

if new not in middleware:
    if old not in middleware:
        raise SystemExit("supabaseAuth refresh single-flight marker not found")
    middleware = middleware.replace(old, new, 1)

middleware_path.write_text(middleware)

server_path = Path("src/server.ts")
server = server_path.read_text()
server = server.replace(
    'import { authEmailHookHandler } from "./routes/authEmailHook.js";\n',
    "",
    1,
)
hook_block = '''// Supabase calls this server-to-server hook. Its signed raw payload provides
// authentication; browser CSRF and JSON parsing must run only after it.
app.post(
  "/api/auth/email-hook",
  express.raw({ type: "application/json", limit: "64kb" }),
  authEmailHookHandler,
);
'''
if hook_block in server:
    server = server.replace(hook_block, "", 1)
if "authEmailHookHandler" in server or '"/api/auth/email-hook"' in server:
    raise SystemExit("obsolete auth email hook still referenced in server")
server_path.write_text(server)
