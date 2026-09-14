import { createTRPCUntypedClient, httpLink } from "@trpc/client";

const baseUrl = (
  process.env.APPFORGE_URL || "https://appforge-unfurling-moon-9058.fly.dev"
).replace(/\/$/, "");
const email = process.env.APPFORGE_CANARY_EMAIL;
const password = process.env.APPFORGE_CANARY_PASSWORD;
const hcaptchaToken = process.env.APPFORGE_CANARY_HCAPTCHA_TOKEN;
const godCode = process.env.APPFORGE_CANARY_GOD_CODE || "";
const godCodePhone = process.env.APPFORGE_CANARY_GOD_CODE_PHONE || "";
const godCodeOtp = process.env.APPFORGE_CANARY_GOD_CODE_OTP || "";

function required(name, value) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readRuntimeConfig() {
  const res = await fetchWithTimeout(`${baseUrl}/config.js`);
  if (!res.ok) throw new Error(`Runtime config failed: HTTP ${res.status}`);
  const text = await res.text();
  const match = text.match(/window\.__APPFORGE_CONFIG__=(\{.*\});?\s*$/s);
  if (!match) throw new Error("Unable to parse AppForge runtime config");
  const config = JSON.parse(match[1]);
  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    throw new Error(
      "Production runtime config is missing Supabase public configuration",
    );
  }
  return config;
}

