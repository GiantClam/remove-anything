/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
// import { setupDevPlatform } from "@cloudflare/next-on-pages/next-dev";
import { withSentryConfig } from "@sentry/nextjs";
import { withContentlayer } from "next-contentlayer2";
import withNextIntl from "next-intl/plugin";
import withPWA from 'next-pwa';

import("./env.mjs");

const withNextIntlConfig = withNextIntl();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 为了在Cloudflare Workers上运行，使用standalone模式支持SSR和API路由
  output: 'standalone',
  // trailingSlash: true, // 注释掉，standalone模式不需要
  
  // 禁用API路由的静态生成，避免构建时数据库查询
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  
  // Use Cloudflare Functions instead of static export to support API routes
  // output: 'export', // Removed for NextAuth compatibility
  // trailingSlash: true, // Removed for NextAuth compatibility
  images: {
    // 启用图片优化与现代格式输出
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "meme-static.douni.one",
        port: "",
      },
      {
        protocol: "https",
        hostname: "no-person-static.douni.one",
        port: "",
      },
      {
        protocol: "https",
        hostname: "img.douni.one",
        port: "",
      },
    ],
  },
  
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  
  // Environment variable prefixes that should be available on the client side
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
    NEXT_PUBLIC_R2_URL_BASE: process.env.R2_URL_BASE || process.env.NEXT_PUBLIC_R2_URL_BASE,
  },

  experimental: {
    mdxRs: true,
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
    instrumentationHook: false, // Disable instrumentation hook to avoid development issues
  },

  // 构建时忽略 ESLint（线上构建不被大量告警阻塞）
  eslint: {
    ignoreDuringBuilds: true,
  },

  redirects() {
    return [
      {
        source: "/twitter",
        destination: "https://x.com/koyaguo",
        permanent: true,
      },
      {
        source: "/x",
        destination: "https://x.com/koyaguo",
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/feed",
        destination: "/feed.xml",
      },
      {
        source: "/rss",
        destination: "/feed.xml",
      },
      {
        source: "/rss.xml",
        destination: "/feed.xml",
      },
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },

  // Cloudflare-specific optimizations
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  webpack: (config, { webpack, isServer }) => {
    // 优化代码分割：第三方库单独打包（仅 JavaScript，不包括 CSS）
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // React相关库单独打包
            react: {
              name: 'react-vendor',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](react|react-dom|react-dom-server)[\\/]/,
              priority: 40,
              enforce: true,
              type: 'javascript/auto', // 仅打包 JavaScript
            },
            // Next.js相关（移除，避免打包 CSS）
            // nextjs: {
            //   name: 'nextjs-vendor',
            //   chunks: 'all',
            //   test: /[\\/]node_modules[\\/](next)[\\/]/,
            //   priority: 30,
            //   enforce: true,
            // },
            // UI库单独打包
            ui: {
              name: 'ui-vendor',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](@radix-ui|@headlessui|framer-motion)[\\/]/,
              priority: 25,
              enforce: true,
              type: 'javascript/auto', // 仅打包 JavaScript
            },
            // 工具库
            utils: {
              name: 'utils-vendor',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](lodash|date-fns|zod)[\\/]/,
              priority: 20,
              enforce: true,
              type: 'javascript/auto', // 仅打包 JavaScript
            },
            // 其他第三方库
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
              type: 'javascript/auto', // 仅打包 JavaScript
            },
          },
        },
      };
    }

    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    return config;
  },

  // 添加缓存头配置
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/api/og/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

// 动态将 R2 文件域名加入 remotePatterns
try {
  const r2Base = process.env.R2_URL_BASE || process.env.NEXT_PUBLIC_R2_URL_BASE;
  if (r2Base) {
    const u = new URL(r2Base);
    // 仅当未存在时再添加
    if (!nextConfig.images.remotePatterns.some(p => p.hostname === u.hostname)) {
      nextConfig.images.remotePatterns.push({
        protocol: u.protocol.replace(':', ''),
        hostname: u.hostname,
        port: u.port || "",
      });
    }
  }
} catch {}

// if (process.env.NODE_ENV === "development") {
//   await setupDevPlatform();
// }

// 暂时禁用Sentry以避免Vercel部署警告
// export default withSentryConfig(withNextIntlConfig(withContentlayer(nextConfig)), {
//   org: "koya",

//   silent: !process.env.CI,
//   widenClientFileUpload: true,
//   hideSourceMaps: true,
//   disableLogger: true,
//   automaticVercelMonitors: true,
//   async headers() {
//     return [
//       {
//         source: '/(.*)',
//         headers: [
//           {
//             key: 'X-Frame-Options',
//             value: 'DENY',
//           },
//           {
//             key: 'X-Content-Type-Options',
//             value: 'nosniff',
//           },
//           {
//             key: 'Referrer-Policy',
//             value: 'strict-origin-when-cross-origin',
//           },
//         ],
//       },
//     ];
//   },
// });

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest.json$/],
  // 排除 CSS 文件，避免被错误缓存
  exclude: [
    /\.map$/,
    /manifest$/,
    /\.css$/,
    /middleware-manifest\.json$/,
  ],
  runtimeCaching: [
    {
      // 仅缓存图片资源，不缓存 CSS/JS
      urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|webp|svg|gif|ico)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      // 仅缓存静态资源中的图片，排除 CSS/JS
      urlPattern: /^https:\/\/.*\/_next\/static\/.*\.(?:png|jpg|jpeg|webp|svg|gif|ico)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static-images',
        expiration: { maxEntries: 100, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
  ],
})(withNextIntlConfig(withContentlayer(nextConfig)));
