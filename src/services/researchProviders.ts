/**
 * Keyless structured research providers: official package registries (npm,
 * PyPI, crates.io, pub.dev), the OSV vulnerability database, GitHub
 * repositories/search, and curated official documentation pages.
 *
 * Only tokens that pass strict validators (versions, SPDX identifiers,
 * advisory IDs, repository names, dates) are returned as facts. Free text from
 * providers is kept as sanitized data and is never used to build decisions.
 */

import type { OfficialDocTarget, PackageTarget } from "../lib/researchTargets.js";
import { researchFetch, type ResearchFetchOutcome } from "./researchHttp.js";

export type StructuredProvider = "npm" | "pypi" | "crates" | "pub" | "osv" | "github" | "official_docs";

export type StructuredAttempt = {
  provider: StructuredProvider;
  target: string;
  ok: boolean;
  detail: string;
};

export type PackageFact = {
  ecosystem: PackageTarget["ecosystem"];
  name: string;
  latestVersion: string;
  license: string | null;
  repositoryUrl: string | null;
  publishedAt: string | null;
  registryUrl: string;
};

export type VulnerabilityFact = {
  ecosystem: PackageTarget["ecosystem"];
  name: string;
  version: string;
  advisoryIds: string[];
  summaries: string[];
  queryUrl: string;
};

export type RepositoryFact = {
  fullName: string;
  url: string;
  license: string | null;
  stars: number;
  pushedAt: string | null;
  archived: boolean;
  latestRelease: string | null;
  description: string;
};

export type OfficialDocFact = OfficialDocTarget & {
  status: "verified" | "blocked" | "not_found" | "unreachable";
  httpStatus: number | null;
  title: string;
};

const VERSION = /^v?\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]{1,30})?$/;
const SPDX = /^[A-Za-z0-9.+-]{1,40}(?: (?:OR|AND|WITH) [A-Za-z0-9.+-]{1,40}){0,3}$/;
const ADVISORY = /^(?:GHSA(?:-[a-z0-9]{4}){3}|CVE-\d{4}-\d{4,7}|PYSEC-\d{4}-\d{1,6}|RUSTSEC-\d{4}-\d{4}|GO-\d{4}-\d{4,6}|[A-Z]{2,12}-\d{4}-[A-Za-z0-9-]{2,20})$/;
const REPO = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;

export function safeVersion(value: unknown): string | null {
  return typeof value === "string" && VERSION.test(value.trim()) ? value.trim().replace(/^v/, "") : null;
}

export function safeSpdx(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
  return SPDX.test(cleaned) ? cleaned : null;
}

export function safeAdvisoryId(value: unknown): string | null {
  return typeof value === "string" && ADVISORY.test(value.trim()) ? value.trim() : null;
}

export function safeRepoName(value: unknown): string | null {
  return typeof value === "string" && REPO.test(value.trim()) ? value.trim() : null;
}

export function safeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null;
}

export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/^git\+/, "").replace(/\.git$/, "");
  try {
    const url = new URL(cleaned.replace(/^git:\/\//, "https://"));
    if (url.protocol !== "https:") return null;
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return null;
  }
}

function sanitizeText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  let out = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    out += code >= 32 && code !== 127 ? char : " ";
  }
  return out.replace(/\s+/g, " ").trim().slice(0, max);
}

const PYPI_LICENSE_CLASSIFIERS: Record<string, string> = {
  "MIT License": "MIT",
  "BSD License": "BSD-3-Clause",
  "Apache Software License": "Apache-2.0",
  "GNU General Public License v3 (GPLv3)": "GPL-3.0",
  "GNU Affero General Public License v3": "AGPL-3.0",
  "GNU Lesser General Public License v3 (LGPLv3)": "LGPL-3.0",
  "Mozilla Public License 2.0 (MPL 2.0)": "MPL-2.0",
  "ISC License (ISCL)": "ISC",
};

function registryUrl(target: PackageTarget): string {
  switch (target.ecosystem) {
    case "npm":
      return `https://www.npmjs.com/package/${target.name}`;
    case "PyPI":
      return `https://pypi.org/project/${target.name}/`;
    case "crates.io":
      return `https://crates.io/crates/${target.name}`;
    case "Pub":
      return `https://pub.dev/packages/${target.name}`;
  }
}

function providerFor(target: PackageTarget): StructuredProvider {
  return target.ecosystem === "npm"
    ? "npm"
    : target.ecosystem === "PyPI"
      ? "pypi"
      : target.ecosystem === "crates.io"
        ? "crates"
        : "pub";
}

function attempt<T>(
  provider: StructuredProvider,
  target: string,
  outcome: ResearchFetchOutcome<T>,
  okDetail = "ok",
): StructuredAttempt {
  return {
    provider,
    target,
    ok: outcome.ok,
    detail: outcome.ok ? okDetail : outcome.detail,
  };
}

