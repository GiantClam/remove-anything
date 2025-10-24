import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";

import BatchRemoveBackground from "@/components/batch-remove-background";
import { locales, defaultLocale } from "@/config";
import { env } from "@/env.mjs";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "BatchRemoveBackgroundPage" });

  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const path = "/batch-remove-background";

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
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
  };
}

export default async function BatchRemoveBackgroundPage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);

  return <BatchRemoveBackground locale={locale} />;
}
