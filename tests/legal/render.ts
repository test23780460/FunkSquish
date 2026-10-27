import { createElement, type ReactElement } from "react";
import { prerender } from "react-dom/static";

/** Visible text of server-rendered markup: tags removed, entities decoded, whitespace collapsed. */
export function visibleText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;|[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Renders a page component (sync or async server component) to HTML, waiting for every Suspense boundary. */
export async function renderPage(Page: () => ReactElement | Promise<ReactElement>) {
  const el = await Page();
  const { prelude } = await prerender(el ?? createElement("div"));
  return new Response(prelude).text();
}

/** Every time commitment ("7 days", "5 business days", "24 months"...) in a text, normalized. */
export function timeCommitments(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\b(\d+)[\s-]+(business[\s-]+days?|days?|months?|hours?|minutes?|weeks?|years?)\b/gi)) {
    const unit = m[2].toLowerCase().replace(/-/g, " ").replace(/s?$/, "s").replace(/^business days?s$/, "business days");
    out.add(`${m[1]} ${unit}`);
  }
  return [...out].sort();
}
