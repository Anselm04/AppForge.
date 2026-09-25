/**
 * Curated, code-owned research targets per stack, integration, deployment
 * target and product type. These say WHERE to look (official registries,
 * official documentation, canonical repositories); what comes back is always
 * treated as untrusted data.
 */

import type { ProductType } from "./productContract.js";

export type PackageEcosystem = "npm" | "PyPI" | "crates.io" | "Pub";

export type PackageTarget = { ecosystem: PackageEcosystem; name: string };

export type OfficialDocTarget = {
  url: string;
  category:
    | "official_docs"
    | "platform_limits"
    | "deployment"
    | "security"
    | "monetization"
    | "integration";
  label: string;
};

export type StackResearchTarget = {
  /** Human-readable framework name used in web queries. */
  framework: string;
  packages: PackageTarget[];
  repositories: string[];
  docs: OfficialDocTarget[];
};

const npm = (name: string): PackageTarget => ({ ecosystem: "npm", name });
const pypi = (name: string): PackageTarget => ({ ecosystem: "PyPI", name });
const doc = (
  url: string,
  label: string,
  category: OfficialDocTarget["category"] = "official_docs",
): OfficialDocTarget => ({ url, label, category });

export const STACK_RESEARCH_TARGETS: Record<string, StackResearchTarget> = {
  "react-node": {
    framework: "React with Vite and Node.js",
    packages: [npm("react"), npm("vite"), npm("express")],
    repositories: ["facebook/react", "vitejs/vite"],
    docs: [doc("https://react.dev/reference/react", "React reference"), doc("https://vite.dev/guide/", "Vite guide")],
  },
  "static-html": {
    framework: "static HTML CSS JavaScript website",
    packages: [npm("serve")],
    repositories: ["mdn/content"],
    docs: [doc("https://developer.mozilla.org/en-US/docs/Web/HTML", "MDN HTML reference")],
  },
  "next-node": {
    framework: "Next.js App Router",
    packages: [npm("next"), npm("react")],
    repositories: ["vercel/next.js"],
    docs: [doc("https://nextjs.org/docs", "Next.js documentation")],
  },
  "phaser-html5": {
    framework: "Phaser HTML5 game framework",
    packages: [npm("phaser"), npm("vite")],
    repositories: ["phaserjs/phaser"],
    docs: [doc("https://docs.phaser.io/", "Phaser documentation")],
  },
  "three-js-3d": {
    framework: "Three.js WebGL",
    packages: [npm("three"), npm("vite")],
    repositories: ["mrdoob/three.js"],
    docs: [doc("https://threejs.org/docs/", "Three.js documentation")],
  },
  "react-native-expo": {
    framework: "React Native with Expo",
    packages: [npm("expo"), npm("react-native")],
    repositories: ["expo/expo"],
    docs: [doc("https://docs.expo.dev/", "Expo documentation")],
  },
  "flutter-firebase": {
    framework: "Flutter with Firebase",
    packages: [{ ecosystem: "Pub", name: "firebase_core" }, { ecosystem: "Pub", name: "cloud_firestore" }],
    repositories: ["flutter/flutter", "firebase/flutterfire"],
    docs: [doc("https://docs.flutter.dev/", "Flutter documentation"), doc("https://firebase.google.com/docs/flutter/setup", "Firebase for Flutter")],
  },
  "electron-react": {
    framework: "Electron desktop app with React",
    packages: [npm("electron"), npm("react"), npm("vite")],
    repositories: ["electron/electron"],
    docs: [doc("https://www.electronjs.org/docs/latest/", "Electron documentation"), doc("https://www.electronjs.org/docs/latest/tutorial/security", "Electron security checklist", "security")],
  },
  "tauri-rust": {
    framework: "Tauri 2 desktop app with Rust",
    packages: [{ ecosystem: "crates.io", name: "tauri" }, npm("@tauri-apps/cli")],
    repositories: ["tauri-apps/tauri"],
    docs: [doc("https://v2.tauri.app/", "Tauri 2 documentation"), doc("https://v2.tauri.app/security/", "Tauri security", "security")],
  },
  "api-service": {
    framework: "Node.js Express REST API",
    packages: [npm("express"), npm("helmet"), npm("express-rate-limit")],
    repositories: ["expressjs/express"],
    docs: [doc("https://expressjs.com/en/advanced/best-practice-security.html", "Express security best practices", "security"), doc("https://nodejs.org/en/about/previous-releases", "Node.js release schedule")],
  },
  "node-service": {
    framework: "Node.js service",
    packages: [npm("express"), npm("helmet")],
    repositories: ["nodejs/node"],
    docs: [doc("https://nodejs.org/en/about/previous-releases", "Node.js release schedule"), doc("https://nodejs.org/api/", "Node.js API")],
  },
  "python-service": {
    framework: "Python FastAPI service",
    packages: [pypi("fastapi"), pypi("uvicorn")],
    repositories: ["fastapi/fastapi"],
    docs: [doc("https://fastapi.tiangolo.com/", "FastAPI documentation"), doc("https://devguide.python.org/versions/", "Python supported versions")],
  },
  "ai-agent-node": {
    framework: "Node.js AI agent with LLM tool calling",
    packages: [npm("openai"), npm("express")],
    repositories: ["openai/openai-node"],
    docs: [doc("https://platform.openai.com/docs/guides/function-calling", "OpenAI function calling guide"), doc("https://genai.owasp.org/llm-top-10/", "OWASP Top 10 for LLM applications", "security")],
  },
  "ai-agent-python": {
    framework: "Python AI agent with LLM tool calling",
    packages: [pypi("openai"), pypi("httpx"), pypi("fastapi")],
    repositories: ["openai/openai-python"],
    docs: [doc("https://platform.openai.com/docs/guides/function-calling", "OpenAI function calling guide"), doc("https://genai.owasp.org/llm-top-10/", "OWASP Top 10 for LLM applications", "security")],
  },
  "chrome-extension": {
    framework: "Chrome extension Manifest V3",
    packages: [npm("@types/chrome"), npm("typescript")],
    repositories: ["GoogleChrome/chrome-extensions-samples"],
    docs: [doc("https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3", "Manifest V3 overview"), doc("https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure", "Extension security", "security")],
  },
  "browser-automation": {
    framework: "Playwright browser automation",
    packages: [npm("playwright"), npm("express")],
    repositories: ["microsoft/playwright"],
    docs: [doc("https://playwright.dev/docs/intro", "Playwright documentation"), doc("https://playwright.dev/docs/docker", "Playwright Docker images", "deployment")],
  },
  "data-visualization": {
    framework: "React data visualization dashboard",
    packages: [npm("react"), npm("recharts"), npm("vite")],
    repositories: ["recharts/recharts"],
    docs: [doc("https://react.dev/reference/react", "React reference"), doc("https://recharts.org/en-US/api", "Recharts API")],
  },
};

