import { getSitemapSectionEntries, renderUrlSet } from "@/lib/sitemap";

export function GET() {
  return new Response(renderUrlSet(getSitemapSectionEntries("tools")), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
