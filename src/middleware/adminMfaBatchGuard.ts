import type { RequestHandler } from "express";

/** MFA mutations must not bypass their per-route limits inside a tRPC batch. */
export const adminMfaBatchGuard: RequestHandler = (req, res, next) => {
  let operations: string[];
  try {
    operations = decodeURIComponent(req.path.replace(/^\//, "")).split(",");
  } catch {
    return res.status(400).json({ error: "Invalid procedure path" });
  }
  const hasMfaMutation = operations.some(
    (operation) =>
      operation === "admin.requestMfa" || operation === "admin.verifyMfa",
  );
  if (
    hasMfaMutation &&
    (operations.length > 1 || req.path !== `/${operations[0]}`)
  ) {
    res.setHeader("Cache-Control", "no-store");
    return res
      .status(400)
      .json({ error: "Admin SMS verification requires a standalone request" });
  }
  return next();
};
