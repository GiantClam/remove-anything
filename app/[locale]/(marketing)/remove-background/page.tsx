import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";

import MarketingRemoveBackground from "@/components/marketing/marketing-remove-background";
import { env } from "@/env.mjs";
import { buildSeoMetadata } from "@/lib/seo";
import { getMetadataBase } from "@/lib/utils";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata(
  { params: { locale }, searchParams }: PageProps & { searchParams?: { task?: string; before?: string; after?: string; id?: string; mode?: 'light' | 'dark' } }
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "RemoveBackgroundPage" });

  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const hasPair = !!(searchParams?.before && searchParams?.after);
  const ogImage = hasPair
    ? `${base}/api/og?before=${encodeURIComponent(searchParams!.before!)}&after=${encodeURIComponent(searchParams!.after!)}${searchParams?.id ? `&id=${encodeURIComponent(searchParams!.id!)}` : ''}${searchParams?.mode ? `&mode=${searchParams!.mode}` : ''}`
    : `${base}/og.png`;

  return {
    metadataBase: getMetadataBase(),
    ...buildSeoMetadata({
      locale,
      path: "/remove-background",
      title: t("title"),
      description: t("description"),
      keywords: t("keywords"),
      ogImage,
      openGraphType: hasPair ? "article" : "website",
    }),
  };
}

export default async function MarketingRemoveBackgroundPage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);

  return <MarketingRemoveBackground locale={locale} />;
} 
