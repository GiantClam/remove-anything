import { getTranslations, unstable_setRequestLocale } from "next-intl/server";

import History from "@/components/history";
import { getMetadataBase } from "@/lib/utils";

interface PageProps {
  params: { locale: string };
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params: { locale },
}: PageProps) {
  const t = await getTranslations({ locale, namespace: "History" });

  return {
    metadataBase: getMetadataBase(),
    title: t("title"),
    description: t("description"),
  };
}



export default function PlaygroundPage({ params: { locale } }: PageProps) {
  unstable_setRequestLocale(locale);

  return <History locale={locale} />;
}
