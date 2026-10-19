import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";
import type { Locale } from "@/config";
import RemoveObjects from "@/components/remove-objects/index";
import { ToolViewTracker } from "@/components/analytics/tool-view-tracker";
import { buildSeoMetadata } from "@/lib/seo";
import { getToolRegistryEntry } from "@/lib/tool-registry";
import { getMetadataBase } from "@/lib/utils";
import ToolContractDetails from "@/components/marketing/tool-contract-details";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "RemoveObjectsPage" });
  const tool = getToolRegistryEntry("remove-objects");

  if (!tool) {
    throw new Error("Missing remove-objects tool registry entry");
  }

  return {
    metadataBase: getMetadataBase(),
    ...buildSeoMetadata({
      locale,
      path: tool.canonicalPath,
      title: t("title"),
      description: t("description"),
      keywords: tool.primaryKeyword,
      availableLocales: tool.availableLocales,
      noIndex: !tool.indexable,
    }),
  };
}

export default async function RemoveObjectsPage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);
  return (
    <>
      <ToolViewTracker toolSlug="remove-objects" locale={locale} />
      <RemoveObjects locale={locale} />
      <div className="container mx-auto max-w-6xl px-4 pb-8">
        <ToolContractDetails locale={locale as Locale} toolSlug="remove-objects" />
      </div>
    </>
  );
}
