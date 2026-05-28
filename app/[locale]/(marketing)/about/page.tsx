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
  const t = await getTranslations({ locale, namespace: "AboutPage" });

  return {
    metadataBase: getMetadataBase(),
    ...buildSeoMetadata({
      locale,
      path: "/about",
      title: t("title"),
      description: t("description"),
    }),
  };
}

export default async function AboutPage({ params: { locale } }: PageProps) {
  unstable_setRequestLocale(locale);
  const isZhTw = locale === "zh-tw";

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="space-y-6">
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">
            {isZhTw ? "關於 Remove Anything" : "About Remove Anything"}
          </h1>
          <p className="text-lg text-muted-foreground">
            {isZhTw
              ? "Remove Anything 專注於 AI 圖片清理工作流，幫助你更快完成去背景、物件擦除、水印清理與後續整理。"
              : "Remove Anything is built for practical AI image cleanup workflows, from background removal to object cleanup, watermark editing, and export-ready follow-up tools."}
          </p>
        </div>

        <section className="rounded-2xl border bg-background p-6">
          <h2 className="text-xl font-semibold">
            {isZhTw ? "我們想解決的問題" : "What we are solving"}
          </h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            {isZhTw
              ? "許多圖片工具只解決單一步驟，但真實工作流往往需要去背景、輸出透明 PNG、壓縮、改尺寸、轉格式與批量處理。Remove Anything 目標是把這些關鍵步驟整合成更順手的流程。"
              : "Most image tools solve one isolated task. Real-world workflows usually need cleanup, transparent exports, resizing, compression, format conversion, and batch follow-up. Remove Anything brings those steps closer together."}
          </p>
        </section>

        <section className="rounded-2xl border bg-background p-6">
          <h2 className="text-xl font-semibold">
            {isZhTw ? "適合誰使用" : "Who it is for"}
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>{isZhTw ? "需要快速整理商品圖的電商團隊" : "E-commerce teams preparing product imagery"}</li>
            <li>{isZhTw ? "要處理社群素材與廣告圖片的行銷人員" : "Marketers shipping social, ad, and campaign assets"}</li>
            <li>{isZhTw ? "需要乾淨輸出的設計與內容工作者" : "Creators and designers who need clean, export-ready visuals"}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
