import type { Request, Response } from "express";
import { getUserById } from "../db";

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
  const userId = (req as any).userId;
  let user: Context["user"] = null;

  if (userId) {
    const dbUser = await getUserById(Number(userId));
    if (dbUser) {
      user = {
        id: dbUser.id,
        email: dbUser.email || "",
        name: dbUser.name || "",
      };
    }
  }

  return { req, res, user };
}
