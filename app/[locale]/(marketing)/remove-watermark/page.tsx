import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";
import type { Locale } from "@/config";
import WatermarkRemoval from "@/components/watermark-removal";
import { ToolViewTracker } from "@/components/analytics/tool-view-tracker";
import { getChargeProduct } from "@/db/queries/charge-product";
import { buildSeoMetadata } from "@/lib/seo";
import { getMetadataBase } from "@/lib/utils";
import ToolContractDetails from "@/components/marketing/tool-contract-details";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "RemoveWatermarkPage" });

  return {
    metadataBase: getMetadataBase(),
    ...buildSeoMetadata({
      locale,
      path: "/remove-watermark",
      title: t("title"),
      description: t("description"),
      keywords: t("keywords"),
    }),
  };
}

export default async function RemoveWatermarkPage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);
  const { data: chargeProduct } = await getChargeProduct(locale);

  return (
    <>
      <ToolViewTracker toolSlug="remove-watermark" locale={locale} />
      <WatermarkRemoval locale={locale} chargeProduct={chargeProduct} />
      <div className="container mx-auto max-w-4xl px-4 pb-8">
        <ToolContractDetails locale={locale as Locale} toolSlug="remove-watermark" />
      </div>
    </>
  );
}
