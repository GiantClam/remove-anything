import { allPosts } from "contentlayer/generated";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";

import { BlogPosts } from "@/components/content/blog-posts";
import { getBlurDataURL } from "@/lib/utils";
import { locales, defaultLocale } from "@/config";
import { env } from "@/env.mjs";
import { constructAlternates } from "@/lib/seo";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale });
  
  return {
    title: `${t("BlogPage.title")} - ${t("LocaleLayout.title")}`,
    description: t("BlogPage.description"),
    alternates: constructAlternates({ locale, path: "/blog" }),
  };
}

export default async function BlogPage({ params: { locale } }: PageProps) {
  // 添加额外的安全检查
  const validPosts = allPosts.filter((post) => {
    return (
      post &&
      typeof post === 'object' &&
      post.published === true &&
      post.language === locale &&
      post.image &&
      typeof post.image === 'string' &&
      post.image.trim() !== '' &&
      post.title &&
      post.date
    );
  });

  if (validPosts.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">No blog posts available</h1>
        <p>There are no blog posts available for this language.</p>
      </div>
    );
  }

  const posts = await Promise.all(
    validPosts
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(async (post) => ({
        ...post,
        blurDataURL: await getBlurDataURL(post.image),
      })),
  );

  return <BlogPosts posts={posts} />;
}
