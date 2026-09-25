import { logger } from "../_core/logger.js";
import { researchFetch, ResearchAbortedError } from "./researchHttp.js";

export type WebSearchProvider =
  | "tavily"
  | "serpapi"
  | "gemini_grounding"
  | "duckduckgo";

export type WebSearchProviderAttempt = {
  provider: WebSearchProvider;
  ok: boolean;
  detail: string;
};

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: WebSearchProvider;
};

export type WebSearchResponse = {
  query: string;
  results: WebSearchResult[];
  answer?: string;
  searchedAt: string;
  providerAttempts?: WebSearchProviderAttempt[];
};

type ProviderOutcome =
  | { ok: true; results: WebSearchResult[]; answer?: string }
  | { ok: false; detail: string };

function truthyFlag(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

async function searchTavily(
  query: string,
  maxResults: number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ProviderOutcome> {
  const res = await researchFetch<{
    results?: { title?: string; url?: string; content?: string }[];
    answer?: string;
  }>("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      include_answer: true,
      search_depth: "basic",
    }),
    signal,
  });
  if (!res.ok) return { ok: false, detail: res.detail };
  const results = (res.data.results ?? [])
    .filter((r) => typeof r.url === "string" && r.url)
    .map((r) => ({
      title: String(r.title ?? r.url),
      url: String(r.url),
      snippet: String(r.content ?? "").slice(0, 400),
      source: "tavily" as const,
    }));
  return { ok: true, results, answer: res.data.answer };
}

async function searchSerpApi(
  query: string,
  maxResults: number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ProviderOutcome> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", String(maxResults));
  const res = await researchFetch<{
    organic_results?: { title?: string; link?: string; snippet?: string }[];
    answer_box?: { answer?: string; snippet?: string };
    error?: string;
  }>(url, { signal });
  if (!res.ok) return { ok: false, detail: res.detail };
  if (res.data.error) return { ok: false, detail: "provider_error_response" };
  const results = (res.data.organic_results ?? [])
    .filter((r) => typeof r.link === "string" && r.link)
    .slice(0, maxResults)
    .map((r) => ({
      title: String(r.title ?? r.link),
      url: String(r.link),
      snippet: String(r.snippet ?? ""),
      source: "serpapi" as const,
    }));
  return {
    ok: true,
    results,
    answer: res.data.answer_box?.answer ?? res.data.answer_box?.snippet,
  };
}

type GeminiGroundingResponse = {
  candidates?: {
    groundingMetadata?: {
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
      groundingSupports?: {
        segment?: { text?: string };
        groundingChunkIndices?: number[];
      }[];
    };
  }[];
};

/**
 * Gemini with Google Search grounding. Only enabled explicitly
 * (GEMINI_SEARCH_GROUNDING=true) because grounding is billed separately from
 * normal generation. Grounding chunk URIs are redirect links; each one is
 * resolved to its real destination so authority can be judged, and chunks that
 * cannot be resolved are dropped rather than trusted.
 */
