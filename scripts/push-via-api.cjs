const fs = require("fs");
const { execSync } = require("child_process");

const token = execSync("gh auth token").toString().trim();
const owner = "Anselm04";
const repo = "AppForge.";
const branch = process.argv[2] || "cursor/leader-improvements-5e66";
const message =
  process.argv[3] ||
  "feat: leader improvements — BullMQ, docker validation, deploy wizard, moderation";

async function gh(path, method = "GET", body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok)
    throw new Error(`${method} ${path} ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const files = execSync("git diff --name-only main..HEAD")
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean);
  const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  const baseCommit = await gh(
    `/repos/${owner}/${repo}/git/commits/${ref.object.sha}`,
  );
  const baseTreeSha = baseCommit.tree.sha;

  const tree = [];
  for (const path of files) {
    const content = fs.readFileSync(path);
    const blob = await gh(`/repos/${owner}/${repo}/git/blobs`, "POST", {
      content: content.toString("base64"),
      encoding: "base64",
    });
    tree.push({ path, mode: "100644", type: "blob", sha: blob.sha });
    process.stdout.write(".");
  }

  const newTree = await gh(`/repos/${owner}/${repo}/git/trees`, "POST", {
    base_tree: baseTreeSha,
    tree,
  });

  const newCommit = await gh(`/repos/${owner}/${repo}/git/commits`, "POST", {
    message,
    tree: newTree.sha,
    parents: [ref.object.sha],
  });

  await gh(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, "PATCH", {
    sha: newCommit.sha,
  });

  console.log("\nPushed", files.length, "files. Commit:", newCommit.sha);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