/** Latest stable version and license from the package's official registry. */
export async function lookupPackage(
  target: PackageTarget,
  signal?: AbortSignal,
): Promise<{ fact: PackageFact | null; attempt: StructuredAttempt }> {
  const provider = providerFor(target);
  const label = `${target.ecosystem}:${target.name}`;
  if (target.ecosystem === "npm") {
    const res = await researchFetch<{ version?: string; license?: unknown; repository?: unknown }>(
      `https://registry.npmjs.org/${target.name.replace("/", "%2f")}/latest`,
      { signal },
    );
    if (!res.ok) return { fact: null, attempt: attempt(provider, label, res) };
    const version = safeVersion(res.data.version);
    if (!version) return { fact: null, attempt: { provider, target: label, ok: false, detail: "invalid_version_in_response" } };
    const repo = res.data.repository;
    const license =
      typeof res.data.license === "string"
        ? res.data.license
        : (res.data.license as { type?: string } | undefined)?.type;
    return {
      fact: {
        ecosystem: "npm",
        name: target.name,
        latestVersion: version,
        license: safeSpdx(license),
        repositoryUrl: safeHttpsUrl(typeof repo === "string" ? repo : (repo as { url?: string } | undefined)?.url),
        publishedAt: null,
        registryUrl: registryUrl(target),
      },
      attempt: attempt(provider, label, res, `latest ${version}`),
    };
  }
  if (target.ecosystem === "PyPI") {
    const res = await researchFetch<{
      info?: { version?: string; license?: string; license_expression?: string; classifiers?: string[]; project_urls?: Record<string, string> };
      urls?: { upload_time_iso_8601?: string }[];
    }>(`https://pypi.org/pypi/${encodeURIComponent(target.name)}/json`, { signal });
    if (!res.ok) return { fact: null, attempt: attempt(provider, label, res) };
    const info = res.data.info ?? {};
    const version = safeVersion(info.version);
    if (!version) return { fact: null, attempt: { provider, target: label, ok: false, detail: "invalid_version_in_response" } };
    const classifier = (info.classifiers ?? [])
      .map((c) => c.split(" :: ").pop() ?? "")
      .map((name) => PYPI_LICENSE_CLASSIFIERS[name])
      .find(Boolean);
    return {
      fact: {
        ecosystem: "PyPI",
        name: target.name,
        latestVersion: version,
        license: safeSpdx(info.license_expression) ?? classifier ?? safeSpdx(info.license),
        repositoryUrl: safeHttpsUrl(info.project_urls?.Source ?? info.project_urls?.Repository),
        publishedAt: safeDate(res.data.urls?.[0]?.upload_time_iso_8601),
        registryUrl: registryUrl(target),
      },
      attempt: attempt(provider, label, res, `latest ${version}`),
    };
  }
  if (target.ecosystem === "crates.io") {
    const res = await researchFetch<{
      crate?: { max_stable_version?: string; repository?: string; updated_at?: string };
      versions?: { num?: string; license?: string; created_at?: string }[];
    }>(`https://crates.io/api/v1/crates/${encodeURIComponent(target.name)}`, { signal });
    if (!res.ok) return { fact: null, attempt: attempt(provider, label, res) };
    const version = safeVersion(res.data.crate?.max_stable_version);
    if (!version) return { fact: null, attempt: { provider, target: label, ok: false, detail: "invalid_version_in_response" } };
    const release = res.data.versions?.find((v) => v.num === version);
    return {
      fact: {
        ecosystem: "crates.io",
        name: target.name,
        latestVersion: version,
        license: safeSpdx(release?.license?.replace(/\//g, " OR ")),
        repositoryUrl: safeHttpsUrl(res.data.crate?.repository),
        publishedAt: safeDate(release?.created_at),
        registryUrl: registryUrl(target),
      },
      attempt: attempt(provider, label, res, `latest ${version}`),
    };
  }
  const res = await researchFetch<{ latest?: { version?: string; published?: string; pubspec?: { repository?: string; homepage?: string } } }>(
    `https://pub.dev/api/packages/${encodeURIComponent(target.name)}`,
    { signal },
  );
  if (!res.ok) return { fact: null, attempt: attempt(provider, label, res) };
  const version = safeVersion(res.data.latest?.version);
  if (!version) return { fact: null, attempt: { provider, target: label, ok: false, detail: "invalid_version_in_response" } };
  return {
    fact: {
      ecosystem: "Pub",
      name: target.name,
      latestVersion: version,
      license: null,
      repositoryUrl: safeHttpsUrl(res.data.latest?.pubspec?.repository ?? res.data.latest?.pubspec?.homepage),
      publishedAt: safeDate(res.data.latest?.published),
      registryUrl: registryUrl(target),
    },
    attempt: attempt(provider, label, res, `latest ${version}`),
  };
}

/** Known advisories for an exact package version from OSV.dev. */
export async function lookupVulnerabilities(
  target: PackageTarget,
  version: string,
  signal?: AbortSignal,
): Promise<{ fact: VulnerabilityFact | null; attempt: StructuredAttempt }> {
  const label = `${target.ecosystem}:${target.name}@${version}`;
  const res = await researchFetch<{ vulns?: { id?: string; summary?: string; aliases?: string[] }[] }>(
    "https://api.osv.dev/v1/query",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package: { name: target.name, ecosystem: target.ecosystem }, version }),
      signal,
    },
  );
  if (!res.ok) return { fact: null, attempt: attempt("osv", label, res) };
  const vulns = res.data.vulns ?? [];
  const advisoryIds = [...new Set(vulns.map((v) => safeAdvisoryId(v.id)).filter((id): id is string => Boolean(id)))];
  return {
    fact: {
      ecosystem: target.ecosystem,
      name: target.name,
      version,
      advisoryIds,
      summaries: vulns.slice(0, 8).map((v) => sanitizeText(v.summary, 200)).filter(Boolean),
      queryUrl: `https://osv.dev/list?ecosystem=${encodeURIComponent(target.ecosystem)}&q=${encodeURIComponent(target.name)}`,
    },
    attempt: attempt("osv", label, res, `${advisoryIds.length} advisory(ies)`),
  };
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_RESEARCH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

