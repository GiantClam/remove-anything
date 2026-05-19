import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { getChargeProduct } from "@/db/queries/charge-product";
import BatchRemoveBackground from "@/components/batch-remove-background";
import { getMetadataBase } from "@/lib/utils";

export const dynamic = 'force-dynamic';

type Props = {
  params: { locale: string };
};

export async function generateMetadata({ params: { locale } }: Props) {
  const t = await getTranslations({ locale, namespace: "BatchRemoveBackground" });
  return {
    metadataBase: getMetadataBase(),
    title: t("title"),
    description: t("description"),
  };
}

export default async function BatchRemoveBackgroundPage({
  params: { locale },
}: Props) {
  unstable_setRequestLocale(locale);
  const { data: chargeProduct } = await getChargeProduct(locale);
  
  return <BatchRemoveBackground locale={locale} chargeProduct={chargeProduct} />;
} 
