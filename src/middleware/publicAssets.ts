import express from "express";
import path from "node:path";

/** Existing public assets must not consume the customer's application budget. */
export function createPublicAssetsRouter(clientDir: string) {
  const router = express.Router();
  for (const directory of ["assets", "branding"]) {
    router.use(
      `/${directory}`,
      express.static(path.join(clientDir, directory), {
        index: false,
        fallthrough: true,
      }),
    );
  }
  return router;
}
