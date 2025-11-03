import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";

import MarketingRemoveBackground from "@/components/marketing/marketing-remove-background";
import { locales, defaultLocale } from "@/config";
import { env } from "@/env.mjs";

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
  const path = "/remove-background";
  
  // 动态生成title和description
  const title = locale === 'zh' || locale === 'tw' 
    ? "Remove Anything | 3秒 AI 消除照片中任何物体 - 免费背景移除工具"
    : "Remove Anything | 3 Second AI Remove Anything from Photos - Free Background Remover";
  
  const description = locale === 'zh' || locale === 'tw'
    ? "免费AI抠图工具，3秒快速去除照片背景、人物、物体。支持高清图片，无需PS技能，一键下载透明背景图片。每天限50次免费，立即试用！"
    : "Free AI background remover tool. Remove anything from photos in 3 seconds - people, objects, text. High-quality results, no PS skills needed. Free download, 50 free uses daily. Try now!";

  // 如果 URL 中带有 before/after，则服务端生成动态 OG 图，便于社交爬虫抓取
  const hasPair = !!(searchParams?.before && searchParams?.after);
  const ogImage = hasPair
    ? `${base}/api/og?before=${encodeURIComponent(searchParams!.before!)}&after=${encodeURIComponent(searchParams!.after!)}${searchParams?.id ? `&id=${encodeURIComponent(searchParams!.id!)}` : ''}${searchParams?.mode ? `&mode=${searchParams!.mode}` : ''}`
    : `${base}/og.png`;

  return {
    title,
    description,
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
      title,
      description,
      type: hasPair ? "article" : "website",
      url: `${base}${locale === defaultLocale ? "" : `/${locale}`}${path}`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: hasPair ? "AI Background Removal Before & After" : "Remove Anything - AI Background Remover",
        },
      ],
      locale: locale === 'en' ? 'en_US' : locale === 'tw' ? 'zh_TW' : locale,
      siteName: 'Remove Anything',
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
      creator: '@removeanything',
    },
  };
}

export default async function MarketingRemoveBackgroundPage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);

  return <MarketingRemoveBackground locale={locale} />;
} 