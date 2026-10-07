import { Router } from "express";
import { createSignupConfirmation } from "../services/authEmailDelivery.js";
import { logger } from "../_core/logger.js";

export const authSignupRouter = Router();

function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  return value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/";
}

function normalizePhone(value: unknown): string {
  const phone =
    typeof value === "string" ? value.trim().replace(/[\s()-]/g, "") : "";
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : "";
}

authSignupRouter.post("/signup", async (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const fullName =
    typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "";
  const phone = normalizePhone(req.body?.phone);
  const next = safeNext(req.body?.next);

  if (
    !email ||
    !email.includes("@") ||
    password.length < 8 ||
    fullName.length < 2 ||
    fullName.length > 100 ||
    !phone
  ) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({
      error:
        "A name, valid email, mobile number with country code, and password of at least 8 characters are required.",
      code: "INVALID_SIGNUP_INPUT",
    });
  }

  const origin = `${req.protocol}://${req.get("host")}`;
  const redirectTo = `${origin}/login?next=${encodeURIComponent(next)}`;

  try {
    const result = await createSignupConfirmation({
      email,
      password,
      redirectTo,
      fullName,
      phone,
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(202).json({
      user: { id: result.userId, email },
      confirmationSent: true,
    });
  } catch (error) {
    logger.error({ error }, "signup_confirmation_delivery_failed");
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({
      error:
        "We could not send your confirmation email. Please try again shortly.",
      code: "CONFIRMATION_DELIVERY_FAILED",
    });
  }
});
