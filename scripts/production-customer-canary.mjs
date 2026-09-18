import { writeFileSync } from "node:fs";
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

async function verifyDeployedProduct(
  liveUrl,
  { requiredTexts = [] } = {},
) {
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

  let searchableContent = html;
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
    searchableContent += "\n" + (await res.text());
  }

  const missingTexts = requiredTexts.filter(
    (text) => !searchableContent.includes(text),
  );
  if (missingTexts.length > 0) {
    throw new Error(
      `Generated product is reachable but the deployed artifact is missing required customer-visible content: ${missingTexts.join(", ")}`,
    );
  }

  return {
    status: root.status,
    checkedAssets: assetMatches.length,
    verifiedTexts: requiredTexts,
  };
}

function verifyGeneratedTestContract(files) {
  const testPaths = Object.keys(files).filter((path) =>
    /(?:^|\/)(?:__tests__\/.*|.*\.(?:test|spec))\.(?:js|jsx|ts|tsx)$/i.test(path),
  );
  if (testPaths.length === 0) {
    throw new Error(
      "Generated production canary has no persisted unit/integration test file",
    );
  }

  const hasVitestConfig =
    Boolean(files["vitest.config.ts"]) ||
    Boolean(files["vitest.config.js"]) ||
    Boolean(files["vitest.config.mts"]) ||
    Boolean(files["vitest.config.mjs"]);
  if (!hasVitestConfig) {
    throw new Error(
      "Generated production canary has tests but no Vitest configuration, so test execution cannot be certified",
    );
  }

  const combinedTests = testPaths.map((path) => files[path]).join("\n");
  if (
    !combinedTests.includes("Increment Canary Counter") &&
    !/counter/i.test(combinedTests)
  ) {
    throw new Error(
      "Generated tests do not exercise or reference the requested counter behavior",
    );
  }

  return { testPaths, hasVitestConfig };
}

function findChangedPaths(beforeFiles, afterFiles) {
  return [...new Set([...Object.keys(beforeFiles), ...Object.keys(afterFiles)])]
    .filter((path) => beforeFiles[path] !== afterFiles[path])
    .sort();
}

/**
 * Exercise the real production customer path and fail closed unless generated-app
 * validation, blocking tests, deployment, persistence, and authenticated editing succeed.
 */
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
      "Create a small production-ready responsive React web app with the exact visible heading 'AppForge Production Canary', one interactive counter button labelled exactly 'Increment Canary Counter', a visible numeric count that increments when the button is used, and no external API dependencies. Include at least one real Vitest test that verifies the counter starts at zero and increments after clicking the button. This is a real AppForge production build-test-deploy canary.",
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

  if (done.validationPassed !== true) {
    throw new Error(
      `Production canary reached done without a passing generated-app validation gate: ${JSON.stringify(done)}`,
    );
  }
  if (done.testGateRequired !== true || !(done.generatedTestFileCount > 0)) {
    throw new Error(
      `Production canary did not prove a blocking generated test gate: ${JSON.stringify(done)}`,
    );
  }

  if (
    done.productionCertified !== true ||
    done.isolatedProductionBuildVerified !== true ||
    done.liveDeploymentVerified !== true
  ) {
    throw new Error(
      `Production canary did not prove isolated production build + live verification: ${JSON.stringify(done)}`,
    );
  }

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

  console.log("[canary] certifying persisted generated test contract");
  const generatedTests = verifyGeneratedTestContract(project.generatedFiles);

  console.log(`[canary] opening real generated product ${done.liveUrl}`);
  const live = await verifyDeployedProduct(done.liveUrl, {
    requiredTexts: ["AppForge Production Canary", "Increment Canary Counter"],
  });

  console.log("[canary] capturing generated files before authenticated edit");
  const beforeFiles = await trpc.query("projects.getFiles", { id: projectId });
  if (!beforeFiles || Object.keys(beforeFiles).length === 0) {
    throw new Error("Unable to read generated files before edit");
  }

  console.log("[canary] applying a real authenticated quick edit");
  const edit = await trpc.mutation("projectChat.send", {
    projectId,
    content:
      "Change the main visible heading to exactly 'AppForge Production Canary Updated' and add a short visible sentence saying 'Authenticated edit verified'. Keep the app functional and preserve the counter.",
    triggerSeniorDev: false,
  });
  if (!edit?.ok) {
    throw new Error(`Authenticated edit did not succeed: ${JSON.stringify(edit)}`);
  }

  const afterFiles = await trpc.query("projects.getFiles", { id: projectId });
  const changedPaths = findChangedPaths(beforeFiles, afterFiles || {});
  if (changedPaths.length === 0) {
    throw new Error("Authenticated edit returned success but persisted no file changes");
  }

  console.log(
    `[canary] authenticated edit persisted changes in ${changedPaths.length} file(s); redeploying preview`,
  );
  const redeploy = await trpc.mutation("projects.deploy", {
    id: projectId,
    destination: "preview",
  });
  if (!redeploy?.deployUrl || !/^https:\/\//i.test(redeploy.deployUrl)) {
    throw new Error(
      `Authenticated redeploy returned no HTTPS deployUrl: ${JSON.stringify(redeploy)}`,
    );
  }

  const redeployedLive = await verifyDeployedProduct(redeploy.deployUrl, {
    requiredTexts: [
      "AppForge Production Canary Updated",
      "Authenticated edit verified",
      "Increment Canary Counter",
    ],
  });
  const persistedAfterRedeploy = await trpc.query("projects.getFiles", {
    id: projectId,
  });
  for (const path of changedPaths) {
    if (persistedAfterRedeploy?.[path] !== afterFiles?.[path]) {
      throw new Error(
        `Edited file changed or disappeared during redeploy: ${path}`,
      );
    }
  }

  const certification = {
    ok: true,
    baseUrl,
    projectId,
    liveUrl: done.liveUrl,
    redeployUrl: redeploy.deployUrl,
    projectStatus: project.status,
    generatedFileCount: Object.keys(project.generatedFiles).length,
    generatedTestCount: generatedTests.testPaths.length,
    generatedTestPaths: generatedTests.testPaths,
    generatedTestsVerified: true,
    changedFileCount: changedPaths.length,
    changedPaths,
    liveHttpStatus: live.status,
    checkedAssets: live.checkedAssets,
    initialCustomerVisibleContentVerified: live.verifiedTexts,
    redeployHttpStatus: redeployedLive.status,
    redeployCheckedAssets: redeployedLive.checkedAssets,
    editedCustomerVisibleContentVerified: redeployedLive.verifiedTexts,
    sessionRefreshVerified: true,
    entitlementVerified: true,
    godCodeOtpVerified,
    automaticBuildStartVerified: true,
    agentBuildCompletionVerified: true,
    generatedValidationVerified: true,
    blockingGeneratedTestsVerified: true,
    generatedTestFileCount: done.generatedTestFileCount,
    requirementLinkedTestsVerified: true,
    isolatedProductionBuildVerified: done.isolatedProductionBuildVerified === true,
    liveDeploymentVerified: done.liveDeploymentVerified === true,
    productionCertified: done.productionCertified === true,
    productionDeploymentVerified: true,
    authenticatedEditVerified: true,
    editPersistenceVerified: true,
    authenticatedRedeployVerified: true,
  };

  writeFileSync(
    ".appforge-production-canary-result.json",
    JSON.stringify(certification, null, 2),
    "utf8",
  );
  console.log(JSON.stringify(certification, null, 2));
}

main().catch((error) => {
  console.error(
    "[canary] FAILED",
    error instanceof Error ? error.stack || error.message : error,
  );
  process.exit(1);
});