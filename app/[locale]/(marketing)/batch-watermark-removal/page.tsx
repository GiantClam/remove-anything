import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";

import BatchWatermarkRemoval from "@/components/batch-watermark-removal";
import { locales, defaultLocale } from "@/config";
import { env } from "@/env.mjs";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata(
  { params: { locale }, searchParams }: PageProps & { searchParams?: { before?: string; after?: string; id?: string; mode?: 'light' | 'dark' } }
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "BatchWatermarkRemovalPage" });

  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const path = "/batch-watermark-removal";

  const hasPair = !!(searchParams?.before && searchParams?.after);
  const ogImage = hasPair
    ? `${base}/api/og?before=${encodeURIComponent(searchParams!.before!)}&after=${encodeURIComponent(searchParams!.after!)}${searchParams?.id ? `&id=${encodeURIComponent(searchParams!.id!)}` : ''}${searchParams?.mode ? `&mode=${searchParams!.mode}` : ''}`
    : `${base}/og.png`;

  return {
    title: t("title"),
    description: t("description"),
    keywords: t("keywords"),
    alternates: {
      canonical: `${base}${locale === defaultLocale ? "" : `/${locale}`}${path}`,
      languages: {
        "x-default": `${base}${path}`,
        ...Object.fromEntries(
          locales.map((loc) => [
            loc,
            `${base}${loc === defaultLocale ? "" : `/${loc}`}${path}`,
          ])
        ),
      },
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: hasPair ? "article" : "website",
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: hasPair ? "AI Watermark Removal Before & After" : "OG Image" }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function BatchWatermarkRemovalPage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);

  return <BatchWatermarkRemoval locale={locale} />;
}
