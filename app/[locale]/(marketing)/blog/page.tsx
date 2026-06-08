import { allPosts } from "contentlayer/generated";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";

import { BlogPosts } from "@/components/content/blog-posts";
import {
  buildBreadcrumbListSchema,
  buildLocalizedUrl,
  buildSeoMetadata,
} from "@/lib/seo";
import { getBlurDataURL, getMetadataBase } from "@/lib/utils";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale });
  const hasPosts = allPosts.some((post) => post.published && post.language === locale);
  const availableLocales = Array.from(
    new Set(allPosts.filter((post) => post.published).map((post) => post.language)),
  );
  
  return {
    metadataBase: getMetadataBase(),
    ...buildSeoMetadata({
      locale,
      path: "/blog",
      title: `${t("BlogPage.title")} | Remove Anything`,
      description: t("BlogPage.description"),
      availableLocales,
      noIndex: !hasPosts,
    }),
  };
}

export default async function BlogPage({ params: { locale } }: PageProps) {
  const t = await getTranslations({ locale });
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
        <h1 className="mb-4 text-2xl font-bold">No blog posts available</h1>
        <p>There are no blog posts available for this language.</p>
      </div>
    );
  }

  const sortedPosts = [...validPosts].sort((a, b) => b.date.localeCompare(a.date));
  const pageUrl = buildLocalizedUrl(locale, "/blog");
  const breadcrumbSchema = buildBreadcrumbListSchema(locale, [
    { name: locale === "zh-tw" ? "首頁" : "Home", path: "/" },
    { name: t("BlogPage.title"), path: "/blog" },
  ]);
  const blogCollectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t("BlogPage.title"),
    description: t("BlogPage.description"),
    url: pageUrl,
    isPartOf: {
      "@type": "WebSite",
      name: "Remove Anything",
      url: buildLocalizedUrl(locale, "/"),
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: sortedPosts.slice(0, 12).map((post, index) => {
        const slug = post.slugAsParams.split("/").slice(1).join("/");

        return {
          "@type": "ListItem",
          position: index + 1,
          url: buildLocalizedUrl(locale, `/blog/${slug}`),
          name: post.title,
        };
      }),
    },
  };
  const posts = await Promise.all(
    sortedPosts.map(async (post) => ({
      ...post,
      blurDataURL: await getBlurDataURL(post.image),
    })),
  );

  return (
    <>
      <script
        id="blog-collection-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogCollectionSchema) }}
      />
      <script
        id="blog-breadcrumb-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <BlogPosts posts={posts} />
    </>
  );
}
