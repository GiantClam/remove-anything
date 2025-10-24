import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";
import WatermarkRemoval from "@/components/watermark-removal";
import { getChargeProduct } from "@/db/queries/charge-product";
import { locales, defaultLocale } from "@/config";
import { env } from "@/env.mjs";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "RemoveWatermarkPage" });

  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const path = "/remove-watermark";

  return {
    title: t("title"),
    description: t("description"),
    keywords: t("keywords"),
    alternates: {
      canonical: `${base}${locale === defaultLocale ? "" : `/${locale}`}${path}`,
      languages: {
        "x-default": `${base}${path}`,
        ...Object.fromEntries(
          locales.map((loc) => [
            loc,
            `${base}${loc === defaultLocale ? "" : `/${loc}`}${path}`,
          ])
        ),
      },
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
    },
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
