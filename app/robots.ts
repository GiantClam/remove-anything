import { MetadataRoute } from "next";
import { env } from "@/env.mjs";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app/*", "/admin/*", "/api/*"], // 禁止爬取用户私有页面和API
    },
    // 确保使用正确的 sitemap URL
    sitemap: `${env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
