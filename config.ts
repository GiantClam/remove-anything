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
  "/blog": "/blog",
};

export const localePrefix = "as-needed";

export const port = process.env.PORT || 3000;
export const host = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:${port}`;
