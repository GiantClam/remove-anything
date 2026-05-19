import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";

import MarketingRemoveBackground from "@/components/marketing/marketing-remove-background";
import { defaultLocale } from "@/config";
import { env } from "@/env.mjs";
import { constructAlternates } from "@/lib/seo";
import { getBackgroundToolCopy } from "@/lib/background-tool-variants";
import { getMetadataBase } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata(
  { params: { locale }, searchParams }: PageProps & { searchParams?: { before?: string; after?: string; id?: string; mode?: "light" | "dark" } },
): Promise<Metadata> {
  await getTranslations({ locale, namespace: "RemoveBackgroundPage" });
  const toolCopy = getBackgroundToolCopy(locale, "transparent-png");
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const hasPair = !!(searchParams?.before && searchParams?.after);
  const ogImage = hasPair
    ? `${base}/api/og?before=${encodeURIComponent(searchParams!.before!)}&after=${encodeURIComponent(searchParams!.after!)}${searchParams?.id ? `&id=${encodeURIComponent(searchParams.id)}` : ""}${searchParams?.mode ? `&mode=${searchParams.mode}` : ""}`
    : `${base}/og.png`;

  return {
    metadataBase: getMetadataBase(),
    title: toolCopy.metadataTitle,
    description: toolCopy.metadataDescription,
    keywords: toolCopy.metadataKeywords,
    alternates: constructAlternates({ locale, path: toolCopy.path }),
    openGraph: {
      title: toolCopy.metadataTitle,
      description: toolCopy.metadataDescription,
      type: hasPair ? "article" : "website",
      url: `${base}${locale === defaultLocale ? "" : `/${locale}`}${toolCopy.path}`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: "Transparent PNG maker before and after example",
        },
      ],
      siteName: "Remove Anything",
    },
    twitter: {
      card: "summary_large_image",
      title: toolCopy.metadataTitle,
      description: toolCopy.metadataDescription,
      images: [ogImage],
      creator: "@removeanything",
    },
  };
}

export default async function TransparentPngMakerPage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);

  return <MarketingRemoveBackground locale={locale} variant="transparent-png" />;
}
