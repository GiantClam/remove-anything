import { Metadata } from "next";
import { locales, defaultLocale } from "@/config";
import { env } from "@/env.mjs";

export function constructAlternates({
  locale,
  path,
}: {
  locale: string;
  path: string;
}): Metadata["alternates"] {
  const base = (env.NEXT_PUBLIC_SITE_URL || "https://www.remove-anything.com").replace(/\/$/, "");
  // Ensure path starts with /
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return {
    canonical: `${base}${locale === defaultLocale ? "" : `/${locale}`}${cleanPath === "/" ? "" : cleanPath}`,
    languages: {
      "x-default": `${base}${cleanPath === "/" ? "" : cleanPath}`,
      ...Object.fromEntries(
        locales.map((loc) => [
          loc,
          `${base}${loc === defaultLocale ? "" : `/${loc}`}${cleanPath === "/" ? "" : cleanPath}`,
        ])
      ),
    },
  };
}