async function searchGeminiGrounding(
  query: string,
  maxResults: number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ProviderOutcome> {
  const model = process.env.GEMINI_SEARCH_MODEL || process.env.GEMINI_MODEL || "gemini-3-flash-preview";
  const res = await researchFetch<GeminiGroundingResponse>(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Search the web and cite current primary sources for: ${query}`,
              },
            ],
          },
        ],
        tools: [{ google_search: {} }],
      }),
      signal,
    },
  );
  if (!res.ok) return { ok: false, detail: res.detail };
  const metadata = res.data.candidates?.[0]?.groundingMetadata;
  const chunks = metadata?.groundingChunks ?? [];
  const supportText = new Map<number, string[]>();
  for (const support of metadata?.groundingSupports ?? []) {
    for (const index of support.groundingChunkIndices ?? []) {
      const list = supportText.get(index) ?? [];
      if (support.segment?.text) list.push(support.segment.text);
      supportText.set(index, list);
    }
  }
  const results: WebSearchResult[] = [];
  for (const [index, chunk] of chunks.slice(0, maxResults).entries()) {
    const uri = chunk.web?.uri;
    if (!uri) continue;
    const resolved = await resolveRedirect(uri, signal);
    if (!resolved) continue;
    results.push({
      title: String(chunk.web?.title ?? resolved),
      url: resolved,
      snippet: (supportText.get(index) ?? []).join(" ").slice(0, 400),
      source: "gemini_grounding",
    });
  }
  return { ok: true, results };
}

async function resolveRedirect(
  uri: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const parsed = new URL(uri);
    if (!parsed.hostname.endsWith("vertexaisearch.cloud.google.com")) return uri;
  } catch {
    return null;
  }
  const timeout = AbortSignal.timeout(5_000);
  try {
    const res = await fetch(uri, {
      redirect: "manual",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    await res.body?.cancel().catch(() => undefined);
    return res.headers.get("location");
  } catch {
    if (signal?.aborted) throw new ResearchAbortedError();
    return null;
  }
}

/**
 * DuckDuckGo Instant Answer: no API key, always attempted last. It only knows
 * encyclopedic entities, so long research queries usually return nothing.
 * duckduckgo.com topic links are search-engine pages, not sources, and are
 * never returned as evidence.
 */
async function searchDuckDuckGo(
  query: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<ProviderOutcome> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
  const res = await researchFetch<{
    AbstractText?: string;
    AbstractURL?: string;
    Heading?: string;
    Results?: { Text?: string; FirstURL?: string }[];
  }>(url, { signal });
  if (!res.ok) return { ok: false, detail: res.detail };
  const results: WebSearchResult[] = [];
  const add = (title: string, link: string | undefined, snippet: string) => {
    if (!link) return;
    try {
      const host = new URL(link).hostname.replace(/^www\./, "");
      if (host === "duckduckgo.com" || host.endsWith(".duckduckgo.com")) return;
    } catch {
      return;
    }
    results.push({ title, url: link, snippet, source: "duckduckgo" });
  };
  if (res.data.AbstractText && res.data.AbstractURL) {
    add(res.data.Heading ?? query, res.data.AbstractURL, res.data.AbstractText);
  }
  for (const item of res.data.Results ?? []) {
    if (item.Text) add(item.Text.slice(0, 80), item.FirstURL, item.Text);
  }
  return { ok: true, results: results.slice(0, maxResults), answer: res.data.AbstractText };
}

/**
 * Live web search with provider fallback (Tavily → SerpAPI → Gemini grounding →
 * DuckDuckGo). Every attempt is recorded with a visible reason. The function
 * never throws for provider failures; it only rethrows a caller abort.
 */
export async function searchWeb(
  query: string,
  maxResults = 6,
  signal?: AbortSignal,
): Promise<WebSearchResponse> {
  const tavilyKey = process.env.TAVILY_API_KEY ?? "";
  const serpKey = process.env.SERPAPI_API_KEY ?? process.env.SERP_API_KEY ?? "";
  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "";
  const groundingEnabled = truthyFlag(process.env.GEMINI_SEARCH_GROUNDING);

  const providers: {
    provider: WebSearchProvider;
    unavailable?: string;
    run: () => Promise<ProviderOutcome>;
  }[] = [
    {
      provider: "tavily",
      unavailable: tavilyKey ? undefined : "not_configured",
      run: () => searchTavily(query, maxResults, tavilyKey, signal),
    },
    {
      provider: "serpapi",
      unavailable: serpKey ? undefined : "not_configured",
      run: () => searchSerpApi(query, maxResults, serpKey, signal),
    },
    {
      provider: "gemini_grounding",
      unavailable: !geminiKey
        ? "not_configured"
        : groundingEnabled
          ? undefined
          : "not_enabled (set GEMINI_SEARCH_GROUNDING=true)",
      run: () => searchGeminiGrounding(query, maxResults, geminiKey, signal),
    },
    {
      provider: "duckduckgo",
      run: () => searchDuckDuckGo(query, maxResults, signal),
    },
  ];

  const providerAttempts: WebSearchProviderAttempt[] = [];
  for (const entry of providers) {
    if (entry.unavailable) {
      providerAttempts.push({ provider: entry.provider, ok: false, detail: entry.unavailable });
      continue;
    }
    let outcome: ProviderOutcome;
    try {
      outcome = await entry.run();
    } catch (error) {
      if (signal?.aborted || error instanceof ResearchAbortedError) throw error;
      outcome = { ok: false, detail: "provider_exception" };
    }
    if (!outcome.ok) {
      logger.warn({ provider: entry.provider, detail: outcome.detail }, "web_search_provider_failed");
      providerAttempts.push({ provider: entry.provider, ok: false, detail: outcome.detail });
      continue;
    }
    if (outcome.results.length === 0) {
      providerAttempts.push({ provider: entry.provider, ok: false, detail: "no_results" });
      continue;
    }
    providerAttempts.push({
      provider: entry.provider,
      ok: true,
      detail: `${outcome.results.length} result(s)`,
    });
    return {
      query,
      results: outcome.results,
      answer: outcome.answer,
      searchedAt: new Date().toISOString(),
      providerAttempts,
    };
  }

  return {
    query,
    results: [],
    searchedAt: new Date().toISOString(),
    providerAttempts,
  };
}

export function formatSearchForPrompt(response: WebSearchResponse): string {
  const lines = [
    `Web search: "${response.query}" (${response.searchedAt})`,
    response.answer ? `Summary: ${response.answer}` : "",
    "",
    "Sources:",
    ...response.results.map(
      (r, i) =>
        `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet.slice(0, 280)}`,
    ),
  ].filter(Boolean);
  return lines.join("\n");
}
