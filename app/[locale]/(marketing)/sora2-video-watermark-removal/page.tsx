import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";
import dynamic from "next/dynamic";
const Sora2VideoWatermarkRemoval = dynamic(
  () => import("@/components/sora2-video-watermark-removal"),
  { ssr: false }
);
import { getChargeProduct } from "@/db/queries/charge-product";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Sora2VideoWatermarkRemovalPage" });

  return {
    title: t("title"),
    description: t("description"),
    keywords: t("keywords"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
    },
  };
}

export default async function Sora2VideoWatermarkRemovalPage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);
  const { data: chargeProduct } = await getChargeProduct(locale);

  return (
    <div>
      <Sora2VideoWatermarkRemoval locale={locale} chargeProduct={chargeProduct} />
    </div>
  );
}
