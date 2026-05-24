import { MetadataRoute } from "next";
import { allPosts } from "contentlayer/generated";

import { locales } from "@/config";
import { buildLocalizedUrl } from "@/lib/seo";

type ChangeFrequency = "daily" | "weekly" | "monthly";

type StaticPage = {
  path: string;
  priority: number;
  changeFrequency: ChangeFrequency;
  locales?: string[];
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
  {
    path: "/remove-bg-alternative",
    priority: 0.72,
    changeFrequency: "weekly",
    locales: ["en"],
  },
  {
    path: "/photoroom-alternative",
    priority: 0.72,
    changeFrequency: "weekly",
    locales: ["en"],
  },
  {
    path: "/pixelcut-alternative",
    priority: 0.72,
    changeFrequency: "weekly",
    locales: ["en"],
  },
  {
    path: "/remove-anything-vs-remove-bg",
    priority: 0.74,
    changeFrequency: "weekly",
    locales: ["en"],
  },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "monthly" },
  { path: "/terms-of-use", priority: 0.3, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  for (const page of staticMarketingPages) {
    const pageLocales = page.locales ?? locales;

    for (const locale of pageLocales) {
      entries.push({
        url: buildLocalizedUrl(locale as (typeof locales)[number], page.path),
        priority: page.priority,
        changeFrequency: page.changeFrequency,
        lastModified: now,
      });
    }
  }

  const blogPosts = allPosts
    .filter((post) => post.published && post.slugAsParams)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((post) => {
      const [locale, ...slugParts] = post.slugAsParams.split("/");
      return {
        locale,
        path: `/blog/${slugParts.join("/")}`,
      };
    })
    .filter(
      (post): post is { locale: (typeof locales)[number]; path: string } =>
        locales.includes(post.locale as (typeof locales)[number]) && post.path !== "/blog/",
    );

  for (const post of blogPosts) {
    entries.push({
      url: buildLocalizedUrl(post.locale, post.path),
      priority: 0.7,
      changeFrequency: "monthly",
      lastModified: now,
    });
  }

  return entries;
}