type GithubRepo = {
  full_name?: string;
  html_url?: string;
  license?: { spdx_id?: string } | null;
  stargazers_count?: number;
  pushed_at?: string;
  archived?: boolean;
  description?: string | null;
};

function repoFact(repo: GithubRepo, latestRelease: string | null): RepositoryFact | null {
  const fullName = safeRepoName(repo.full_name);
  if (!fullName) return null;
  const spdx = safeSpdx(repo.license?.spdx_id);
  return {
    fullName,
    url: `https://github.com/${fullName}`,
    license: spdx && spdx !== "NOASSERTION" ? spdx : null,
    stars: Number.isFinite(repo.stargazers_count) ? Number(repo.stargazers_count) : 0,
    pushedAt: safeDate(repo.pushed_at),
    archived: repo.archived === true,
    latestRelease,
    description: sanitizeText(repo.description, 200),
  };
}

/** Canonical repository health, license and latest release from GitHub. */
export async function lookupRepository(
  fullName: string,
  signal?: AbortSignal,
): Promise<{ fact: RepositoryFact | null; attempts: StructuredAttempt[] }> {
  const safe = safeRepoName(fullName);
  if (!safe) return { fact: null, attempts: [{ provider: "github", target: fullName, ok: false, detail: "invalid_repository_name" }] };
  const res = await researchFetch<GithubRepo>(`https://api.github.com/repos/${safe}`, { headers: githubHeaders(), signal });
  if (!res.ok) return { fact: null, attempts: [attempt("github", safe, res)] };
  const release = await researchFetch<{ tag_name?: string }>(`https://api.github.com/repos/${safe}/releases/latest`, {
    headers: githubHeaders(),
    signal,
  });
  const tag = release.ok ? safeVersion(String(release.data.tag_name ?? "").replace(/^[A-Za-z@/.-]*?(?=v?\d)/, "")) : null;
  return {
    fact: repoFact(res.data, tag),
    attempts: [
      attempt("github", safe, res, "repository metadata"),
      attempt("github", `${safe}/releases/latest`, release, tag ? `release ${tag}` : "no parseable release"),
    ],
  };
}

/** Current, maintained example repositories for the product and stack. */
export async function searchExampleRepositories(
  keywords: string,
  year: number,
  signal?: AbortSignal,
): Promise<{ facts: RepositoryFact[]; attempt: StructuredAttempt }> {
  const q = `${keywords} pushed:>=${year - 1}-01-01 archived:false`;
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", q);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "5");
  const res = await researchFetch<{ items?: GithubRepo[] }>(url, { headers: githubHeaders(), signal });
  if (!res.ok) return { facts: [], attempt: attempt("github", `search:${keywords}`, res) };
  const facts = (res.data.items ?? []).map((item) => repoFact(item, null)).filter((f): f is RepositoryFact => Boolean(f));
  return { facts, attempt: attempt("github", `search:${keywords}`, res, `${facts.length} repositories`) };
}

/** Confirm a curated official documentation page is live and read its title. */
export async function checkOfficialDoc(
  target: OfficialDocTarget,
  signal?: AbortSignal,
): Promise<{ fact: OfficialDocFact; attempt: StructuredAttempt }> {
  const res = await researchFetch<string>(target.url, { signal, parse: "text", maxBytes: 65_536, timeoutMs: 10_000 });
  if (res.ok) {
    const title = sanitizeText(res.data.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "", 160);
    return {
      fact: { ...target, status: "verified", httpStatus: res.status, title },
      attempt: attempt("official_docs", target.url, res, `http_${res.status}`),
    };
  }
  const status: OfficialDocFact["status"] =
    res.status === 404 || res.status === 410
      ? "not_found"
      : res.status === 401 || res.status === 403 || res.status === 429
        ? "blocked"
        : "unreachable";
  return {
    fact: { ...target, status, httpStatus: res.status, title: "" },
    attempt: attempt("official_docs", target.url, res),
  };
}
