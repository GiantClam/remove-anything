import { renderSitemapIndex } from "@/lib/sitemap";

export function GET() {
  return new Response(renderSitemapIndex(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
