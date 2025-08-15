import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Eraser, ArrowLeft } from "lucide-react";
import { Link } from "@/lib/navigation";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  return {
    title: "手把手教你如何从集体照中P掉前男友/前女友 - Remove Anything",
    description: "学习如何使用AI工具轻松从照片中移除不需要的人物。本教程将教你如何从集体照、旅游照片中移除路人、前男友或前女友，让照片更加完美。",
    keywords: "如何从照片中移除人物, 移除前男友, 移除前女友, 移除路人, 集体照编辑, AI图片编辑, 在线P图工具",
  };
}

export default async function HowToRemovePeoplePage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8">
        <Link href={`/${locale}/blog`}>
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回博客
          </Button>
        </Link>
      </div>

      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          手把手教你如何从集体照中P掉前男友/前女友
        </h1>
        <p className="text-xl text-muted-foreground leading-relaxed">
          你是否有一张完美的集体照，但里面有一个你不想看到的人？
          本教程将教你如何使用AI工具轻松从照片中移除不需要的人物，
          让珍贵的回忆更加完美。
        </p>
      </header>

      <article className="prose prose-lg max-w-none">
        <h2>为什么需要从照片中移除人物？</h2>
        <p>
          生活中总会有一些尴尬的时刻，比如集体照中有前男友或前女友，
          旅游照片中出现了不认识的游客，或者重要场合的照片中有不速之客。
        </p>

        <h2>AI时代的解决方案</h2>
        <p>
          随着AI技术的发展，现在有了更简单、更智能的解决方案。
          Remove Anything 使用先进的AI算法，可以自动识别人物轮廓，
          智能填充背景，让移除效果更加自然。
        </p>

        <h2>如何使用Remove Anything移除人物</h2>
        
        <h3>第一步：上传照片</h3>
        <p>
          访问 Remove Anything，点击"开始抹除"按钮，上传包含要移除人物的照片。
          支持JPG、PNG、WebP等常见格式。
        </p>

        <h3>第二步：标记要移除的区域</h3>
        <p>
          使用涂抹工具标记要移除的人物区域。AI会自动识别人物轮廓，
          你只需要大致涂抹即可，无需精确选择边界。
        </p>

        <h3>第三步：AI自动处理</h3>
        <p>
          点击"开始处理"，AI会自动分析图片，识别人物区域，
          智能填充背景，保持图片的自然效果。
        </p>

        <h3>第四步：下载结果</h3>
        <p>
          处理完成后，下载处理后的图片。结果完全免费，无水印，
          保持原始图片的高清质量。
        </p>

        <h2>总结</h2>
        <p>
          使用AI工具从照片中移除人物已经变得非常简单。
          Remove Anything让这项技术变得人人可用，
          无需专业技能，只需几个简单的步骤就能完成。
        </p>
      </article>

      <div className="mt-16 p-8 bg-primary/5 rounded-lg text-center">
        <h2 className="text-2xl font-bold mb-4">准备好开始了吗？</h2>
        <p className="text-muted-foreground mb-6">
          立即体验AI人物移除的强大功能，让您的照片更加完美
        </p>
        <Link href={`/${locale}/remove-background`}>
          <Button size="lg" className="gap-2">
            <Eraser className="w-5 h-5" />
            免费开始使用
          </Button>
        </Link>
      </div>
    </div>
  );
}
