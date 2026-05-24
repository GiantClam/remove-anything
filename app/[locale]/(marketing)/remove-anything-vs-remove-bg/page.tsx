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
import { constructAlternates } from "@/lib/seo";
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
    "remove-anything-vs-remove-bg",
    resolvedLocale,
  );

  return {
    metadataBase: getMetadataBase(),
    title: page.metadataTitle,
    description: page.metadataDescription,
    keywords: page.metadataKeywords,
    alternates: constructAlternates({
      locale: resolvedLocale,
      path: page.path,
      availableLocales: [...alternativePageLocales],
    }),
    openGraph: {
      title: page.metadataTitle,
      description: page.metadataDescription,
      type: "website",
    },
  };
}

export default function RemoveAnythingVsRemoveBgPage({
  params: { locale },
}: PageProps) {
  if (!alternativePageLocales.includes(locale as AlternativePageLocale)) {
    notFound();
  }

  unstable_setRequestLocale(locale);

  return (
    <AlternativeLanding locale={locale} variant="remove-anything-vs-remove-bg" />
  );
}
