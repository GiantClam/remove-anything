import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";

import MarketingRemoveBackground from "@/components/marketing/marketing-remove-background";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "IndexPage" });

  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
  };
}

export default async function MarketingRemoveBackgroundPage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);

  return <MarketingRemoveBackground locale={locale} />;
} 