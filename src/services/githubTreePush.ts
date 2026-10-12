/** Export source using the customer's GitHub connection, preserving repository history. */
export async function pushFilesToGitHubRepo(opts: {
  token: string;
  owner: string;
  repoName: string;
  files: Record<string, string>;
  description?: string;
  createRepo?: boolean;
  private?: boolean;
}): Promise<{ fullName: string; repoUrl: string }> {
  const {
    token,
    owner,
    repoName,
    files,
    description,
    createRepo = true,
    private: privateRepo = true,
  } = opts;
  if (
    !/^[a-zA-Z0-9-]+$/.test(owner) ||
    !/^[a-zA-Z0-9._-]{1,100}$/.test(repoName) ||
    repoName === "." ||
    repoName === ".."
  ) {
    throw new Error("Invalid GitHub repository destination");
  }
  if (Object.keys(files).length === 0)
    throw new Error("No source files to export");
  const fullName = `${owner}/${repoName}`;
  const root = `https://api.github.com/repos/${owner}/${repoName}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "AppForge",
  };
  const request = (url: string, method = "GET", body?: unknown) =>
    fetch(url, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
  const required = async <T = unknown>(
    response: Response,
    step: string,
  ): Promise<T> => {
    if (!response.ok)
      throw new Error(
        `GitHub ${step} failed: ${response.status} ${await response.text()}`,
      );
    return (await response.json()) as T;
  };
  if (createRepo) {
    const response = await request(
      "https://api.github.com/user/repos",
      "POST",
      {
        name: repoName,
        description: (description ?? "").slice(0, 200),
        private: privateRepo,
        // Git references cannot initialize an empty GitHub repository.
        auto_init: true,
      },
    );
    if (!response.ok && response.status !== 422)
      await required(response, "repo creation");
  }
  const repository = await required<{
    full_name: string;
    default_branch?: string;
    private: boolean;
  }>(await request(root), "repository lookup");
  if (String(repository.full_name).toLowerCase() !== fullName.toLowerCase())
    throw new Error("GitHub repository ownership mismatch");
  if (repository.private !== privateRepo)
    throw new Error(
      "Repository visibility does not match your export choice. Choose a matching private/public repository; AppForge will not change its visibility or upload files.",
    );
  const branch =
    typeof repository.default_branch === "string"
      ? repository.default_branch
      : "main";
  const refUrl = `${root}/git/ref/heads/${encodeURIComponent(branch)}`;
  let headResponse = await request(refUrl);
  if (headResponse.status === 404) {
    // An existing empty repository needs a first real commit before Git trees/refs.
    const [path, content] = Object.entries(files)[0];
    await required(
      await request(
        `${root}/contents/${path.split("/").map(encodeURIComponent).join("/")}`,
        "PUT",
        {
          message: "Initialize customer-selected AppForge export",
          content: Buffer.from(content).toString("base64"),
        },
      ),
      "repository initialization",
    );
    headResponse = await request(refUrl);
  }
  const head = await required<{ object?: { sha?: string } }>(
    headResponse,
    "branch lookup",
  );
  const parent = head.object?.sha;
  if (typeof parent !== "string")
    throw new Error("GitHub branch has no commit identity");
  const previous = await required<{ tree?: { sha?: string } }>(
    await request(`${root}/git/commits/${parent}`),
    "parent commit lookup",
  );
  if (typeof previous.tree?.sha !== "string")
    throw new Error("GitHub parent has no tree identity");
  const treeEntries = [];
  for (const [path, content] of Object.entries(files)) {
    const blob = await required<{ sha: string }>(
      await request(`${root}/git/blobs`, "POST", {
        content,
        encoding: "utf-8",
      }),
      `blob for ${path}`,
    );
    treeEntries.push({ path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const tree = await required<{ sha: string }>(
    await request(`${root}/git/trees`, "POST", {
      base_tree: previous.tree.sha,
      tree: treeEntries,
    }),
    "tree creation",
  );
  const commit = await required<{ sha: string }>(
    await request(`${root}/git/commits`, "POST", {
      message: "Export customer-selected AppForge product",
      tree: tree.sha,
      parents: [parent],
    }),
    "commit creation",
  );
  // A concurrent update is rejected rather than overwriting another person's work.
  await required(
    await request(
      `${root}/git/refs/heads/${encodeURIComponent(branch)}`,
      "PATCH",
      {
        sha: commit.sha,
        force: false,
      },
    ),
    "branch update",
  );
  return { fullName, repoUrl: `https://github.com/${fullName}` };
}
