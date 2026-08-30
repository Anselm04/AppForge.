/** Default / normalize tech stack for Item 1 reliability. */

const KNOWN = new Set([
  "react-node",
  "react-python",
  "vue-node",
  "svelte-node",
  "next-node",
  "angular-node",
  "vanilla-node",
  "react-django",
  "react-supabase",
  "remix-node",
  "astro-node",
  "phaser-html5",
  "three-js-3d",
  "babylon-js-3d",
  "unity-webgl",
  "godot-html5",
  "react-native-game",
  "flutter-game",
  "ai-agent-python",
  "ai-agent-node",
  "openai-tool",
  "langchain-tool",
  "crewai-agent",
  "autogen-agent",
  "electron-react",
  "tauri-rust",
  "react-native-expo",
  "flutter-firebase",
  "capacitor-ionic",
  "chrome-extension",
  "vscode-extension",
  "discord-bot",
  "telegram-bot",
  "slack-bot",
  "browser-automation",
  "web-scraper",
  "data-visualization",
  "api-service",
  "serverless-aws",
  "serverless-vercel",
]);

/** Prefer react-node when stack is missing, blank, or unknown. */
export function preferReactNodeStack(techStack: string | undefined | null): string {
  const s = (techStack || "").trim().toLowerCase();
  if (!s || s === "default" || s === "auto") return "react-node";
  if (KNOWN.has(s)) return s;
  // Fuzzy: contains react → react-node
  if (s.includes("react") && !s.includes("native")) return "react-node";
  if (s.includes("next")) return "next-node";
  return "react-node";
}
