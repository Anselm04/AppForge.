from pathlib import Path

path = Path("src/middleware/supabaseAuth.ts")
text = path.read_text()

import_marker = 'import { logger } from "../_core/logger.js";\n'
import_line = 'import { coordinateRefreshAcrossMachines } from "../lib/refreshCoordinator.js";\n'
if import_line not in text:
    if import_marker not in text:
        raise SystemExit("supabaseAuth logger import marker not found")
    text = text.replace(import_marker, import_marker + import_line, 1)

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

if new not in text:
    if old not in text:
        raise SystemExit("supabaseAuth refresh single-flight marker not found")
    text = text.replace(old, new, 1)

path.write_text(text)
