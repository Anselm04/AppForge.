import fs from "node:fs";

const path = "docs/RECOVERY_INVENTORY.md";
let text = fs.readFileSync(path, "utf8");
const heading = "## 2026-10-08 authenticated build-entry hotfix";
if (!text.includes(heading)) {
  text += `\n\n${heading}\n- Signed-out visitors are blocked from the build entry routes and redirected to sign-in before the build UI mounts.\n- The server-authoritative owner identity bypasses customer CAPTCHA/moderation/credit gates only for the owner; customer gates remain fail-closed.\n- Recovery validation must confirm a restored release preserves both boundaries: unauthenticated build entry remains closed and the verified owner can start a build without a customer CAPTCHA token.\n`;
  fs.writeFileSync(path, text);
}
