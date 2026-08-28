/** Push many files to a GitHub repo in a single commit via the Git Trees API. */

export async function pushFilesToGitHubRepo(opts: {
  token: string;
  owner: string;
  repoName: string;
  files: Record<string, string>;
  description?: string;
  createRepo?: boolean;
}): Promise<{ fullName: string; repoUrl: string }> {
  const {
    token,
    owner,
    repoName,
    files,
    description,
    createRepo = true,
  } = opts;
  const fullName = `${owner}/${repoName}`;

  if (createRepo) {
    const createRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
        "User-Agent": "AppForge",
      },
      body: JSON.stringify({
        name: repoName,
        description: (description ?? "").slice(0, 200),
        private: false,
        auto_init: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!createRes.ok && createRes.status !== 422) {
      throw new Error(`GitHub repo creation failed: ${await createRes.text()}`);
    }
  }

  const blobs: { path: string; mode: "100644"; type: "blob"; sha: string }[] =
    [];
  for (const [path, content] of Object.entries(files)) {
    const blobRes = await fetch(
      `https://api.github.com/repos/${fullName}/git/blobs`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "AppForge",
        },
        body: JSON.stringify({ content, encoding: "utf-8" }),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!blobRes.ok) {
      throw new Error(
        `GitHub blob failed for ${path}: ${await blobRes.text()}`,
      );
    }
    const blob = (await blobRes.json()) as { sha: string };
    blobs.push({ path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const treeRes = await fetch(
    `https://api.github.com/repos/${fullName}/git/trees`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "AppForge",
      },
      body: JSON.stringify({ tree: blobs }),
      signal: AbortSignal.timeout(120000),
    },
  );
  if (!treeRes.ok) {
    throw new Error(`GitHub tree failed: ${await treeRes.text()}`);
  }
  const tree = (await treeRes.json()) as { sha: string };

  const commitRes = await fetch(
    `https://api.github.com/repos/${fullName}/git/commits`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "AppForge",
      },
      body: JSON.stringify({
        message: "feat: initial commit via AppForge",
        tree: tree.sha,
      }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!commitRes.ok) {
    throw new Error(`GitHub commit failed: ${await commitRes.text()}`);
  }
  const commit = (await commitRes.json()) as { sha: string };

  const refRes = await fetch(
    `https://api.github.com/repos/${fullName}/git/refs`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "AppForge",
      },
      body: JSON.stringify({ ref: "refs/heads/main", sha: commit.sha }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!refRes.ok && refRes.status !== 422) {
    throw new Error(`GitHub ref update failed: ${await refRes.text()}`);
  }
  if (refRes.status === 422) {
    await fetch(
      `https://api.github.com/repos/${fullName}/git/refs/heads/main`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "AppForge",
        },
        body: JSON.stringify({ sha: commit.sha, force: true }),
        signal: AbortSignal.timeout(30000),
      },
    );
  }

  return {
    fullName,
    repoUrl: `https://github.com/${fullName}`,
  };
}
