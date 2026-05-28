import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import Script from "next/script";

import Examples from "@/components/sections/examples";
import CompareTools from "@/components/sections/compare-tools";
import HeroLanding from "@/components/sections/hero-landing";
import PopularImageTools from "@/components/sections/popular-image-tools";
import QuickAccess from "@/components/sections/quick-access";
// import PreviewLanding from "@/components/sections/preview-landing";
import { env } from "@/env.mjs";
import { Metadata } from "next";
import {
  buildBreadcrumbListSchema,
  buildSeoMetadata,
  buildLocalizedUrl,
  getHtmlLang,
} from "@/lib/seo";
import { getMetadataBase } from "@/lib/utils";

type Props = {
  params: { locale: string };
};

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "LocaleLayout" });

  return {
    metadataBase: getMetadataBase(),
    ...buildSeoMetadata({
      locale,
      path: "/",
      title: t("title"),
      description: t("description"),
      keywords: t("keywords"),
      ogImage: `${(env.NEXT_PUBLIC_SITE_URL || "https://www.remove-anything.com").replace(/\/$/, "")}/og.png`,
    }),
  };
}

// 避免构建期预渲染命中数据库：强制动态渲染
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function IndexPage({ params: { locale } }: Props) {
  // Enable static rendering
  unstable_setRequestLocale(locale);

  const homepageUrl = buildLocalizedUrl(locale, "/");
  const siteOrigin = (env.NEXT_PUBLIC_SITE_URL || "https://www.remove-anything.com").replace(/\/$/, "");
  const localeDescription =
    locale === "zh-tw"
      ? "使用 AI 去除照片中的背景、雜物、水印與不需要的元素，並輸出乾淨可用的圖片。"
      : "Remove backgrounds, objects, watermarks, and other unwanted elements from images with AI-powered cleanup tools.";
  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Remove Anything",
    description: localeDescription,
    url: homepageUrl,
    applicationCategory: "PhotoEditingApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    featureList: [
      "Background removal",
      "Object cleanup",
      "Watermark removal",
      "Transparent PNG export",
      "Batch image workflows"
    ],
    image: `${siteOrigin}/og.png`,
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Remove Anything",
    url: homepageUrl,
    logo: `${siteOrigin}/logo.png`,
    email: "support@remove-anything.com",
  };

  const webSiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Remove Anything",
    url: siteOrigin,
    inLanguage: getHtmlLang(locale),
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteOrigin}/blog?query={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const breadcrumbSchema = buildBreadcrumbListSchema(locale, [
    { name: locale === "zh-tw" ? "首頁" : "Home", path: "/" },
  ]);

  return (
    <>
      <Script
        id="structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationSchema)
        }}
      />
      <Script
        id="organization-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <Script
        id="website-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webSiteSchema),
        }}
      />
      <Script
        id="homepage-breadcrumb-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />
      {/* 精简首页：首屏价值主张 + 快速入口 + 案例展示 */}
      <HeroLanding />
      <QuickAccess />
      <PopularImageTools locale={locale} />
      <CompareTools />
      <Examples />
      {/* 瀑布流展示：暂时注释以避免服务端数据库查询导致的 RSC thenable 错误 */}
      {/* <section id="examples-gallery" className="scroll-mt-20">
        <PreviewLanding />
      </section> */}
    </>
  );
}
