import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";
import WatermarkRemoval from "@/components/watermark-removal";
import { getChargeProduct } from "@/db/queries/charge-product";
import { buildSeoMetadata } from "@/lib/seo";
import { getMetadataBase } from "@/lib/utils";

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
    <div>
      <WatermarkRemoval locale={locale} chargeProduct={chargeProduct} />
    </div>
  );
}
