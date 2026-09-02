import compression from 'compression';
import { RequestHandler } from 'express';

export function compressionMiddleware(): RequestHandler {
  return compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      const path = req.path || "";
      if (path.startsWith("/api/build") || path.startsWith("/live")) return false;
      const accept = String(req.headers.accept || "");
      if (accept.includes("text/event-stream")) return false;
      return compression.filter(req, res);
    },
  });
}

export default compressionMiddleware;
