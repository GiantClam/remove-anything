import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";
import RemoveObjects from "@/components/remove-objects/index";
import { buildSeoMetadata } from "@/lib/seo";
import { getMetadataBase } from "@/lib/utils";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "RemoveObjectsPage" });

  return {
    metadataBase: getMetadataBase(),
    ...buildSeoMetadata({
      locale,
      path: "/remove-objects",
      title: t("title"),
      description: t("description"),
      keywords: t("keywords"),
      noIndex: false,
    }),
  };
}

export default async function RemoveObjectsPage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);
  return <RemoveObjects locale={locale} />;
}
