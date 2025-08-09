import { getTranslations, unstable_setRequestLocale } from "next-intl/server";

import BillingsInfo from "@/components/billing-info";

interface PageProps {
  params: { locale: string };
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params: { locale },
}: PageProps) {
  return {
    title: "App - Dashboard",
    description: "View your account dashboard and billing information",
  };
}
export default async function DashboardPage({ params: { locale } }: PageProps) {
  unstable_setRequestLocale(locale);

  return <BillingsInfo />;
}
