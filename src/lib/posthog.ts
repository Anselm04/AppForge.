/**
 * PostHog product analytics for AppForge (browser).
 * Key comes from runtime /config.js so Fly secrets work without rebuild.
 */
import posthog from "posthog-js";

declare global {
  interface Window {
    __APPFORGE_CONFIG__?: {
      supabaseUrl?: string;
      supabasePublishableKey?: string;
      stripePublicKey?: string;
      hcaptchaSiteKey?: string;
      posthogKey?: string;
      posthogHost?: string;
    };
  }
}

let started = false;

export function initPostHog(): void {
  if (started || typeof window === "undefined") return;

  const runtime = window.__APPFORGE_CONFIG__;
  const key =
    runtime?.posthogKey ||
    (import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined) ||
    "";
  const host =
    runtime?.posthogHost ||
    (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined) ||
    "https://us.i.posthog.com";

  if (!key) return;

  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });
  started = true;
}

export function capturePostHogEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!started) return;
  posthog.capture(event, properties);
}

export function identifyPostHogUser(
  distinctId: string,
  properties?: Record<string, unknown>,
): void {
  if (!started) return;
  posthog.identify(distinctId, properties);
}

export { posthog };
