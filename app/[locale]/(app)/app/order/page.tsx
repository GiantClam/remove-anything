import { getTranslations, unstable_setRequestLocale } from "next-intl/server";

import { OrderInfo } from "@/components/order-info";
import { getMetadataBase } from "@/lib/utils";

interface PageProps {
  params: { locale: string };
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params: { locale },
}: PageProps) {
  const t = await getTranslations({ locale, namespace: "Orders" });

  return {
    metadataBase: getMetadataBase(),
    title: t("title"),
    description: t("description"),
  };
}

export default async function BillingPage({ params: { locale } }: PageProps) {
  unstable_setRequestLocale(locale);

  return <OrderInfo />;
}
