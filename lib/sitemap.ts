import { allPosts } from "contentlayer/generated";

import { BLOG_CATEGORIES } from "@/config/blog";
import { defaultLocale, locales } from "@/config";
import { alternativePageLocales } from "@/lib/alternative-pages";
import { buildLocalizedUrl } from "@/lib/seo";
import { env } from "@/env.mjs";

type ChangeFrequency = "daily" | "weekly" | "monthly";

export type SitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
};

type StaticPage = {
  path: string;
  priority: number;
  changeFrequency: ChangeFrequency;
};

const now = new Date();

const corePages: StaticPage[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/pricing", priority: 0.7, changeFrequency: "weekly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "monthly" },
  { path: "/terms-of-use", priority: 0.3, changeFrequency: "monthly" },
];

const toolPages: StaticPage[] = [
  { path: "/remove-background", priority: 1, changeFrequency: "daily" },
  { path: "/transparent-png-maker", priority: 0.95, changeFrequency: "daily" },
  { path: "/white-background-maker", priority: 0.95, changeFrequency: "daily" },
  { path: "/change-background-color", priority: 0.9, changeFrequency: "daily" },
  { path: "/batch-remove-background", priority: 0.9, changeFrequency: "weekly" },
  { path: "/batch-image-compressor", priority: 0.88, changeFrequency: "weekly" },
  { path: "/batch-image-resizer", priority: 0.88, changeFrequency: "weekly" },
  { path: "/batch-image-format-converter", priority: 0.88, changeFrequency: "weekly" },
  { path: "/png-to-jpg", priority: 0.86, changeFrequency: "weekly" },
  { path: "/jpg-to-png", priority: 0.86, changeFrequency: "weekly" },
  { path: "/webp-to-png", priority: 0.86, changeFrequency: "weekly" },
  { path: "/remove-watermark", priority: 0.8, changeFrequency: "weekly" },
  { path: "/batch-watermark-removal", priority: 0.78, changeFrequency: "weekly" },
  { path: "/sora2-video-watermark-removal", priority: 0.7, changeFrequency: "weekly" },
];

const comparisonPages: StaticPage[] = [
  { path: "/remove-bg-alternative", priority: 0.72, changeFrequency: "weekly" },
  { path: "/photoroom-alternative", priority: 0.72, changeFrequency: "weekly" },
  { path: "/pixelcut-alternative", priority: 0.72, changeFrequency: "weekly" },
  { path: "/remove-anything-vs-remove-bg", priority: 0.74, changeFrequency: "weekly" },
];

function toEntry(locale: string, page: StaticPage): SitemapEntry {
  return {
    url: buildLocalizedUrl(locale, page.path),
    priority: page.priority,
    changeFrequency: page.changeFrequency,
    lastModified: now,
  };
}

function getBlogLocales() {
  return Array.from(
    new Set(
      allPosts
        .filter((post) => post.published && locales.includes(post.language as (typeof locales)[number]))
        .map((post) => post.language as (typeof locales)[number]),
    ),
  );
}

function getLocalizedStaticEntries(pages: StaticPage[]) {
  return locales
    .filter((locale) => locale !== defaultLocale)
    .flatMap((locale) => pages.map((page) => toEntry(locale, page)));
}

function getLocalizedComparisonEntries() {
  return alternativePageLocales
    .filter((locale) => locale !== defaultLocale)
    .flatMap((locale) => comparisonPages.map((page) => toEntry(locale, page)));
}

function getBlogEntriesForLocales(targetLocales: string[]) {
  const entries: SitemapEntry[] = [];
  const localeSet = new Set(targetLocales);

  for (const locale of getBlogLocales()) {
    if (!localeSet.has(locale)) {
      continue;
    }

    entries.push({
      url: buildLocalizedUrl(locale, "/blog"),
      priority: 0.8,
      changeFrequency: "weekly",
      lastModified: now,
    });

    for (const category of BLOG_CATEGORIES) {
      const hasPosts = allPosts.some(
        (post) =>
          post.published &&
          post.language === locale &&
          Array.isArray(post.categories) &&
          post.categories.includes(category.slug),
      );

      if (!hasPosts) {
        continue;
      }

      entries.push({
        url: buildLocalizedUrl(locale, `/blog/category/${category.slug}`),
        priority: 0.55,
        changeFrequency: "weekly",
        lastModified: now,
      });
    }
  }

  const postEntries = allPosts
    .filter((post) => post.published && localeSet.has(post.language))
    .map((post) => ({
      url: buildLocalizedUrl(post.language, `/blog/${post.slugAsParams.split("/").slice(1).join("/")}`),
      priority: 0.7,
      changeFrequency: "monthly" as const,
      lastModified: new Date(post.date),
    }));

  entries.push(...postEntries);
  return entries;
}

export function getSitemapSectionEntries(section: "core" | "tools" | "comparisons" | "blog" | "i18n") {
  switch (section) {
    case "core":
      return corePages.map((page) => toEntry(defaultLocale, page));
    case "tools":
      return toolPages.map((page) => toEntry(defaultLocale, page));
    case "comparisons":
      return comparisonPages.map((page) => toEntry(defaultLocale, page));
    case "blog":
      return getBlogEntriesForLocales([defaultLocale]);
    case "i18n":
      return [
        ...getLocalizedStaticEntries(corePages),
        ...getLocalizedStaticEntries(toolPages),
        ...getLocalizedComparisonEntries(),
        ...getBlogEntriesForLocales(getBlogLocales().filter((locale) => locale !== defaultLocale)),
      ];
  }
}

export function renderUrlSet(entries: SitemapEntry[]) {
  const items = entries
    .map(
      (entry) => `
  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastModified.toISOString()}</lastmod>
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority.toFixed(2)}</priority>
  </url>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`;
}

export function renderSitemapIndex() {
  const origin = (env.NEXT_PUBLIC_SITE_URL || "https://www.remove-anything.com").replace(/\/$/, "");
  const sections = [
    "core",
    "tools",
    "comparisons",
    "blog",
    "i18n",
  ] as const;

  const items = sections
    .map(
      (section) => `
  <sitemap>
    <loc>${origin}/sitemap-${section}.xml</loc>
    <lastmod>${now.toISOString()}</lastmod>
  </sitemap>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>`;
}
