import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { deployToCustomerVercel } from "../services/customerVercelDeploy.js";

const deployment = {
  id: "dpl_ABC123",
  url: "customer-app-123.vercel.app",
};

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("customer-authorized Vercel deployment", () => {
  it("uploads source bytes with SHA1, creates production deployment and waits for READY", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response(deployment))
      .mockResolvedValueOnce(response({ readyState: "READY" }));
      const task = deployToCustomerVercel(
        {
          token: "customer-test-token",
          projectName: "customer-app",
          files: { "index.html": "<h1>Real app</h1>" },
        },
        fetcher,
      );
      const result = await task;
      expect(result).toEqual({
        url: "https://customer-app-123.vercel.app",
        deploymentId: "dpl_ABC123",
      });
      const [uploadUrl, uploadOptions] = fetcher.mock.calls[0];
      expect(uploadUrl).toBe("https://api.vercel.com/v2/files");
      const sha = createHash("sha1")
        .update("<h1>Real app</h1>")
        .digest("hex");
      expect(new Headers(uploadOptions?.headers).get("x-vercel-digest")).toBe(
        sha,
      );
      const [deployUrl, deployOptions] = fetcher.mock.calls[1];
      expect(deployUrl).toBe("https://api.vercel.com/v13/deployments");
      const body = JSON.parse(String(deployOptions?.body)) as {
        target: string;
        files: Array<{ sha: string }>;
      };
      expect(body.target).toBe("production");
      expect(body.files[0]?.sha).toBe(sha);
      expect(JSON.stringify(body)).not.toContain("customer-test-token");
  });

  it("rejects missing customer authorization before any provider call", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      deployToCustomerVercel(
        { token: "", projectName: "test-app", files: { "index.html": "ok" } },
        fetcher,
      ),
    ).rejects.toThrow("Customer Vercel credential is required");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects path traversal before sending any source to Vercel", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      deployToCustomerVercel(
        {
          token: "customer-token",
          projectName: "test-app",
          files: { "../secrets.txt": "secret" },
        },
        fetcher,
      ),
    ).rejects.toThrow("Invalid Vercel deployment source");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not mark provider acceptance or build errors as a completed deployment", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response(deployment))
      .mockResolvedValueOnce(response({ readyState: "ERROR" }));
    await expect(
      deployToCustomerVercel(
        {
          token: "customer-token",
          projectName: "test-app",
          files: { "index.html": "ok" },
        },
        fetcher,
      ),
    ).rejects.toThrow("Vercel deployment failed to build");
  });

  it("does not expose provider error bodies that may contain customer data", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      response({ error: "sensitive data from provider" }, 403),
    );
    await expect(
      deployToCustomerVercel(
        {
          token: "customer-token",
          projectName: "test-app",
          files: { "index.html": "ok" },
        },
        fetcher,
      ),
    ).rejects.toThrow("Vercel file upload failed (HTTP 403)");
  });
});
