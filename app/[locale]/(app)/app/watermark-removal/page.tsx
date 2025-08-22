import { getTranslations, unstable_setRequestLocale } from "next-intl/server";

import WatermarkRemoval from "@/components/watermark-removal";
import { getChargeProduct } from "@/db/queries/charge-product";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps) {
  const t = await getTranslations({ locale, namespace: "WatermarkRemovalPage" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function WatermarkRemovalPage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);
  const { data: chargeProduct } = await getChargeProduct(locale);

  return <WatermarkRemoval locale={locale} chargeProduct={chargeProduct} />;
}
