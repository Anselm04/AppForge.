import { Router, type RequestHandler } from "express";
import {
  createSignupConfirmation,
  resendSignupConfirmation,
  sendPasswordRecovery,
} from "../services/authEmailDelivery.js";
import { logger } from "../_core/logger.js";
import {
  passwordRecoveryRedirect,
  signupRedirect,
} from "../services/authRedirect.js";

import {
  createLocalRateLimiter,
  getRateLimitConfig,
} from "../middleware/rateLimiter.js";

export const authSignupRouter = Router();
export const signupAbuseLimiter = createLocalRateLimiter(
  getRateLimitConfig("auth"),
);
export const resendConfirmationHandler: RequestHandler = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    res
      .status(400)
      .json({ error: "Enter a valid email address.", code: "INVALID_EMAIL" });
    return;
  }
  try {
    if (req.body?.purpose === "password_recovery") {
      await sendPasswordRecovery({
        email,
        redirectTo: passwordRecoveryRedirect(),
      });
      res.status(202).json({
        message:
          "If this address belongs to an AppForge account, a password-reset email has been requested.",
      });
      return;
    }

    await resendSignupConfirmation({
      email,
      redirectTo: signupRedirect(safeNext(req.body?.next)),
    });
    res.status(202).json({
      message:
        "If this address has an account awaiting confirmation, a verification email has been requested.",
    });
  } catch {
    res.status(503).json({
      error:
        req.body?.purpose === "password_recovery"
          ? "Unable to request a password-reset email. Please try again shortly."
          : "Unable to request a verification email. Please try again shortly.",
      code:
        req.body?.purpose === "password_recovery"
          ? "PASSWORD_RECOVERY_DELIVERY_FAILED"
          : "CONFIRMATION_DELIVERY_FAILED",
    });
  }
};
authSignupRouter.post(
  "/resend-verification",
  signupAbuseLimiter,
  resendConfirmationHandler,
);

function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  return value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/";
}

function normalizePhone(value: unknown): string {
  if (typeof value !== "string") return "";
  const phone = value.trim().replace(/[\s()-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : "";
}

authSignupRouter.post("/signup", signupAbuseLimiter, async (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const phone = normalizePhone(req.body?.phone);
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const next = safeNext(req.body?.next);

  if (!email || !email.includes("@") || !phone || password.length < 8) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({
      error:
        "A valid email, mobile number in international format, and password of at least 8 characters are required.",
      code: "INVALID_SIGNUP_INPUT",
    });
  }

  try {
    const redirectTo = signupRedirect(next);
    const result = await createSignupConfirmation({
      email,
      phone,
      password,
      redirectTo,
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(202).json({
      user: { id: result.userId, email, phone },
      confirmationSent: true,
      phoneVerificationRequired: true,
    });
  } catch (error) {
    logger.error({ error }, "signup_confirmation_delivery_failed");
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({
      error:
        "We could not create and verify your account right now. Please try again shortly.",
      code: "CONFIRMATION_DELIVERY_FAILED",
    });
  }
});