async function supabasePasswordLogin(config) {
  const res = await fetchWithTimeout(
    `${String(config.supabaseUrl).replace(/\/$/, "")}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: config.supabasePublishableKey,
        Authorization: `Bearer ${config.supabasePublishableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token || !body.refresh_token) {
    throw new Error(
      `Real production login failed: HTTP ${res.status} ${JSON.stringify(body)}`,
    );
  }
  return body;
}

async function supabaseRefresh(config, refreshToken) {
  const res = await fetchWithTimeout(
    `${String(config.supabaseUrl).replace(/\/$/, "")}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: config.supabasePublishableKey,
        Authorization: `Bearer ${config.supabasePublishableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(
      `Real production session refresh failed: HTTP ${res.status} ${JSON.stringify(body)}`,
    );
  }
  return body;
}

async function getCsrf() {
  const res = await fetchWithTimeout(`${baseUrl}/api/csrf-token`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CSRF token request failed: HTTP ${res.status}`);
  const body = await res.json();
  if (!body.csrfToken) throw new Error("CSRF endpoint returned no token");
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("CSRF endpoint returned no signed cookie");
  return { csrfToken: body.csrfToken, cookie: setCookie.split(";")[0] };
}

function makeTrpc(accessToken, csrf) {
  return createTRPCUntypedClient({
    links: [
      httpLink({
        url: `${baseUrl}/api/trpc`,
        headers() {
          return {
            Authorization: `Bearer ${accessToken}`,
            "x-csrf-token": csrf.csrfToken,
            Cookie: csrf.cookie,
            Accept: "application/json",
          };
        },
      }),
    ],
  });
}

async function openBuildStream(projectId, accessToken) {
  const deadline = Date.now() + 25 * 60 * 1000;
  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.min(8 * 60 * 1000, deadline - Date.now()),
    );
    let res;
    try {
      res = await fetch(`${baseUrl}/api/build/${projectId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "text/event-stream, application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (res.status === 202) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      continue;
    }
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`Build stream failed: HTTP ${res.status} ${text}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let eventName = "message";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      while ((index = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        let dataText = "";
        eventName = "message";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          if (line.startsWith("data:")) dataText += line.slice(5).trim();
        }
        if (!dataText) continue;
        const data = JSON.parse(dataText);
        if (eventName === "error") {
          throw new Error(
            `Real production build failed: ${JSON.stringify(data)}`,
          );
        }
        if (eventName === "done") {
          if (!data.liveUrl || !/^https:\/\//i.test(data.liveUrl)) {
            throw new Error(
              `Build completed without a verified HTTPS liveUrl: ${JSON.stringify(data)}`,
            );
          }
          return data;
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error("Timed out waiting for real production build completion");
}

async function verifyDeployedProduct(liveUrl) {
  const root = await fetchWithTimeout(liveUrl, { redirect: "follow" }, 30_000);
  if (root.status < 200 || root.status >= 400) {
    throw new Error(
      `Generated product root failed: HTTP ${root.status} at ${liveUrl}`,
    );
  }
  const html = await root.text();
  if (!html.trim())
    throw new Error("Generated product returned an empty document");

  const url = new URL(liveUrl);
  const assetMatches = [
    ...html.matchAll(
      /(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi,
    ),
  ]
    .map((match) => match[1])
    .slice(0, 8);

  if (assetMatches.length === 0) {
    throw new Error(
      "Generated product rendered HTML but exposed no JS/CSS assets to verify",
    );
  }

  for (const asset of assetMatches) {
    const assetUrl = new URL(asset, url).toString();
    const res = await fetchWithTimeout(
      assetUrl,
      { redirect: "follow" },
      20_000,
    );
    if (!res.ok)
      throw new Error(
        `Generated product asset failed: HTTP ${res.status} ${assetUrl}`,
      );
  }

  return { status: root.status, checkedAssets: assetMatches.length };
}

async function main() {
  required("APPFORGE_CANARY_EMAIL", email);
  required("APPFORGE_CANARY_PASSWORD", password);
  required("APPFORGE_CANARY_HCAPTCHA_TOKEN", hcaptchaToken);

  console.log("[canary] reading live production configuration");
  const config = await readRuntimeConfig();

  console.log("[canary] real production login");
  const login = await supabasePasswordLogin(config);

  console.log("[canary] real production refresh/reopen session proof");
  const refreshed = await supabaseRefresh(config, login.refresh_token);
  const accessToken = refreshed.access_token;

  console.log("[canary] establishing AppForge CSRF/session boundary");
  const csrf = await getCsrf();
  const trpc = makeTrpc(accessToken, csrf);

  let godCodeOtpVerified = false;
  if (godCode) {
    required("APPFORGE_CANARY_GOD_CODE_PHONE", godCodePhone);
    required("APPFORGE_CANARY_GOD_CODE_OTP", godCodeOtp);
    if (!/^\d{6}$/.test(godCodeOtp)) {
      throw new Error("APPFORGE_CANARY_GOD_CODE_OTP must be a real six-digit SMS code");
    }
    console.log("[canary] redeeming real owner God Code with Twilio SMS proof");
    const redemption = await trpc.mutation("admin.redeemCode", {
      code: godCode,
      phone: godCodePhone,
      otp: godCodeOtp,
    });
    if (!redemption?.success)
      throw new Error(
        `God Code redemption did not succeed: ${JSON.stringify(redemption)}`,
      );
    godCodeOtpVerified = true;
  }

  const tier = await trpc.query("projects.tierStatus");
  if (!tier?.isPaid && !tier?.unlimited && !godCodeOtpVerified) {
    throw new Error(
      `Canary account has no paid/unlimited entitlement: ${JSON.stringify(tier)}`,
    );
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  console.log(
    "[canary] creating a real production project and requiring automatic build start",
  );
  const created = await trpc.mutation("projects.create", {
    title: `Production Canary ${stamp}`,
    description:
      "Create a small production-ready responsive web app with a landing page, one interactive counter button, clear heading text, and no external API dependencies. This is a real AppForge production canary build.",
    techStack: "react-node",
    hcaptchaToken,
    locale: "en",
    buildCapabilities: [],
  });

  if (!created?.id || created?.status !== "running") {
    throw new Error(
      `Project did not start automatically: ${JSON.stringify(created)}`,
    );
  }
  const projectId = created.id;

  console.log(
    `[canary] waiting for real agents/build/deployment on project ${projectId}`,
  );
  const done = await openBuildStream(projectId, accessToken);

  console.log("[canary] verifying persisted project completion");
  const project = await trpc.query("projects.get", { id: projectId });
  if (project?.status !== "completed") {
    throw new Error(
      `Project status is not completed after done event: ${JSON.stringify(project)}`,
    );
  }
  if (
    !project?.generatedFiles ||
    Object.keys(project.generatedFiles).length === 0
  ) {
    throw new Error(
      "Completed canary project has no persisted generated files",
    );
  }

  console.log(`[canary] opening real generated product ${done.liveUrl}`);
  const live = await verifyDeployedProduct(done.liveUrl);

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        projectId,
        liveUrl: done.liveUrl,
        projectStatus: project.status,
        generatedFileCount: Object.keys(project.generatedFiles).length,
        liveHttpStatus: live.status,
        checkedAssets: live.checkedAssets,
        sessionRefreshVerified: true,
        entitlementVerified: true,
        godCodeOtpVerified,
        automaticBuildStartVerified: true,
        agentBuildCompletionVerified: true,
        productionDeploymentVerified: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    "[canary] FAILED",
    error instanceof Error ? error.stack || error.message : error,
  );
  process.exit(1);
});