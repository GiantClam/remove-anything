import { Metadata } from "next";
import { getTranslations, unstable_setRequestLocale } from "next-intl/server";

import { buildSeoMetadata } from "@/lib/seo";
import { getMetadataBase } from "@/lib/utils";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "ContactPage" });

  return {
    metadataBase: getMetadataBase(),
    ...buildSeoMetadata({
      locale,
      path: "/contact",
      title: t("title"),
      description: t("description"),
    }),
  };
}

export default async function ContactPage({ params: { locale } }: PageProps) {
  unstable_setRequestLocale(locale);
  const isZhTw = locale === "zh-tw";

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="space-y-6">
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">
            {isZhTw ? "聯絡 Remove Anything" : "Contact Remove Anything"}
          </h1>
          <p className="text-lg text-muted-foreground">
            {isZhTw
              ? "如果你有支援、付款、功能回饋或合作相關問題，歡迎直接來信。"
              : "Reach out for support, billing questions, feature feedback, or partnership inquiries."}
          </p>
        </div>

        <section className="rounded-2xl border bg-background p-6">
          <h2 className="text-xl font-semibold">
            {isZhTw ? "支援信箱" : "Support email"}
          </h2>
          <p className="mt-3 text-muted-foreground">
            <a className="underline underline-offset-4" href="mailto:support@remove-anything.com">
              support@remove-anything.com
            </a>
          </p>
          <p className="mt-3 leading-7 text-muted-foreground">
            {isZhTw
              ? "一般問題、付款查詢與功能建議都可以寄到這個信箱。我們會依照問題類型盡快回覆。"
              : "Use this address for general support, billing questions, and product feedback. We will respond as quickly as we can based on request type."}
          </p>
        </section>
      </div>
    </div>
  );
}
