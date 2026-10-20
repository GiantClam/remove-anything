#!/usr/bin/env node
import { load } from "cheerio";

const baseUrl = (
  process.env.SMOKE_BASE_URL || "https://www.remove-anything.com"
).replace(/\/$/, "");
const gaId = process.env.SMOKE_GA_ID || "";
const canonicalPaths = [
  "/remove-background",
  "/remove-objects",
  "/transparent-png-maker",
  "/white-background-maker",
  "/change-background-color",
  "/remove-watermark",
];

function fail(message) {
  throw new Error(message);
}

async function fetchHtml(pathname) {
  const url = `${baseUrl}${pathname}`;
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    headers: { "user-agent": "remove-anything-release-smoke/1.0" },
  });
  const html = await response.text();
  if (!response.ok)
    fail(`${pathname}: expected HTTP 2xx, received ${response.status}`);
  return { response, html };
}

function canonicalFrom(html) {
  const match =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  return match?.[1] || null;
}

for (const pathname of canonicalPaths) {
  const { html } = await fetchHtml(pathname);
  const canonical = canonicalFrom(html);
  const expectedCanonical = `${baseUrl}${pathname}`;
  if (canonical !== expectedCanonical) {
    fail(
      `${pathname}: canonical ${canonical || "missing"} did not equal ${expectedCanonical}`,
    );
  }
  if (!/<h1\b/i.test(html)) fail(`${pathname}: visible H1 is missing`);
  if (!/<script[^>]+type=["']application\/ld\+json["']/i.test(html)) {
    fail(`${pathname}: JSON-LD structured data is missing`);
  }
  if (
    /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)
  ) {
    fail(`${pathname}: indexable canonical page unexpectedly has noindex`);
  }
  console.log(`PASS ${pathname} canonical=${canonical}`);
}

// The app publishes a sitemap index; canonical pages live in its child files.
// Read a bounded, same-origin graph rather than treating index entries as pages.
const sitemapUrls = new Set();
const visitedSitemaps = new Set();
async function readSitemap(pathname, depth = 0) {
  if (depth > 2 || visitedSitemaps.size >= 20)
    fail("Sitemap index exceeds the supported traversal limit");
  const url = new URL(pathname, `${baseUrl}/`);
  if (url.origin !== new URL(baseUrl).origin || url.username || url.password)
    fail(`Sitemap points outside the checked site: ${url.origin}`);
  if (visitedSitemaps.has(url.href)) return;
  visitedSitemaps.add(url.href);
  const { html } = await fetchHtml(`${url.pathname}${url.search}`);
  const xml = load(html, { xmlMode: true });
  if (xml("sitemapindex").length) {
    const children = xml("sitemapindex > sitemap > loc")
      .map((_, element) => xml(element).text().trim())
      .get();
    if (!children.length) fail(`${url.pathname}: sitemap index is empty`);
    for (const child of children) await readSitemap(child, depth + 1);
  } else if (xml("urlset").length) {
    for (const entry of xml("urlset > url > loc").toArray())
      sitemapUrls.add(xml(entry).text().trim());
  } else {
    fail(`${url.pathname}: expected a sitemap index or URL set`);
  }
}
await readSitemap("/sitemap.xml");
for (const pathname of canonicalPaths) {
  if (!sitemapUrls.has(`${baseUrl}${pathname}`))
    fail(`sitemap.xml and its children: missing ${pathname}`);
}
console.log(
  `PASS /sitemap.xml and its children contain ${canonicalPaths.length} canonical tools`,
);

if (gaId) {
  const { html } = await fetchHtml(canonicalPaths[0]);
  const document = load(html);
  const loaderUrl = new URL("https://www.googletagmanager.com/gtag/js");
  loaderUrl.searchParams.set("id", gaId);
  const hasScript = document("script[src]")
    .toArray()
    .some((element) => document(element).attr("src") === loaderUrl.href);
  const hasPreload = document("link[href]")
    .toArray()
    .some((element) => {
      const link = document(element);
      return (
        link.attr("href") === loaderUrl.href &&
        (link.attr("rel") || "")
          .toLowerCase()
          .split(/\s+/)
          .includes("preload") &&
        (link.attr("as") || "").toLowerCase() === "script"
      );
    });
  if (!hasScript && !hasPreload)
    fail(`GA4: ${gaId} loader was not found on ${canonicalPaths[0]}`);
  // afterInteractive scripts are scheduled through a preload during SSR.
  // Initialization and analytics receipt require separate browser evidence.
  console.log(
    `PASS ${canonicalPaths[0]} schedules GA4 loader ${gaId}; hydrated config and receipt require browser verification`,
  );
}

console.log(`Smoke checks passed for ${baseUrl}`);
