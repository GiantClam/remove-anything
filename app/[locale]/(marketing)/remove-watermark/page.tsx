import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Shield, Upload, Download, CheckCircle } from "lucide-react";
import { Link } from "@/lib/navigation";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "RemoveWatermarkPage" });

  return {
    title: t("title"),
    description: t("description"),
    keywords: t("keywords"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
    },
  };
}

export default async function RemoveWatermarkPage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          专业水印移除工具
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
          使用AI技术智能识别并移除图片中的水印、文字标记和标识。
          保护您的作品，让图片更加专业和美观。
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={`/${locale}/remove-background`}>
            <Button size="lg" className="gap-2">
              <Upload className="w-5 h-5" />
              开始移除水印
            </Button>
          </Link>
          <Link href={`/${locale}/pricing`}>
            <Button variant="outline" size="lg">
              查看定价
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
