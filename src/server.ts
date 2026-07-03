import express from "express";
import { createRequestHandler } from "@trpc/server/adapters/express";
import { appRouter } from "./routers/index.js";
import { createContext } from "./_core/context.js";
import { stripeWebhookHandler } from "./webhooks/stripe.js";
import { ENV } from "./_core/env.js";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cookieParser(ENV.cookieSecret));
app.use(express.json());

// Stripe webhook (raw body required)
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookHandler);

// tRPC routes
app.use(
  "/api/trpc",
  createRequestHandler({
    router: appRouter,
    createContext,
  })
);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`🚀 AppForge server running on http://localhost:${PORT}`);
});
