import { MetadataRoute } from "next";
import { allPosts } from "contentlayer/generated";

import { defaultLocale, locales } from "@/config";
import { env } from "@/env.mjs";

type ChangeFrequency = "daily" | "weekly" | "monthly";

type StaticPage = {
  path: string;
  priority: number;
  changeFrequency: ChangeFrequency;
};

const staticMarketingPages: StaticPage[] = [
  { path: "/", priority: 1.0, changeFrequency: "daily" },
  { path: "/remove-background", priority: 1.0, changeFrequency: "daily" },
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
  { path: "/remove-objects", priority: 0.8, changeFrequency: "weekly" },
  { path: "/sora2-video-watermark-removal", priority: 0.7, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.7, changeFrequency: "weekly" },
  { path: "/blog", priority: 0.8, changeFrequency: "weekly" },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "monthly" },
  { path: "/terms-of-use", priority: 0.3, changeFrequency: "monthly" },
];

function buildLocalizedUrl(locale: (typeof locales)[number], path: string) {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const cleanPath = path === "/" ? "" : path;
  return `${base}${locale === defaultLocale ? "" : `/${locale}`}${cleanPath}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  for (const page of staticMarketingPages) {
    for (const locale of locales) {
      entries.push({
        url: buildLocalizedUrl(locale, page.path),
        priority: page.priority,
        changeFrequency: page.changeFrequency,
        lastModified: now,
      });
    }
  }

  const blogPosts = allPosts
    .filter((post) => post.published && post.language === defaultLocale && post.slug)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((post) => post.slug!.replace(`/${defaultLocale}`, ""));

  for (const postPath of blogPosts) {
    for (const locale of locales) {
      entries.push({
        url: buildLocalizedUrl(locale, postPath),
        priority: 0.7,
        changeFrequency: "monthly",
        lastModified: now,
      });
    }
  }

  return entries;
}