export const DEPLOYMENT_TARGET_DOCS: Record<string, OfficialDocTarget[]> = {
  fly: [doc("https://fly.io/docs/reference/configuration/", "Fly.io app configuration", "deployment"), doc("https://fly.io/docs/about/pricing/", "Fly.io pricing and resource limits", "platform_limits")],
  vercel: [doc("https://vercel.com/docs/limits", "Vercel limits", "platform_limits")],
  netlify: [doc("https://docs.netlify.com/", "Netlify documentation", "deployment")],
  "github-pages": [doc("https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits", "GitHub Pages limits", "platform_limits")],
  "expo-eas": [doc("https://docs.expo.dev/build/introduction/", "EAS Build", "deployment")],
  "google-play": [doc("https://play.google/developer-content-policy/", "Google Play developer policy", "platform_limits")],
  "apple-app-store": [doc("https://developer.apple.com/app-store/review/guidelines/", "App Store review guidelines", "platform_limits")],
  "chrome-web-store": [doc("https://developer.chrome.com/docs/webstore/program-policies/", "Chrome Web Store program policies", "platform_limits")],
  "desktop-package": [doc("https://www.electronjs.org/docs/latest/tutorial/code-signing", "Desktop code signing", "deployment")],
};

export type IntegrationTarget = {
  match: RegExp;
  name: string;
  packages: PackageTarget[];
  docs: OfficialDocTarget[];
};

export const INTEGRATION_TARGETS: IntegrationTarget[] = [
  { match: /stripe/i, name: "Stripe", packages: [npm("stripe")], docs: [doc("https://docs.stripe.com/api", "Stripe API reference", "integration"), doc("https://docs.stripe.com/webhooks", "Stripe webhooks", "security")] },
  { match: /slack/i, name: "Slack", packages: [npm("@slack/web-api")], docs: [doc("https://api.slack.com/apis/rate-limits", "Slack rate limits", "platform_limits")] },
  { match: /openai|gpt/i, name: "OpenAI", packages: [npm("openai")], docs: [doc("https://platform.openai.com/docs/api-reference", "OpenAI API reference", "integration")] },
  { match: /anthropic|claude/i, name: "Anthropic", packages: [npm("@anthropic-ai/sdk")], docs: [doc("https://docs.anthropic.com/", "Anthropic documentation", "integration")] },
  { match: /supabase/i, name: "Supabase", packages: [npm("@supabase/supabase-js")], docs: [doc("https://supabase.com/docs", "Supabase documentation", "integration")] },
  { match: /firebase/i, name: "Firebase", packages: [npm("firebase")], docs: [doc("https://firebase.google.com/docs", "Firebase documentation", "integration")] },
  { match: /twilio/i, name: "Twilio", packages: [npm("twilio")], docs: [doc("https://www.twilio.com/docs", "Twilio documentation", "integration")] },
  { match: /github/i, name: "GitHub", packages: [npm("@octokit/rest")], docs: [doc("https://docs.github.com/en/rest", "GitHub REST API", "integration")] },
  { match: /discord/i, name: "Discord", packages: [npm("discord.js")], docs: [doc("https://discord.com/developers/docs/intro", "Discord developer docs", "integration")] },
  { match: /shopify/i, name: "Shopify", packages: [npm("@shopify/shopify-api")], docs: [doc("https://shopify.dev/docs/api", "Shopify API", "integration")] },
  { match: /sendgrid/i, name: "SendGrid", packages: [npm("@sendgrid/mail")], docs: [doc("https://www.twilio.com/docs/sendgrid", "SendGrid documentation", "integration")] },
  { match: /resend/i, name: "Resend", packages: [npm("resend")], docs: [doc("https://resend.com/docs", "Resend documentation", "integration")] },
];

