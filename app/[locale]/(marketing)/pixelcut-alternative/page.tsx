import { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_setRequestLocale } from "next-intl/server";

import AlternativeLanding from "@/components/marketing/alternative-landing";
import { defaultLocale } from "@/config";
import {
  alternativePageLocales,
  getAlternativePage,
  type AlternativePageLocale,
} from "@/lib/alternative-pages";
import { buildSeoMetadata } from "@/lib/seo";
import { getMetadataBase } from "@/lib/utils";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: PageProps): Promise<Metadata> {
  const resolvedLocale = alternativePageLocales.includes(
    locale as AlternativePageLocale,
  )
    ? (locale as AlternativePageLocale)
    : defaultLocale;
  const page = getAlternativePage(
    "pixelcut-alternative",
    resolvedLocale,
  );

  return {
    metadataBase: getMetadataBase(),
    ...buildSeoMetadata({
      locale: resolvedLocale,
      path: page.path,
      title: page.metadataTitle,
      description: page.metadataDescription,
      keywords: page.metadataKeywords,
      availableLocales: [...alternativePageLocales],
    }),
  };
}

export default function PixelcutAlternativePage({
  params: { locale },
}: PageProps) {
  if (!alternativePageLocales.includes(locale as AlternativePageLocale)) {
    notFound();
  }

  unstable_setRequestLocale(locale);

  return <AlternativeLanding locale={locale} variant="pixelcut-alternative" />;
}
