import type { Request, Response } from "express";
import { getUserById } from "../db.js";

export type Context = {
  req: Request;
  res: Response;
  user: { id: number; email: string; name: string } | null;
};

export async function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<Context> {
  const authUser = (req as any).user;
  let user = null;

  if (authUser) {
    user = {
      id: authUser.id,
      email: authUser.email || "",
      name: authUser.name || "",
    };
  }

  return { req, res, user };
}
