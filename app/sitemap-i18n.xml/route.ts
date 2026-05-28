import { getSitemapSectionEntries, renderUrlSet } from "@/lib/sitemap";

export function GET() {
  return new Response(renderUrlSet(getSitemapSectionEntries("i18n")), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
