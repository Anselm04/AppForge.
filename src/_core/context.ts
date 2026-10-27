import type { Request, Response } from "express";

export type ContextUser = {
  id: number;
  email: string;
  name: string;
  supabaseUid: string;
  phone?: string;
  phoneVerified: boolean;
};

export type Context = {
  req: Request;
  res: Response;
  user: ContextUser | null;
};

export async function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<Context> {
  const authUser = req.user;
  let user: ContextUser | null = null;

  if (authUser) {
    user = {
      id: authUser.id,
      email: authUser.email || "",
      name: authUser.name || "",
      supabaseUid: authUser.supabaseUid,
      phone: authUser.phone,
      phoneVerified: authUser.phoneVerified,
    };
  }

  return { req, res, user };
}
