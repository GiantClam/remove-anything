import { Metadata } from "next";
import { locales, defaultLocale } from "@/config";
import { env } from "@/env.mjs";

function normalizePath(path: string) {
  if (!path || path === "/") {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

export function buildLocalizedPath(locale: string, path: string) {
  const cleanPath = normalizePath(path);
  const localizedPath = `${locale === defaultLocale ? "" : `/${locale}`}${cleanPath === "/" ? "" : cleanPath}`;

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
  const localizedAlternates = availableLocales ?? locales;

  return {
    canonical: buildLocalizedUrl(locale, cleanPath),
    languages: {
      "x-default": buildLocalizedUrl(defaultLocale, cleanPath),
      ...Object.fromEntries(
        localizedAlternates.map((loc) => [
          loc,
          buildLocalizedUrl(loc, cleanPath),
        ])
      ),
    },
  };
}
