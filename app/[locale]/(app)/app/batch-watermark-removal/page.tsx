import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { getChargeProduct } from "@/db/queries/charge-product";
import BatchWatermarkRemoval from "@/components/batch-watermark-removal";

export const dynamic = 'force-dynamic';

type Props = {
  params: { locale: string };
};

export async function generateMetadata({ params: { locale } }: Props) {
  const t = await getTranslations({ locale, namespace: "BatchWatermarkRemoval" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function BatchWatermarkRemovalPage({
  params: { locale },
}: Props) {
  unstable_setRequestLocale(locale);
  const { data: chargeProduct } = await getChargeProduct(locale);
  
  return <BatchWatermarkRemoval locale={locale} chargeProduct={chargeProduct} />;
}
