import "@/styles/globals.css";
// import "../clerk.css";
import "../prism.css";

import { Suspense } from "react";
import Script from "next/script";

import {
  getTranslations,
  unstable_setRequestLocale,
} from "next-intl/server";
import { ThemeProvider } from "next-themes";

import { fontHeading, fontSans, fontUrban } from "@/assets/fonts";
import { Analytics } from "@/components/analytics";
import ClaritySnippet from "@/components/ClaritySnippet";

import { TailwindIndicator } from "@/components/tailwind-indicator";
import { locales } from "@/config";
import { env } from "@/env.mjs";
import { buildLocalizedPath, getHtmlLang, getOpenGraphLocale } from "@/lib/seo";
import { cn, getMetadataBase } from "@/lib/utils";

import RegisterSW from "@/components/providers/register-sw";

interface RootLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Omit<RootLayoutProps, "children">) {
  const t = await getTranslations({ locale, namespace: "LocaleLayout" });
  const ogImage = `${(env.NEXT_PUBLIC_SITE_URL || "https://www.remove-anything.com").replace(/\/$/, "")}/og.png`;

  return {
    title: t("title"),
    description: t("description"),
    metadataBase: getMetadataBase(),
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      url: buildLocalizedPath(locale, "/"),
      title: t("title"),
      description: t("description"),
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: t("title"),
        },
      ],
      locale: getOpenGraphLocale(locale),
      siteName: "Remove Anything",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [ogImage],
      creator: "@removeanything",
      site: "@removeanything",
    },
    keywords: t("keywords"),
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

  return (
    <html lang={getHtmlLang(locale)} suppressHydrationWarning>
      <head />
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable,
          fontUrban.variable,
          fontHeading.variable,
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Suspense fallback={null}>
            <Analytics />
          </Suspense>
          {process.env.NODE_ENV === "development" ? <TailwindIndicator /> : null}
        </ThemeProvider>
        <ClaritySnippet />
        {env.NEXT_PUBLIC_UMAMI_DATA_ID && (
          <Script
            async
            strategy="lazyOnload"
            src="https://sa.douni.one/st.js"
            data-website-id={env.NEXT_PUBLIC_UMAMI_DATA_ID}
          />
        )}
        <footer className="mt-10 border-t">
          <div className="container mx-auto flex items-center justify-center gap-4 px-4 py-6 text-sm text-muted-foreground">
            <a href={buildLocalizedPath(locale, "/privacy-policy")} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:text-foreground hover:underline">Privacy</a>
            <span>·</span>
            <a href={buildLocalizedPath(locale, "/terms-of-use")} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:text-foreground hover:underline">Terms</a>
          </div>
        </footer>
        <RegisterSW />
      </body>
    </html>
  );
}
