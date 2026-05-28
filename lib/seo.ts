import { Metadata } from "next";
import {
  defaultLocale,
  legacyLocaleRedirects,
  localeMetadata,
  locales,
  type Locale,
  type LegacyLocale,
} from "@/config";
import { env } from "@/env.mjs";

function normalizePath(path: string) {
  if (!path || path === "/") {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

export function normalizeRouteLocale(locale: string): Locale {
  if (legacyLocaleRedirects.includes(locale as LegacyLocale)) {
    return "zh-tw";
  }

  if (locales.includes(locale as Locale)) {
    return locale as Locale;
  }

  return defaultLocale;
}

export function getHtmlLang(locale: string) {
  return localeMetadata[normalizeRouteLocale(locale)].htmlLang;
}

export function getHrefLang(locale: string) {
  return localeMetadata[normalizeRouteLocale(locale)].hreflang;
}

export function getOpenGraphLocale(locale: string) {
  return localeMetadata[normalizeRouteLocale(locale)].ogLocale;
}

export function buildLocalizedPath(locale: string, path: string) {
  const cleanPath = normalizePath(path);
  const normalizedLocale = normalizeRouteLocale(locale);
  const localizedPath = `${normalizedLocale === defaultLocale ? "" : `/${normalizedLocale}`}${cleanPath === "/" ? "" : cleanPath}`;

  return localizedPath || "/";
}

export function buildLocalizedUrl(locale: string, path: string) {
  const base = (env.NEXT_PUBLIC_SITE_URL || "https://www.remove-anything.com").replace(/\/$/, "");
  const localizedPath = buildLocalizedPath(locale, path);

  return `${base}${localizedPath === "/" ? "" : localizedPath}`;
}

export function buildBreadcrumbListSchema(
  locale: string,
  items: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: buildLocalizedUrl(locale, item.path),
    })),
  };
}

export function constructAlternates({
  locale,
  path,
  availableLocales,
}: {
  locale: string;
  path: string;
  availableLocales?: string[];
}): Metadata["alternates"] {
  const cleanPath = normalizePath(path);
  const localizedAlternates = (availableLocales ?? locales).map(normalizeRouteLocale);

  return {
    canonical: buildLocalizedUrl(locale, cleanPath),
    languages: {
      "x-default": buildLocalizedUrl(defaultLocale, cleanPath),
      ...Object.fromEntries(
        localizedAlternates.map((loc) => [
          getHrefLang(loc),
          buildLocalizedUrl(loc, cleanPath),
        ])
      ),
    },
  };
}

export function buildSeoMetadata({
  locale,
  path,
  title,
  description,
  keywords,
  availableLocales,
  ogImage,
  openGraphType = "website",
  noIndex = false,
}: {
  locale: string;
  path: string;
  title: string;
  description: string;
  keywords?: string | string[];
  availableLocales?: string[];
  ogImage?: string;
  openGraphType?: "website" | "article";
  noIndex?: boolean;
}): Metadata {
  const image = ogImage
    ? [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ]
    : undefined;

  return {
    title,
    description,
    keywords,
    alternates: constructAlternates({
      locale,
      path,
      availableLocales,
    }),
    ...(noIndex
      ? {
          robots: {
            index: false,
            follow: true,
          },
        }
      : {}),
    openGraph: {
      title,
      description,
      type: openGraphType,
      url: buildLocalizedUrl(locale, path),
      images: image,
      locale: getOpenGraphLocale(locale),
      siteName: "Remove Anything",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
      creator: "@removeanything",
      site: "@removeanything",
    },
  };
}
