import { logger } from "../_core/logger.js";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: "tavily" | "serpapi" | "duckduckgo";
};

export type WebSearchResponse = {
  query: string;
  results: WebSearchResult[];
  answer?: string;
  searchedAt: string;
};

async function searchTavily(
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<WebSearchResponse | null> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        include_answer: true,
        search_depth: "basic",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: { title: string; url: string; content: string }[];
      answer?: string;
    };
    return {
      query,
      answer: data.answer,
      searchedAt: new Date().toISOString(),
      results: (data.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content?.slice(0, 400) ?? "",
        source: "tavily" as const,
      })),
    };
  } catch (err) {
    logger.warn({ err }, "tavily_search_failed");
    return null;
  }
}

async function searchSerpApi(
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<WebSearchResponse | null> {
  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("num", String(maxResults));
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      organic_results?: { title: string; link: string; snippet: string }[];
      answer_box?: { answer?: string; snippet?: string };
    };
    const answer =
      data.answer_box?.answer ?? data.answer_box?.snippet ?? undefined;
    return {
      query,
      answer,
      searchedAt: new Date().toISOString(),
      results: (data.organic_results ?? []).slice(0, maxResults).map((r) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet ?? "",
        source: "serpapi" as const,
      })),
    };
  } catch (err) {
    logger.warn({ err }, "serpapi_search_failed");
    return null;
  }
}

/** DuckDuckGo Instant Answer — no API key; limited but always available. */
async function searchDuckDuckGo(
  query: string,
  maxResults: number,
): Promise<WebSearchResponse> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "AppForge-Research/1.0" },
  });
  const data = (await res.json()) as {
    AbstractText?: string;
    AbstractURL?: string;
    Heading?: string;
    RelatedTopics?: Array<
      | { Text?: string; FirstURL?: string }
      | { Name?: string; Topics?: { Text?: string; FirstURL?: string }[] }
    >;
  };

  const results: WebSearchResult[] = [];
  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title: data.Heading ?? query,
      url: data.AbstractURL,
      snippet: data.AbstractText,
      source: "duckduckgo",
    });
  }

  for (const topic of data.RelatedTopics ?? []) {
    if (results.length >= maxResults) break;
    if ("Topics" in topic && topic.Topics) {
      for (const sub of topic.Topics) {
        if (sub.Text && sub.FirstURL) {
          results.push({
            title: sub.Text.slice(0, 80),
            url: sub.FirstURL,
            snippet: sub.Text,
            source: "duckduckgo",
          });
        }
      }
    } else if ("Text" in topic && topic.Text && topic.FirstURL) {
      results.push({
        title: topic.Text.slice(0, 80),
        url: topic.FirstURL,
        snippet: topic.Text,
        source: "duckduckgo",
      });
    }
  }

  return {
    query,
    answer: data.AbstractText,
    searchedAt: new Date().toISOString(),
    results: results.slice(0, maxResults),
  };
}

/** Perform live web search — Tavily → SerpAPI → DuckDuckGo fallback. */
export async function searchWeb(
  query: string,
  maxResults = 6,
): Promise<WebSearchResponse> {
  const tavilyKey = process.env.TAVILY_API_KEY ?? "";
  const serpKey = process.env.SERPAPI_API_KEY ?? process.env.SERP_API_KEY ?? "";

  if (tavilyKey) {
    const r = await searchTavily(query, maxResults, tavilyKey);
    if (r && r.results.length > 0) return r;
  }
  if (serpKey) {
    const r = await searchSerpApi(query, maxResults, serpKey);
    if (r && r.results.length > 0) return r;
  }
  return searchDuckDuckGo(query, maxResults);
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
