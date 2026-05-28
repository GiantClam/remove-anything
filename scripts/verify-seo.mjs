#!/usr/bin/env node

const baseUrl = (process.argv[2] || process.env.SEO_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeUrl(url) {
  return url.replace(/\/$/, "");
}

async function fetchText(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  return { response, text };
}

function getCanonical(html) {
  return html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] || "";
}

function getHreflangs(html) {
  return [...html.matchAll(/<link[^>]+rel="alternate"[^>]+hreflang="([^"]+)"[^>]+href="([^"]+)"/gi)].map(
    ([, hreflang, href]) => ({ hreflang, href }),
  );
}

function getMetaContent(html, attr, value) {
  const pattern = new RegExp(`<meta[^>]+${attr}="${value}"[^>]+content="([^"]*)"`, "i");
  return html.match(pattern)?.[1] || "";
}

async function verifyRedirect(path, expectedPathname) {
  const { response } = await fetchText(path, { redirect: "manual" });
  assert(response.status === 301, `${path} should 301`);
  const location = response.headers.get("location") || "";
  assert(location.endsWith(expectedPathname), `${path} should redirect to ${expectedPathname}, got ${location}`);
}

async function verifyPage(path, expectations) {
  const { response, text } = await fetchText(path);
  assert(response.ok, `${path} should return 200`);

  const canonical = getCanonical(text);
  assert(
    normalizeUrl(canonical) === normalizeUrl(`${baseUrl}${expectations.canonical}`),
    `${path} canonical mismatch: ${canonical}`,
  );

  for (const hreflang of expectations.hreflangs) {
    assert(
      getHreflangs(text).some((entry) => entry.hreflang === hreflang),
      `${path} missing hreflang ${hreflang}`,
    );
  }

  if (expectations.ogTitle) {
    assert(
      getMetaContent(text, "property", "og:title") === expectations.ogTitle,
      `${path} og:title mismatch`,
    );
  }

  if (expectations.twitterTitle) {
    assert(
      getMetaContent(text, "name", "twitter:title") === expectations.twitterTitle,
      `${path} twitter:title mismatch`,
    );
  }

  if (expectations.schemaTypes) {
    for (const type of expectations.schemaTypes) {
      assert(
        text.includes(type),
        `${path} missing schema ${type}`,
      );
    }
  }
}

async function main() {
  await verifyRedirect("/tw/remove-background", "/zh-tw/remove-background");
  await verifyRedirect("/zh/remove-background", "/zh-tw/remove-background");

  await verifyPage("/", {
    canonical: "/",
    hreflangs: ["en", "zh-TW", "x-default"],
    ogTitle: "AI Tool to Remove Objects, Backgrounds, and Watermarks | Remove Anything",
    twitterTitle: "AI Tool to Remove Objects, Backgrounds, and Watermarks | Remove Anything",
    schemaTypes: ["Organization", "WebSite", "SoftwareApplication", "BreadcrumbList"],
  });

  await verifyPage("/remove-background", {
    canonical: "/remove-background",
    hreflangs: ["en", "zh-TW", "x-default"],
    ogTitle: "Free AI Background Remover for Transparent PNGs | Remove Anything",
    twitterTitle: "Free AI Background Remover for Transparent PNGs | Remove Anything",
  });

  await verifyPage("/remove-bg-alternative", {
    canonical: "/remove-bg-alternative",
    hreflangs: ["en", "zh-TW", "x-default"],
  });

  await verifyPage("/pricing", {
    canonical: "/pricing",
    hreflangs: ["en", "zh-TW", "x-default"],
  });

  await verifyPage("/blog/ai-background-removal-guide", {
    canonical: "/blog/ai-background-removal-guide",
    hreflangs: ["en", "ar", "x-default"],
  });

  const { text: removeObjectsHtml } = await fetchText("/remove-objects");
  assert(
    /<meta[^>]+name="robots"[^>]+content="noindex, follow"/i.test(removeObjectsHtml),
    "/remove-objects should be noindex",
  );

  const { text: sitemapIndex } = await fetchText("/sitemap.xml");
  for (const fileName of [
    "sitemap-core.xml",
    "sitemap-tools.xml",
    "sitemap-comparisons.xml",
    "sitemap-blog.xml",
    "sitemap-i18n.xml",
  ]) {
    assert(sitemapIndex.includes(fileName), `sitemap index missing ${fileName}`);
  }

  const { text: i18nSitemap } = await fetchText("/sitemap-i18n.xml");
  assert(!i18nSitemap.includes("/tw/"), "i18n sitemap should not contain /tw/");
  assert(!i18nSitemap.includes("/remove-objects"), "i18n sitemap should not contain noindex pages");

  console.log(`SEO verification passed for ${baseUrl}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
