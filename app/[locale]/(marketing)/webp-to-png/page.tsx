import { Metadata } from "next";
import { unstable_setRequestLocale } from "next-intl/server";

import BatchImageTool from "@/components/marketing/batch-image-tool";
import { getBatchImageToolCopy } from "@/lib/batch-image-tool-variants";
import { constructAlternates } from "@/lib/seo";
import { getMetadataBase } from "@/lib/utils";

interface PageProps {
  params: {
    locale: string;
  };
}

export async function generateMetadata({
  params: { locale },
}: PageProps): Promise<Metadata> {
  const copy = getBatchImageToolCopy(locale, "webp-to-png");

  return {
    metadataBase: getMetadataBase(),
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    keywords: copy.metadataKeywords,
    alternates: constructAlternates({ locale, path: copy.path }),
    openGraph: {
      title: copy.metadataTitle,
      description: copy.metadataDescription,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: copy.metadataTitle,
      description: copy.metadataDescription,
    },
  };
}

export default function WebpToPngPage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);

  return <BatchImageTool locale={locale} variant="webp-to-png" />;
}
