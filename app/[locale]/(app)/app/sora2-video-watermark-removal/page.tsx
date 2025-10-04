import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { constructMetadata } from "@/lib/utils";
import { Locale } from "@/config";
import Sora2VideoWatermarkRemoval from "@/components/sora2-video-watermark-removal";

interface PageProps {
  params: { locale: Locale };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Sora2VideoWatermarkRemovalPage" });
  return constructMetadata({
    title: t("title"),
    description: t("description"),
  });
}

export default async function Sora2VideoWatermarkRemovalPage({ params: { locale } }: PageProps) {
  return <Sora2VideoWatermarkRemoval locale={locale} />;
}


