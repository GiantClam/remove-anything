import { Metadata } from "next";
import { notFound } from "next/navigation";

import { allPosts } from "contentlayer/generated";
import { getTranslations } from "next-intl/server";

import { BlogCard } from "@/components/content/blog-card";
import { BLOG_CATEGORIES } from "@/config/blog";
import { constructMetadata, getBlurDataURL } from "@/lib/utils";

export async function generateStaticParams() {
  return BLOG_CATEGORIES.map((category) => ({
    slug: category.slug,
  }));
}
interface PageProps {
  params: { locale: string; slug: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata | undefined> {
  const category = BLOG_CATEGORIES.find(
    (category) => category.slug === params.slug,
  );
  if (!category) {
    return;
  }
  const t = await getTranslations({ locale: params.locale });

  const { title, description } = category;

  return constructMetadata({
    title: `${title} Posts - ${t("LocaleLayout.title")}`,
    description,
  });
}

export default async function BlogCategory({
  params,
}: {
  params: {
    slug: string;
    locale: string;
  };
}) {
  const category = BLOG_CATEGORIES.find((ctg) => ctg.slug === params.slug);

  if (!category) {
    notFound();
  }

  // 添加额外的安全检查
  const validPosts = allPosts.filter((post) => {
    return (
      post &&
      typeof post === 'object' &&
      post.categories &&
      Array.isArray(post.categories) &&
      post.categories.includes(category.slug) &&
      post.language === params.locale &&
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
        <h1 className="text-2xl font-bold mb-4">No posts in this category</h1>
        <p>There are no blog posts available in this category for this language.</p>
      </div>
    );
  }

  const articles = await Promise.all(
    validPosts
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(async (post) => ({
        ...post,
        blurDataURL: await getBlurDataURL(post.image),
      })),
  );

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article, idx) => (
        <BlogCard key={article._id} data={article} priority={idx <= 2} />
      ))}
    </div>
  );
}
