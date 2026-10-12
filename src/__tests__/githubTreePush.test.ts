import { beforeEach, describe, expect, it, vi } from "vitest";
import { pushFilesToGitHubRepo } from "../services/githubTreePush.js";
const calls: { url: string; method: string; body: Record<string, unknown> }[] =
  [];
let privateRepo = true;
let existing = false;
let conflict = false;
let empty = false;
let seeded = false;
const input = {
  token: "test-owner-token",
  owner: "owner",
  repoName: "product",
  files: { "src/app.ts": "export const product = true" },
};
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
beforeEach(() => {
  calls.length = 0;
  privateRepo = true;
  existing = false;
  conflict = false;
  empty = false;
  seeded = false;
  vi.spyOn(globalThis, "fetch")
    .mockReset()
    .mockImplementation(async (url, options) => {
      const address = String(url);
      const method = options?.method ?? "GET";
      const body = options?.body ? JSON.parse(String(options.body)) : {};
      calls.push({ url: address, method, body });
      if (address.endsWith("/user/repos"))
        return reply({ default_branch: "trunk" }, existing ? 422 : 201);
      if (address.endsWith("/repos/owner/product"))
        return reply({
          full_name: "owner/product",
          default_branch: "trunk",
          private: privateRepo,
        });
      if (address.includes("/git/ref/heads/"))
        return empty && !seeded
          ? reply({}, 404)
          : reply({ object: { sha: "old-head" } });
      if (method === "PUT" && address.includes("/contents/")) {
        seeded = true;
        return reply({ commit: { sha: "old-head" } }, 201);
      }
      if (address.endsWith("/git/commits/old-head"))
        return reply({ tree: { sha: "old-tree" } });
      if (address.endsWith("/git/blobs")) return reply({ sha: "blob" });
      if (address.endsWith("/git/trees")) return reply({ sha: "new-tree" });
      if (address.endsWith("/git/commits")) return reply({ sha: "new-head" });
      if (address.includes("/git/refs"))
        return reply({ message: "branch advanced" }, conflict ? 422 : 200);
      throw Error("Unexpected export request: " + address);
    });
});
describe("customer-controlled GitHub export", () => {
  it("initializes a private repository and preserves its default-branch history", async () => {
    await pushFilesToGitHubRepo(input);
    expect(
      calls.find((c) => c.url.endsWith("/user/repos"))?.body,
    ).toMatchObject({ private: true, auto_init: true });
    expect(calls.find((c) => c.url.endsWith("/git/trees"))?.body).toMatchObject(
      { base_tree: "old-tree" },
    );
    expect(
      calls.find((c) => c.url.endsWith("/git/commits"))?.body,
    ).toMatchObject({ parents: ["old-head"] });
    const update = calls.find((c) => c.method === "PATCH");
    expect(update?.url).toContain("/git/refs/heads/trunk");
    expect(update?.body).toMatchObject({ force: false, sha: "new-head" });
  });
  it("keeps existing repositories private and preserves unrelated files/history", async () => {
    existing = true;
    await pushFilesToGitHubRepo(input);
    expect(
      calls.find((c) => c.url.endsWith("/git/trees"))?.body.base_tree,
    ).toBe("old-tree");
    expect(calls.some((c) => c.body.force === true)).toBe(false);
  });
  it("rejects a concurrent branch update without forcing or reporting success", async () => {
    conflict = true;
    await expect(pushFilesToGitHubRepo(input)).rejects.toThrow(
      /branch|update/i,
    );
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1);
    expect(calls.some((c) => c.body.force === true)).toBe(false);
  });
  it("does not upload files to a public repository when private export was selected", async () => {
    existing = true;
    privateRepo = false;
    await expect(pushFilesToGitHubRepo(input)).rejects.toThrow(
      /visibility|private/i,
    );
    expect(calls.some((c) => c.url.endsWith("/git/blobs"))).toBe(false);
  });
  it("uses explicitly selected public visibility without changing existing visibility", async () => {
    privateRepo = false;
    await pushFilesToGitHubRepo({ ...input, private: false });
    expect(calls.find((c) => c.url.endsWith("/user/repos"))?.body.private).toBe(
      false,
    );
    expect(
      calls
        .filter((c) => c.method === "PATCH")
        .every((c) => c.url.includes("/git/refs/")),
    ).toBe(true);
  });
  it("initializes an empty repository before Git tree export", async () => {
    existing = true;
    empty = true;
    await pushFilesToGitHubRepo(input);
    const seed = calls.find((c) => c.method === "PUT");
    expect(seed?.url).toContain("/contents/src/app.ts");
    expect(seed?.body.content).toBe(
      Buffer.from(input.files["src/app.ts"]).toString("base64"),
    );
    expect(calls.find((c) => c.method === "PATCH")?.body.force).toBe(false);
  });
  it("rejects repository path injection before contacting GitHub", async () => {
    await expect(
      pushFilesToGitHubRepo({ ...input, repoName: "../other" }),
    ).rejects.toThrow("Invalid GitHub repository destination");
    expect(calls).toHaveLength(0);
  });
});
