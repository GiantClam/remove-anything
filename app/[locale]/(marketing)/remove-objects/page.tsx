import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Eraser, Upload, Download } from "lucide-react";
import { Link } from "@/lib/navigation";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "RemoveObjectsPage" });

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

export default async function RemoveObjectsPage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          智能物体移除工具
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
          使用先进的AI技术，轻松从照片中移除任何不需要的物体、人物或瑕疵。
          无需专业技能，涂抹即可完成。
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={`/remove-background`}>
            <Button size="lg" className="gap-2">
              <Upload className="w-5 h-5" />
              开始移除物体
            </Button>
          </Link>
          <Link href={`/${locale}/pricing`}>
            <Button variant="outline" size="lg">
              查看定价
            </Button>
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="text-center p-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Eraser className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">智能识别</h3>
          <p className="text-muted-foreground">
            AI自动识别要移除的物体，无需手动选择边界
          </p>
        </div>
        <div className="text-center p-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">简单操作</h3>
          <p className="text-muted-foreground">
            只需涂抹要移除的区域，AI自动完成剩余工作
          </p>
        </div>
        <div className="text-center p-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Download className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">高清输出</h3>
          <p className="text-muted-foreground">
            保持原始图片质量，输出高清无水印结果
          </p>
        </div>
      </div>

      {/* Use Cases */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-12">应用场景</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-3">移除游客和路人</h3>
            <p className="text-muted-foreground mb-4">
              在旅游景点拍摄的照片中，轻松移除背景中的游客，让您的照片更加完美。
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• 自动识别人物轮廓</li>
              <li>• 智能填充背景</li>
              <li>• 保持自然效果</li>
            </ul>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-3">移除水印和文字</h3>
            <p className="text-muted-foreground mb-4">
              轻松移除图片中的水印、文字标记或不需要的标识，保护您的作品。
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• 精确识别文字区域</li>
              <li>• 智能背景重建</li>
              <li>• 无痕迹移除</li>
            </ul>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-3">清理产品照片</h3>
            <p className="text-muted-foreground mb-4">
              为电商平台创建专业的产品照片，移除背景杂物，突出产品主体。
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• 专业级抠图效果</li>
              <li>• 批量处理支持</li>
              <li>• 电商专用优化</li>
            </ul>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-3">修复旧照片</h3>
            <p className="text-muted-foreground mb-4">
              修复老照片中的折痕、污点或损坏区域，让珍贵的回忆重现光彩。
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• 智能污点识别</li>
              <li>• 自然修复效果</li>
              <li>• 保持历史感</li>
            </ul>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center p-8 bg-primary/5 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">准备好开始了吗？</h2>
        <p className="text-muted-foreground mb-6">
          立即体验AI物体移除的强大功能，让您的照片更加完美
        </p>
        <Link href={`/remove-background`}>
          <Button size="lg" className="gap-2">
            <Eraser className="w-5 h-5" />
            免费开始使用
          </Button>
        </Link>
      </div>
    </div>
  );
}
