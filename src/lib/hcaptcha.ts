import { ENV } from "../_core/env.js";

const HCAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify";
const HCAPTCHA_TIMEOUT_MS = 5_000;

export async function verifyHcaptchaToken(
  token: string | undefined,
): Promise<boolean> {
  // Production must fail closed when captcha is not configured. Development
  // may remain permissive so local work does not require external credentials.
  if (!ENV.hCaptchaSecret) return !ENV.isProduction;
  if (!token?.trim()) return false;

  const body = new URLSearchParams({
    secret: ENV.hCaptchaSecret,
    response: token.trim(),
  });

  try {
    const res = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(HCAPTCHA_TIMEOUT_MS),
    });

    if (!res.ok) return false;
    const data = (await res.json()) as {
      success?: boolean;
      hostname?: string;
    };
    if (data.success !== true) return false;

    const expectedHostname = process.env.HCAPTCHA_EXPECTED_HOSTNAME?.trim();
    if (
      ENV.isProduction &&
      expectedHostname &&
      data.hostname !== expectedHostname
    ) {
      return false;
    }

    return true;
  } catch {
    // hCaptcha network errors/timeouts must not allow expensive build work to
    // start in production.
    return false;
  }
}
