import { getTranslations, unstable_setRequestLocale } from "next-intl/server";

import DashboardHome from "@/components/dashboard-home";

interface PageProps {
  params: { locale: string };
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params: { locale },
}: PageProps) {
  return {
    title: "App - Dashboard",
    description: "View your account dashboard and recent activities",
  };
}

export default async function DashboardPage({ params: { locale } }: PageProps) {
  unstable_setRequestLocale(locale);

  return <DashboardHome locale={locale} />;
}
