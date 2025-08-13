import { MetadataRoute } from "next";
import { prisma } from "@/db/prisma";
import { FluxTaskStatus } from "@/db/type";
import { FluxHashids } from "@/db/dto/flux.dto";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

import { allPosts } from "contentlayer/generated";

import { defaultLocale, locales, pathnames } from "@/config";
import { env } from "@/env.mjs";
import { getPathname } from "@/lib/navigation";

const getFluxUrl = async () => {
  // 在构建时或没有数据库连接时返回空数组
  if (shouldSkipDatabaseQuery()) {
    return [];
  }

  try {
    const fluxs = await prisma.fluxData.findMany({
      where: {
        isPrivate: false,
        taskStatus: {
          in: [FluxTaskStatus.Succeeded],
        },
      },
      select: {
        id: true
      }
    });
    return fluxs.map((flux) => `/d/${FluxHashids.encode(flux.id)}`)
  } catch (error) {
    console.error("❌ getFluxUrl 数据库查询错误:", error);
    return [];
  }
}
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const keys = Object.keys(pathnames) as Array<keyof typeof pathnames>;
  const posts = await Promise.all(
    allPosts
      .filter((post) => post.published && post.language === defaultLocale)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((post) => post.slug?.replace(`/${defaultLocale}`, "")),
  );
  // 在构建时或没有数据库连接时使用默认值
  let fluxDataCount = 0;
  if (!shouldSkipDatabaseQuery()) {
    try {
      fluxDataCount = await prisma.fluxData.count({
        where: {
          isPrivate: false,
          taskStatus: {
            in: [FluxTaskStatus.Succeeded],
          },
        }
      });
    } catch (error) {
      console.error("❌ sitemap fluxDataCount 数据库查询错误:", error);
      fluxDataCount = 0;
    }
  }
  const pageCount = Math.ceil(fluxDataCount / 24);
  const explorePages = Array.from({ length: pageCount }, (_, i) => i === 0 ? `/explore` : `/explore/${i + 1}`);

  function getUrl(
    key: keyof typeof pathnames,
    locale: (typeof locales)[number],
  ) {
    const pathname = getPathname({ locale, href: key });
    return `${env.NEXT_PUBLIC_SITE_URL}/${locale === defaultLocale ? "" : locale}${pathname === "/" ? "" : pathname}`;
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
  const fluxUrls = await getFluxUrl();

  // 添加优先级配置
  const sitemapEntries = [];
  
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
  
  // 用户生成的内容（Flux图片）
  fluxUrls.forEach(fluxUrl => {
    locales.forEach(locale => {
      sitemapEntries.push({
        url: getUrl(fluxUrl, locale),
        priority: 0.6,
        changeFrequency: "weekly" as const,
        lastModified: new Date(),
      });
    });
  });
  
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
