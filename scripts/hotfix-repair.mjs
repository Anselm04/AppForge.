import fs from "node:fs";

const projectsPath = "src/routers/projects.ts";
let projects = fs.readFileSync(projectsPath, "utf8");
const importAnchor = 'import { PROMPT_MAX_CHARS } from "../lib/prompt.js";\n';
const ownerImport = 'import { isOwnerEmail } from "../lib/owner.js";\n';
if (!projects.includes(ownerImport)) {
  if (!projects.includes(importAnchor)) throw new Error("projects import anchor missing");
  projects = projects.replace(importAnchor, importAnchor + ownerImport);
}

const oldGuard = `      const { verifyHcaptchaToken } = await import("../lib/hcaptcha.js");
      const captchaOk = await verifyHcaptchaToken(input.hcaptchaToken);
      if (!captchaOk) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Captcha verification failed. Complete the challenge and try again.",
        });
      }

      // ── Content moderation ──
      const { moderateUserContent } = await import("./moderation.js");
      const moderation = await moderateUserContent(
        ctx.user.id,
        input.description + " " + input.title,
      );
      if (!moderation.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: moderation.reason ?? "Content flagged",
        });
      }

      // Backend tier/credit enforcement. The configured owner is provisioned
      // as unlimited by ensureUserCredits, so maker testing is never blocked
      // by customer billing limits.
      const credits = await ensureUserCredits(ctx.user.id);
      const unlimited = !!credits.unlimited || credits.tier === "lifetime";
`;

const newGuard = `      // Owner identity is server-authoritative. Customer anti-abuse gates must
      // never block the authenticated owner build path.
      const owner = isOwnerEmail(ctx.user.email);
      if (!owner) {
        const { verifyHcaptchaToken } = await import("../lib/hcaptcha.js");
        const captchaOk = await verifyHcaptchaToken(input.hcaptchaToken);
        if (!captchaOk) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Captcha verification failed. Complete the challenge and try again.",
          });
        }

        // ── Content moderation ──
        const { moderateUserContent } = await import("./moderation.js");
        const moderation = await moderateUserContent(
          ctx.user.id,
          input.description + " " + input.title,
        );
        if (!moderation.allowed) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: moderation.reason ?? "Content flagged",
          });
        }
      }

      // Customer unlimited/lifetime entitlements remain supported; owner is
      // independently authoritative and is never charged build credits.
      const credits = await ensureUserCredits(ctx.user.id);
      const unlimited =
        owner || !!credits.unlimited || credits.tier === "lifetime";
`;

if (projects.includes(oldGuard)) {
  projects = projects.replace(oldGuard, newGuard);
} else if (!projects.includes("const owner = isOwnerEmail(ctx.user.email);")) {
  throw new Error("projects captcha block missing");
}
fs.writeFileSync(projectsPath, projects);

const homePath = "src/pages/Home.tsx";
let home = fs.readFileSync(homePath, "utf8");
const oldWidget = "            <HcaptchaWidget onToken={setHcaptchaToken} />";
const newWidget = `            {!ownerUnlimited && (
              <HcaptchaWidget onToken={setHcaptchaToken} />
            )}`;
if (home.includes(oldWidget)) {
  home = home.replace(oldWidget, newWidget);
} else if (!home.includes("{!ownerUnlimited && (")) {
  throw new Error("Home captcha widget missing");
}
fs.writeFileSync(homePath, home);
