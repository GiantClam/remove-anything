import { getTranslations, unstable_setRequestLocale } from "next-intl/server";

import { PricingCardsWrapper } from "@/components/pricing-cards-wrapper";
import { PricingFaq } from "@/components/pricing-faq";
import { getChargeProduct } from "@/db/queries/charge-product";
import { getMetadataBase } from "@/lib/utils";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

type Props = {
  params: { locale: string };
};

export async function generateMetadata({ params: { locale } }: Props) {
  const t = await getTranslations({ locale });
  return {
    metadataBase: getMetadataBase(),
    title: `${t("PricingPage.title")} - ${t("LocaleLayout.title")}`,
    description: t("LocaleLayout.description"),
  };
}

export default async function PricingPage({ params: { locale } }: Props) {
  unstable_setRequestLocale(locale);

  const { data: chargeProduct = [] } = await getChargeProduct(locale);

  return (
    <div className="flex w-full flex-col gap-16 py-8 md:py-8">
      <PricingCardsWrapper chargeProduct={chargeProduct} />
      <hr className="container" />
      <PricingFaq />
    </div>
  );
}
