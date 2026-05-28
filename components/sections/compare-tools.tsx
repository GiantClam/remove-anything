import { getLocale } from "next-intl/server";
import { ArrowRightLeft } from "lucide-react";
import NextLink from "next/link";

import { HeaderSection } from "@/components/shared/header-section";
import MaxWidthWrapper from "@/components/shared/max-width-wrapper";
import { getAlternativePage } from "@/lib/alternative-pages";
import { buildLocalizedPath } from "@/lib/seo";

const compareVariants = [
  "remove-bg-alternative",
  "photoroom-alternative",
  "pixelcut-alternative",
  "remove-anything-vs-remove-bg",
] as const;

export default async function CompareTools() {
  const locale = await getLocale();

  if (locale !== "en" && locale !== "zh-tw") {
    return null;
  }

  const isTw = locale === "zh-tw";

  return (
    <section className="py-6">
      <MaxWidthWrapper>
        <HeaderSection
          label={isTw ? "競品比較" : "Competitor comparisons"}
          title={
            isTw
              ? "看看 Remove Anything 與熱門替代方案相比如何"
              : "See how Remove Anything stacks up against popular alternatives"
          }
          subtitle={
            isTw
              ? "這些頁面聚焦高意圖 comparison 搜尋，幫助使用者快速判斷 Remove Anything 是否更適合自己的工作流。"
              : "These pages answer high-intent comparison queries and help buyers understand where Remove Anything fits best."
          }
        />

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {compareVariants.map((variant) => {
            const page = getAlternativePage(variant, locale);

            return (
              <NextLink
                key={page.path}
                href={buildLocalizedPath(locale, page.path)}
                className="group rounded-3xl border bg-background p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex size-12 items-center justify-center rounded-2xl border bg-muted/40">
                  <ArrowRightLeft className="size-5" />
                </div>
                <div className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {page.heroLabel}
                </div>
                <h3 className="mt-3 text-lg font-semibold">{page.heroTitle}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {page.metadataDescription}
                </p>
                <div className="mt-5 text-sm font-medium text-primary transition-colors group-hover:text-primary/80">
                  {isTw ? "立即比較 →" : "Compare now →"}
                </div>
              </NextLink>
            );
          })}
        </div>
      </MaxWidthWrapper>
    </section>
  );
}
