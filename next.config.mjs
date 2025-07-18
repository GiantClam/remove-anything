/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
// import { setupDevPlatform } from "@cloudflare/next-on-pages/next-dev";
import { withSentryConfig } from "@sentry/nextjs";
import { withContentlayer } from "next-contentlayer2";
import withNextIntl from "next-intl/plugin";

import("./env.mjs");

const withNextIntlConfig = withNextIntl();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 为了在Cloudflare Workers上运行，使用standalone模式支持SSR和API路由
  output: 'standalone',
  // trailingSlash: true, // 注释掉，standalone模式不需要
  
  // Use Cloudflare Functions instead of static export to support API routes
  // output: 'export', // Removed for NextAuth compatibility
  // trailingSlash: true, // Removed for NextAuth compatibility
  images: {
    unoptimized: true,
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
  },

  experimental: {
    mdxRs: true,
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
    instrumentationHook: false, // Disable instrumentation hook to avoid development issues
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

  webpack: (config, { webpack }) => {
    // config.plugins.push(
    //   new webpack.IgnorePlugin({
    //     resourceRegExp: /^pg-native$|^cloudflare:sockets$|^onnxruntime-node$/,
    //   }),
    // );
    // config.plugins.push(
    //   new webpack.IgnorePlugin({
    //     resourceRegExp: /^onnxruntime-node$/,
    //     exclude: [/node:/],
    //   }),
    // );

    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    return config;
  },
};

// if (process.env.NODE_ENV === "development") {
//   await setupDevPlatform();
// }

export default withSentryConfig(withNextIntlConfig(withContentlayer(nextConfig)), {
  org: "koya",
  project: "fluxaiproart",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
});
