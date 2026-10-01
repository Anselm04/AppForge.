import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const API_ROOT = "https://api.github.com";
const API_VERSION = "2022-11-28";

function hasMainTarget(ruleset) {
  const include = ruleset.conditions?.ref_name?.include;
  const exclude = ruleset.conditions?.ref_name?.exclude ?? [];
  return (
    Array.isArray(include) &&
    (include.includes("refs/heads/main") ||
      include.includes("~DEFAULT_BRANCH")) &&
    !exclude.includes("refs/heads/main")
  );
}

function hasRequiredChecks(rules) {
  const checkRule = rules.find(
    (rule) => rule.type === "required_status_checks",
  );
  const checks = checkRule?.parameters?.required_status_checks;
  return Array.isArray(checks) && checks.length > 0;
}

function hasPullRequestReviewRule(rules) {
  const pullRequestRule = rules.find((rule) => rule.type === "pull_request");
  return (
    Number(pullRequestRule?.parameters?.required_approving_review_count) >= 1
  );
}

export function isSuitableClassicProtection(protection) {
  const checks = protection.required_status_checks;
  const hasChecks =
    (Array.isArray(checks?.contexts) && checks.contexts.length > 0) ||
    (Array.isArray(checks?.checks) && checks.checks.length > 0);
  return (
    hasChecks &&
    Number(
      protection.required_pull_request_reviews?.required_approving_review_count,
    ) >= 1 &&
    protection.allow_force_pushes?.enabled === false &&
    protection.allow_deletions?.enabled === false
  );
}

export function isSuitableMainRuleset(ruleset) {
  const rules = Array.isArray(ruleset.rules) ? ruleset.rules : [];
  return (
    ruleset.enforcement === "active" &&
    hasMainTarget(ruleset) &&
    hasRequiredChecks(rules) &&
    hasPullRequestReviewRule(rules) &&
    rules.some((rule) => rule.type === "non_fast_forward") &&
    rules.some((rule) => rule.type === "deletion") &&
    (ruleset.bypass_actors ?? []).length === 0
  );
}

async function apiGet(path, token, fetchImpl) {
  const response = await fetchImpl(`${API_ROOT}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer ".concat(token),
      "X-GitHub-Api-Version": API_VERSION,
    },
    signal: AbortSignal.timeout(15_000),
  });
  return response;
}

export async function verifyBranchProtection({
  repository,
  token,
  fetchImpl = fetch,
}) {
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error("GITHUB_REPOSITORY must be in owner/repository format.");
  }
  if (!token) {
    throw new Error(
      "A repository metadata token is required to verify main protection.",
    );
  }

  const encodedRepository = repository
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  const branchResponse = await apiGet(
    `/repos/${encodedRepository}/branches/main/protection`,
    token,
    fetchImpl,
  );
  if (branchResponse.ok) {
    const protection = await branchResponse.json();
    if (isSuitableClassicProtection(protection)) {
      return { method: "classic-branch-protection" };
    }
  }

  const rulesetsResponse = await apiGet(
    `/repos/${encodedRepository}/rulesets?includes_parents=true`,
    token,
    fetchImpl,
  );
  if (!rulesetsResponse.ok) {
    throw new Error(
      `GitHub could not verify main branch protection (branch API HTTP ${branchResponse.status}, rulesets API HTTP ${rulesetsResponse.status}).`,
    );
  }

  const rulesetSummaries = await rulesetsResponse.json();
  if (!Array.isArray(rulesetSummaries)) {
    throw new Error("GitHub returned an unverifiable ruleset response.");
  }
  for (const summary of rulesetSummaries) {
    if (summary.enforcement !== "active" || summary.id === undefined) continue;
    const detailResponse = await apiGet(
      `/repos/${encodedRepository}/rulesets/${encodeURIComponent(summary.id)}`,
      token,
      fetchImpl,
    );
    if (!detailResponse.ok) {
      throw new Error(
        `GitHub could not verify active ruleset details (HTTP ${detailResponse.status}).`,
      );
    }
    if (isSuitableMainRuleset(await detailResponse.json())) {
      return { method: "repository-ruleset" };
    }
  }
  throw new Error(
    "main has no verifiable active branch protection or suitable ruleset.",
  );
}

async function main() {
  const result = await verifyBranchProtection({
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GH_TOKEN,
  });
  console.log(`Verified main protection using ${result.method}.`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(
      "[branch-protection] FAILED",
      error instanceof Error ? error.message : "verification failed",
    );
    process.exitCode = 1;
  });
}
