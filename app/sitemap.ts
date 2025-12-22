import { MetadataRoute } from "next";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

import { allPosts } from "contentlayer/generated";

import { defaultLocale, locales, pathnames } from "@/config";
import { env } from "@/env.mjs";
import { getPathname } from "@/lib/navigation";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const keys = Object.keys(pathnames) as Array<keyof typeof pathnames>;
  const posts = await Promise.all(
    allPosts
      .filter((post) => post.published && post.language === defaultLocale)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((post) => post.slug?.replace(`/${defaultLocale}`, "")),
  );
  
  const explorePages = [`/explore`];

  function getUrl(
    key: keyof typeof pathnames,
    locale: (typeof locales)[number],
  ) {
    const pathname = getPathname({ locale, href: key });
    const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
    return `${base}${pathname}`;
  }

  // return [...posts, ...keys].map((key) => ({
  //   url: getUrl(key, defaultLocale),
  //   priority: 0.7,
  //   changeFrequency: 'daily',
  //   alternates: {
  //     languages: Object.fromEntries(
  //       locales.map((locale) => [locale, getUrl(key, locale)]),
  //     ),
  //   },
  // }));

  // 添加优先级配置
  const sitemapEntries: Array<{
    url: string;
    priority: number;
    changeFrequency: "daily" | "weekly" | "monthly";
    lastModified: Date;
  }> = [];
  
  // 高优先级页面（主页、主要功能页面）
  const highPriorityPages = ["/", "/remove-background", "/batch-remove-background"];
  highPriorityPages.forEach(page => {
    if (keys.includes(page)) {
      locales.forEach(locale => {
        sitemapEntries.push({
          url: getUrl(page, locale),
          priority: 1.0,
          changeFrequency: "daily" as const,
          lastModified: new Date(),
        });
      });
    }
  });
  
  // 中等优先级页面（博客、功能页面）
  const mediumPriorityPages = ["/blog", "/pricing", "/explore"];
  mediumPriorityPages.forEach(page => {
    if (keys.includes(page)) {
      locales.forEach(locale => {
        sitemapEntries.push({
          url: getUrl(page, locale),
          priority: 0.8,
          changeFrequency: "weekly" as const,
          lastModified: new Date(),
        });
      });
    }
  });
  
  // 博客文章
  posts.forEach(post => {
    locales.forEach(locale => {
      sitemapEntries.push({
        url: getUrl(post, locale),
        priority: 0.7,
        changeFrequency: "monthly" as const,
        lastModified: new Date(),
      });
    });
  });
  
  // 用户生成的内容（图片）
  // imageUrls.forEach(imageUrl => {
  //   locales.forEach(locale => {
  //     sitemapEntries.push({
  //       url: getUrl(imageUrl, locale),
  //       priority: 0.6,
  //       changeFrequency: "weekly" as const,
  //       lastModified: new Date(),
  //     });
  //   });
  // });
  
  // 探索页面
  explorePages.forEach(page => {
    locales.forEach(locale => {
      sitemapEntries.push({
        url: getUrl(page, locale),
        priority: 0.6,
        changeFrequency: "daily" as const,
        lastModified: new Date(),
      });
    });
  });
  
  // 其他剩余页面（低优先级）
  const remainingPages = keys.filter(key => 
    !highPriorityPages.includes(key) && 
    !mediumPriorityPages.includes(key)
  );
  remainingPages.forEach(page => {
    locales.forEach(locale => {
      sitemapEntries.push({
        url: getUrl(page, locale),
        priority: 0.5,
        changeFrequency: "monthly" as const,
        lastModified: new Date(),
      });
    });
  });

  return sitemapEntries;
}
