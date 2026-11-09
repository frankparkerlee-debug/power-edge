import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Internal surfaces. The pages are noindex anyway and the sales PDFs
        // are served through an authenticated route, but keep crawlers off the
        // paths entirely.
        disallow: ["/admin", "/sales", "/kit", "/links", "/email-preview"],
      },
      // Explicitly welcome AI answer-engine crawlers (search/retrieval AND
      // training) so PowerEdge can be cited & recommended by ChatGPT, Claude,
      // Perplexity, Gemini, Copilot, etc. Max visibility is the goal here.
      {
        userAgent: [
          "OAI-SearchBot",
          "ChatGPT-User",
          "GPTBot",
          "ClaudeBot",
          "Claude-SearchBot",
          "Claude-User",
          "PerplexityBot",
          "Perplexity-User",
          "Google-Extended",
          "Applebot-Extended",
          "Amazonbot",
          "meta-externalagent",
        ],
        allow: "/",
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
