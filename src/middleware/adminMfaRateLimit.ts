import type { RequestHandler } from "express";

/** Mounted at /api/trpc after authentication, before the tRPC adapter. */
export function adminMfaRateLimit(
  requestLimiter: RequestHandler,
  verifyLimiter: RequestHandler,
): RequestHandler {
  return (req, res, next) => {
    let procedures: string[];
    try {
      procedures = decodeURIComponent(req.path.slice(1)).split(",");
    } catch {
      res.status(400).json({ error: "Invalid procedure path" });
      return;
    }
    const procedure = procedures.find(
      (name) => name === "admin.requestMfa" || name === "admin.verifyMfa",
    );
    if (!procedure) return next();

    // Express prefix mounts do not match comma-separated tRPC batches. Reject
    // mixed/repeated MFA operations before tRPC can execute any of the batch.
    // Single-operation requests remain supported even with ?batch=1.
    if (procedures.length !== 1) {
      res
        .status(400)
        .json({ error: "Admin MFA operations must be sent individually" });
      return;
    }
    const limiter =
      procedure === "admin.requestMfa" ? requestLimiter : verifyLimiter;
    return limiter(req, res, next);
  };
}
