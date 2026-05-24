import { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_setRequestLocale } from "next-intl/server";

import AlternativeLanding from "@/components/marketing/alternative-landing";
import { defaultLocale } from "@/config";
import { getAlternativePage } from "@/lib/alternative-pages";
import { constructAlternates } from "@/lib/seo";
import { getMetadataBase } from "@/lib/utils";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: PageProps): Promise<Metadata> {
  const page = getAlternativePage("remove-anything-vs-remove-bg");

  return {
    metadataBase: getMetadataBase(),
    title: page.metadataTitle,
    description: page.metadataDescription,
    keywords: page.metadataKeywords,
    alternates: constructAlternates({
      locale: defaultLocale,
      path: page.path,
      availableLocales: [defaultLocale],
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
  if (locale !== defaultLocale) {
    notFound();
  }

  unstable_setRequestLocale(locale);

  return (
    <AlternativeLanding locale={locale} variant="remove-anything-vs-remove-bg" />
  );
}
