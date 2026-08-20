import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import { appRouter } from "./routers/index";
import { createContext } from "./_core/context";
import { stripeWebhookHandler } from "./webhooks/stripe";
import { ENV } from "./_core/env";

const app = express();
const PORT = process.env.PORT || 3000;

// Stripe webhook needs raw body — register before json parser
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(cookieParser(ENV.cookieSecret || undefined));
app.use(express.json());

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`AppForge server running on http://localhost:${PORT}`);
});
