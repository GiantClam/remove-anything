import "@/styles/globals.css";
// import "../clerk.css";
import "../prism.css";

import Script from "next/script";

import { ClientSessionProvider } from "@/components/providers/session-provider";
import { GoogleAnalytics } from "@next/third-parties/google";
import { NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  unstable_setRequestLocale,
} from "next-intl/server";
import { ThemeProvider } from "next-themes";

import { fontHeading, fontSans, fontUrban } from "@/assets/fonts";
import { Analytics } from "@/components/analytics";
import ClaritySnippet from "@/components/ClaritySnippet";

import { TailwindIndicator } from "@/components/tailwind-indicator";
import { Toaster } from "@/components/ui/toaster";
import { locales } from "@/config";
import { siteConfig } from "@/config/site";
import { env } from "@/env.mjs";
import { cn } from "@/lib/utils";

import { QueryProvider } from "../QueryProvider";
import RegisterSW from "@/components/providers/register-sw";

interface RootLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Omit<RootLayoutProps, "children">) {
  const t = await getTranslations({ locale, namespace: "LocaleLayout" });

  // 根据locale生成独特的title和description
  const uniqueTitle = locale === 'zh' || locale === 'tw'
    ? "Remove Anything | 3秒 AI 消除照片中任何物体 - 免费背景移除工具"
    : locale === 'ja'
    ? "Remove Anything | 3秒でAI写真から物体を削除 - 無料背景除去ツール"
    : locale === 'ko'
    ? "Remove Anything | 3초 AI로 사진에서 물체 제거 - 무료 배경 제거 도구"
    : "Remove Anything | 3 Second AI Remove Anything from Photos - Free Background Remover";
  
  const uniqueDescription = locale === 'zh' || locale === 'tw'
    ? "免费AI抠图工具，3秒快速去除照片背景、人物、物体。支持高清图片，无需PS技能，一键下载透明背景图片。每天限50次免费，立即试用！"
    : locale === 'ja'
    ? "無料AI背景除去ツール。3秒で写真から背景・人物・物体を削除。高画質対応、PS不要、ワンクリックで透明背景画像をダウンロード。1日50回まで無料、今すぐ試す！"
    : locale === 'ko'
    ? "무료 AI 배경 제거 도구. 3초 만에 사진에서 배경, 인물, 물체를 제거합니다. 고화질 지원, PS 불필요, 원클릭으로 투명 배경 이미지를 다운로드. 하루 50회 무료, 지금 바로 시도하세요!"
    : "Free AI background remover tool. Remove anything from photos in 3 seconds - people, objects, text. High-quality results, no PS skills needed. Free download, 50 free uses daily. Try now!";

  const base = (siteConfig.url || env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const ogImage = siteConfig.ogImage && siteConfig.ogImage.startsWith("http")
    ? siteConfig.ogImage
    : `${base}/og.png`;

  return {
    title: uniqueTitle,
    description: uniqueDescription,
    metadataBase: new URL(base),
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: `/${locale === "en" ? "" : locale}`,
      languages: {
        "x-default": "/",
        zh: "/zh",
        tw: "/tw",
        ja: "/ja",
        fr: "/fr",
        es: "/es",
        de: "/de",
        ko: "/ko",
        pt: "/pt",
        ar: "/ar"
      },
    },
    openGraph: {
      type: 'website',
      url: `/${locale === "en" ? "" : locale}`,
      title: uniqueTitle,
      description: uniqueDescription,
      images: ogImage,
      locale: locale === 'en' ? 'en_US' : locale === 'tw' ? 'zh_TW' : locale,
      siteName: 'Remove Anything',
    },
    twitter: {
      card: 'summary_large_image',
      title: uniqueTitle,
      description: uniqueDescription,
      images: [ogImage],
      creator: '@removeanything',
      site: '@removeanything',
    },
    keywords: locale === 'zh' || locale === 'tw'
      ? "AI抠图,背景移除,图片处理,免费抠图工具,AI图片编辑,去除背景"
      : locale === 'ja'
      ? "AI背景除去,画像処理,無料背景除去ツール,AI画像編集"
      : locale === 'ko'
      ? "AI 배경 제거, 이미지 처리, 무료 배경 제거 도구, AI 이미지 편집"
      : "AI background remover, image processing, free photo editor, remove background, AI photo editing",
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Removed Clerk locale mappings - no longer needed

export default async function RootLayout({
  children,
  params: { locale },
}: RootLayoutProps) {
  unstable_setRequestLocale(locale);

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head />
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable,
          fontUrban.variable,
          fontHeading.variable,
        )}
      >
        <ClientSessionProvider>
          <NextIntlClientProvider messages={messages}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <QueryProvider>{children}</QueryProvider>
              <Analytics />
              <Toaster />
              <TailwindIndicator />
            </ThemeProvider>
          </NextIntlClientProvider>
        </ClientSessionProvider>
        {env.NEXT_PUBLIC_GA_ID && (
          <>
            {/* GoogleAnalytics 使用 lazyOnload 策略，延迟到页面加载完成后 */}
            <GoogleAnalytics gaId={env.NEXT_PUBLIC_GA_ID} />
            <ClaritySnippet />
          </>
        )}
        {env.NEXT_PUBLIC_UMAMI_DATA_ID && (
          <Script
            async
            strategy="lazyOnload"
            src="https://sa.douni.one/st.js"
            data-website-id={env.NEXT_PUBLIC_UMAMI_DATA_ID}
          />
        )}
        <footer className="mt-10 border-t">
          <div className="container mx-auto px-4 py-6 text-sm text-muted-foreground flex items-center justify-center gap-4">
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline-offset-4 hover:underline">Privacy</a>
            <span>·</span>
            <a href="/terms-of-use" target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline-offset-4 hover:underline">Terms</a>
          </div>
        </footer>
        <RegisterSW />
      </body>
    </html>
  );
}
