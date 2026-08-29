import { useEffect } from "react";

type Props = {
  title: string;
  description?: string;
  ogImage?: string;
};

export function PageMeta({
  title,
  description = "AppForge — build full-stack apps with AI agents.",
  ogImage = "/branding/social-preview.svg",
}: Props) {
  useEffect(() => {
    document.title = `${title} · AppForge`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", description);
    let og = document.querySelector('meta[property="og:title"]');
    if (!og) {
      og = document.createElement("meta");
      og.setAttribute("property", "og:title");
      document.head.appendChild(og);
    }
    og.setAttribute("content", title);
  }, [title, description, ogImage]);

  return null;
}
