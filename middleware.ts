import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { withAuth } from "next-auth/middleware";

import { kvKeys } from "@/config/kv";
import { env } from "@/env.mjs";
import countries from "@/lib/countries.json";
import { getIP } from "@/lib/ip";
import { redis } from "@/lib/redis";
import { isCloudflareEnvironment } from "@/lib/cloudflare-bindings";

import { defaultLocale, localePrefix, locales } from "./config";

export const config = {
  matcher: [
    "/",
    "/(zh|tw|en|fr|ja|ko|de|pt|es|ar)/:path*",
    "/((?!static|.*\\..*|_next).*)",
  ], // Run middleware on API routes],
};

// Custom route matcher to replace Clerk's createRouteMatcher
function createRouteMatcher(routes: string[]) {
  return (req: NextRequest) => {
    const { pathname } = req.nextUrl;
    return routes.some(route => {
      // Convert route pattern to regex
      const pattern = route
        .replace(/\(.*\)/g, ".*") // Replace (.*) with .*
        .replace(/:locale/g, `(${locales.join("|")})`) // Replace :locale with actual locales
        .replace(/\*/g, ".*"); // Replace * with .*
      
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(pathname);
    });
  };
}

const isProtectedRoute = createRouteMatcher([
  "/:locale/app(.*)",
  "/:locale/admin(.*)",
  "/app", // 添加/app路由为受保护路由
]);
const isPublicRoute = createRouteMatcher([
  "/api/webhooks(.*)",
  "/api/sora2-video-watermark-removal(.*)",
  "/api/download-video",
  "/:locale/app/sora2-video-watermark-removal",
  "/app/sora2-video-watermark-removal",
  "/:locale/sora2-video-watermark-removal",
  "/sora2-video-watermark-removal",
]);

const nextIntlMiddleware = createMiddleware({
  defaultLocale,
  locales,
  localePrefix,
});

export default withAuth(
  async function middleware(req) {
    const { geo, nextUrl } = req;
    const isApi = nextUrl.pathname.startsWith("/api/");
    
    if (isPublicRoute(req)) {
      return;
    }
    
    // 在 Cloudflare Workers 环境中，我们可以使用环境变量或 KV 来存储被阻止的 IP
    // 暂时禁用 IP 阻止功能，直到我们实现 Cloudflare 兼容的版本
    if (false && env.VERCEL_ENV !== "development") {
      const ip = getIP(req);
      console.log("ip-->", ip);

      // TODO: 实现 Cloudflare 兼容的 IP 阻止功能
      // const blockedIPs = await getBlockedIPsFromKV();
      
      // if (blockedIPs?.includes(ip)) {
      //   if (isApi) {
      //     return NextResponse.json(
      //       { error: "You have been blocked." },
      //       { status: 403 },
      //     );
      //   }

      //   nextUrl.pathname = "/blocked";
      //   return NextResponse.rewrite(nextUrl);
      // }

      // if (nextUrl.pathname === "/blocked") {
      //   nextUrl.pathname = "/";
      //   return NextResponse.redirect(nextUrl);
      // }
    }

    // 检测并记录访问者信息（支持Cloudflare和传统环境）
    if (geo && !isApi && env.VERCEL_ENV !== "development") {
      console.log("geo-->", geo);
      const country = geo.country;
      const city = geo.city;

      const countryInfo = countries.find((x) => x.cca2 === country);
      if (countryInfo) {
        const flag = countryInfo.flag;
        try {
          // 判断是否在Cloudflare环境中运行
          if (isCloudflareEnvironment() && (req as any).cf && (req as any).cf.env?.KV) {
            // 在Cloudflare Worker环境中使用绑定
            console.log('🌐 Middleware: 使用Cloudflare KV绑定存储访问者信息');
            const kv = (req as any).cf.env.KV;
            await kv.put(kvKeys.currentVisitor, JSON.stringify({ country, city, flag }));
          } else {
            // 在传统环境中使用redis客户端
            console.log('💻 Middleware: 使用Redis存储访问者信息');
            await redis.set(kvKeys.currentVisitor, { country, city, flag });
          }
        } catch (error) {
          console.error('⚠️ 存储访问者信息失败:', error);
        }
      }
    }
    
    if (isApi) {
      return;
    }
    
    // 处理特殊的/app路由重定向
    if (nextUrl.pathname === '/app') {
      // 让/app路由通过到app/page.tsx，不被next-intl拦截
      return;
    }

    // 处理 /zh 到 /tw 的重定向（因为配置中没有 zh，只有 tw）
    if (nextUrl.pathname.startsWith('/zh')) {
      const newPath = nextUrl.pathname.replace(/^\/zh/, '/tw');
      const newUrl = new URL(newPath, nextUrl.origin);
      newUrl.search = nextUrl.search;
      return NextResponse.redirect(newUrl);
    }

    return nextIntlMiddleware(req);
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        // 显式放行 Sora2 视频去水印页面（含本地化前缀）
        const allowSora2 = /^\/(zh|en)\/app\/sora2-video-watermark-removal$/.test(pathname) ||
          /^\/app\/sora2-video-watermark-removal$/.test(pathname) ||
          /^\/(zh|en)\/sora2-video-watermark-removal$/.test(pathname) ||
          /^\/sora2-video-watermark-removal$/.test(pathname);
        if (allowSora2) {
          return true;
        }
        // If it's a public route, allow access
        if (isPublicRoute(req)) {
          return true;
        }
        
        // If it's a protected route, require authentication
        if (isProtectedRoute(req)) {
          return !!token;
        }
        
        // For all other routes, allow access
        return true;
      },
    },
  }
);
