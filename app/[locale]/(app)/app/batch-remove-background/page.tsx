import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { getChargeProduct } from "@/db/queries/charge-product";
import BatchRemoveBackground from "@/components/batch-remove-background";

export const dynamic = 'force-dynamic';

type Props = {
  params: { locale: string };
};

export async function generateMetadata({ params: { locale } }: Props) {
  const t = await getTranslations({ locale, namespace: "Playground" });
  return {
    title: `Batch Background Removal - Remove Anything`,
    description: "Remove backgrounds from multiple images at once using AI. Upload up to 10 images and get clean, transparent results instantly.",
  };
}

export default async function BatchRemoveBackgroundPage({
  params: { locale },
}: Props) {
  unstable_setRequestLocale(locale);
  const { data: chargeProduct } = await getChargeProduct(locale);
  
  return <BatchRemoveBackground locale={locale} chargeProduct={chargeProduct} />;
} 