export function integrationTarget(integration: string): IntegrationTarget | null {
  return INTEGRATION_TARGETS.find((target) => target.match.test(integration)) ?? null;
}

export const SECURITY_DOCS: Record<"web" | "api" | "mobile" | "llm", OfficialDocTarget> = {
  web: doc("https://owasp.org/Top10/", "OWASP Top 10", "security"),
  api: doc("https://owasp.org/API-Security/", "OWASP API Security Top 10", "security"),
  mobile: doc("https://mas.owasp.org/", "OWASP Mobile Application Security", "security"),
  llm: doc("https://genai.owasp.org/llm-top-10/", "OWASP Top 10 for LLM applications", "security"),
};

export function securityDocForProduct(productType: ProductType): OfficialDocTarget {
  if (productType === "mobile_app") return SECURITY_DOCS.mobile;
  if (productType === "ai_agent") return SECURITY_DOCS.llm;
  if (productType === "api" || productType === "automation_tool" || productType === "developer_tool") return SECURITY_DOCS.api;
  return SECURITY_DOCS.web;
}

export function monetizationDocsForProduct(productType: ProductType): OfficialDocTarget[] {
  if (productType === "mobile_app") {
    return [
      doc("https://developer.apple.com/in-app-purchase/", "Apple in-app purchase", "monetization"),
      doc("https://developer.android.com/google/play/billing", "Google Play billing", "monetization"),
    ];
  }
  return [doc("https://docs.stripe.com/billing/subscriptions/overview", "Stripe subscriptions", "monetization")];
}

/** Product-type specific research questions (code-authored, never from the web). */
export const PRODUCT_TYPE_QUESTIONS: Record<ProductType, { question: string; query: string }[]> = {
  website: [
    { question: "What are the current Core Web Vitals and accessibility (WCAG) requirements?", query: "Core Web Vitals thresholds WCAG 2.2 accessibility requirements" },
  ],
  saas_application: [
    { question: "How should tenant isolation and server-side authorization be designed?", query: "multi-tenant SaaS tenant isolation server-side authorization best practices" },
  ],
  mobile_app: [
    { question: "What do current app store review policies require?", query: "App Store review guidelines Google Play policy requirements new apps" },
  ],
  desktop_app: [
    { question: "How are auto-update, code signing and distribution handled?", query: "desktop app auto update code signing notarization distribution" },
  ],
  game: [
    { question: "What are current browser game performance and input best practices?", query: "HTML5 browser game performance input handling mobile best practices" },
  ],
  ai_agent: [
    { question: "How should tool calling be constrained against prompt injection?", query: "LLM agent tool calling prompt injection defenses OWASP LLM top 10" },
  ],
  developer_tool: [
    { question: "How are developer tools packaged, versioned and distributed?", query: "developer CLI tool packaging semantic versioning distribution best practices" },
  ],
  api: [
    { question: "What are current API rate limiting, pagination and versioning practices?", query: "REST API rate limiting pagination versioning best practices" },
  ],
  ecommerce_product: [
    { question: "What are PCI DSS obligations for checkout and payments?", query: "PCI DSS hosted checkout requirements ecommerce payments" },
  ],
  browser_extension: [
    { question: "What do Chrome Web Store policies require for permissions and remote code?", query: "Chrome Web Store program policies Manifest V3 permissions remote code" },
  ],
  automation_tool: [
    { question: "What are the legal and technical limits of automating third-party sites?", query: "web automation scraping terms of service robots.txt rate limits legal" },
  ],
  data_product: [
    { question: "How should large datasets be visualized accessibly and efficiently?", query: "data visualization accessibility large dataset rendering performance" },
  ],
};
