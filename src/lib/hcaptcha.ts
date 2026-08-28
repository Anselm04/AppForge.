import { ENV } from "../_core/env.js";

export async function verifyHcaptchaToken(
  token: string | undefined,
): Promise<boolean> {
  if (!ENV.hCaptchaSecret) return true;
  if (!token?.trim()) return false;

  const body = new URLSearchParams({
    secret: ENV.hCaptchaSecret,
    response: token,
  });

  const res = await fetch("https://hcaptcha.com/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}
