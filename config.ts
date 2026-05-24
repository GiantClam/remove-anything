import { LocalePrefix, Pathnames } from "next-intl/routing";

export const defaultLocale = "en" as const;
export const locales = [
  "en",
  "tw",
  "fr",
  "ja",
  "ko",
  "de",
  "pt",
  "es",
  "ar",
] as const;

export type Locale = (typeof locales)[number];

export const pathnames: Pathnames<typeof locales> = {
  "/": "/",
  "/remove-background": "/remove-background",
  "/transparent-png-maker": "/transparent-png-maker",
  "/white-background-maker": "/white-background-maker",
  "/change-background-color": "/change-background-color",
  "/batch-remove-background": "/batch-remove-background",
  "/batch-watermark-removal": "/batch-watermark-removal",
  "/batch-image-compressor": "/batch-image-compressor",
  "/batch-image-resizer": "/batch-image-resizer",
  "/batch-image-format-converter": "/batch-image-format-converter",
  "/png-to-jpg": "/png-to-jpg",
  "/jpg-to-png": "/jpg-to-png",
  "/webp-to-png": "/webp-to-png",
  "/remove-watermark": "/remove-watermark",
  "/remove-objects": "/remove-objects",
  "/sora2-video-watermark-removal": "/sora2-video-watermark-removal",
  "/pricing": "/pricing",
  "/blog": "/blog",
  "/blog/[slug]": "/blog/[slug]",
  "/blog/category/[slug]": "/blog/category/[slug]",
  "/remove-bg-alternative": "/remove-bg-alternative",
  "/photoroom-alternative": "/photoroom-alternative",
  "/pixelcut-alternative": "/pixelcut-alternative",
  "/remove-anything-vs-remove-bg": "/remove-anything-vs-remove-bg",
  "/privacy-policy": "/privacy-policy",
  "/terms-of-use": "/terms-of-use",
  "/signin": "/signin",
  "/app/batch-remove-background": "/app/batch-remove-background",
  "/app/batch-watermark-removal": "/app/batch-watermark-removal",
};

export const localePrefix = "as-needed";

export const port = process.env.PORT || 3000;
export const host = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:${port}`;
