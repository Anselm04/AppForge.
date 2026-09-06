declare module "csurf" {
  import type { RequestHandler } from "express";
  interface CookieOptions {
    key?: string;
    path?: string;
    signed?: boolean;
    secure?: boolean;
    maxAge?: number;
    httpOnly?: boolean;
    sameSite?: boolean | "lax" | "strict" | "none";
    domain?: string;
  }
  interface CsurfOptions {
    value?: (req: import("express").Request) => string | undefined;
    cookie?: boolean | CookieOptions;
    ignoreMethods?: string[];
    sessionKey?: string;
  }
  function csurf(options?: CsurfOptions): RequestHandler;
  export = csurf;
}
