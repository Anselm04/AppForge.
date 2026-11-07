import { beforeEach, describe, expect, it, vi } from "vitest";

const email = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("../services/twilioEmail.js", () => ({
  sendTwilioEmail: email.send,
}));
vi.mock("../_core/logger.js", () => ({
  logger: { error: vi.fn() },
}));
import {
  notifyBuildComplete,
  notifyAccountBanned,
} from "../services/email.js";

describe("real customer email notification content", () => {
  beforeEach(() => {
    email.send.mockReset().mockResolvedValue(undefined);
  });

  it("escapes generated project titles and never includes a script URL", async () => {
    await notifyBuildComplete(
      "customer@example.test",
      "<img src=x onerror=alert(1)>",
      "javascript:alert(1)",
    );
    const sent = email.send.mock.calls[0][0];
    expect(sent.html).toContain("&lt;img");
    expect(sent.html).not.toContain("<img");
    expect(sent.html).not.toContain("javascript:");
    expect(sent.html).not.toContain("href=\"javascript:");
  });

  it("only links to a verified HTTPS deployment", async () => {
    await notifyBuildComplete("customer@example.test", "Real product", "https://example.test/product");
    const sent = email.send.mock.calls[0][0];
    expect(sent.html).toContain('href="https://example.test/product"');
  });

  it("treats admin suspension reasons as text rather than HTML", async () => {
    await notifyAccountBanned("customer@example.test", "<script>bad</script>");
    const sent = email.send.mock.calls[0][0];
    expect(sent.html).toContain("&lt;script&gt;");
    expect(sent.html).not.toContain("<script>");
  });
});
