import { getTranslations, unstable_setRequestLocale } from "next-intl/server";

import { PricingCardsWrapper } from "@/components/pricing-cards-wrapper";
import { PricingFaq } from "@/components/pricing-faq";
import { getChargeProduct } from "@/db/queries/charge-product";
import { getMetadataBase } from "@/lib/utils";
import { buildBreadcrumbListSchema, buildSeoMetadata } from "@/lib/seo";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

type Props = {
  params: { locale: string };
};

export async function generateMetadata({ params: { locale } }: Props) {
  const t = await getTranslations({ locale });
  const pricingDescription =
    locale === "zh-tw"
      ? "購買一次性積分，用於 AI 去背景、圖片批量處理與高品質下載。無需訂閱，按需充值。"
      : "Buy one-time credits for AI background removal, batch image tools, and premium downloads. No subscription required.";

  return {
    metadataBase: getMetadataBase(),
    ...buildSeoMetadata({
      locale,
      path: "/pricing",
      title: `${t("PricingPage.title")} | Remove Anything`,
      description: pricingDescription,
    }),
  };
}

export default async function PricingPage({ params: { locale } }: Props) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "PricingPage" });
  const pricingDescription =
    locale === "zh-tw"
      ? "購買一次性積分，用於 AI 去背景、圖片批量處理與高品質下載。無需訂閱，按需充值。"
      : "Buy one-time credits for AI background removal, batch image tools, and premium downloads. No subscription required.";

  const { data: chargeProduct = [] } = await getChargeProduct(locale);
  const breadcrumbSchema = buildBreadcrumbListSchema(locale, [
    { name: locale === "zh-tw" ? "首頁" : "Home", path: "/" },
    { name: t("label"), path: "/pricing" },
  ]);

  return (
    <div className="flex w-full flex-col gap-16 py-8 md:py-8">
      <script
        id="pricing-breadcrumb-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <section className="container text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          {pricingDescription}
        </p>
      </section>
      <PricingCardsWrapper chargeProduct={chargeProduct} />
      <hr className="container" />
      <PricingFaq />
    </div>
  );
}
