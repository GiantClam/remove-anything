import { getLocale } from "next-intl/server";
import { ArrowRightLeft } from "lucide-react";
import NextLink from "next/link";

import { HeaderSection } from "@/components/shared/header-section";
import MaxWidthWrapper from "@/components/shared/max-width-wrapper";
import { alternativePages } from "@/lib/alternative-pages";
import { buildLocalizedPath } from "@/lib/seo";

const compareVariants = [
  "remove-bg-alternative",
  "photoroom-alternative",
  "pixelcut-alternative",
  "remove-anything-vs-remove-bg",
] as const;

export default async function CompareTools() {
  const locale = await getLocale();

  if (locale !== "en") {
    return null;
  }

  return (
    <section className="py-6">
      <MaxWidthWrapper>
        <HeaderSection
          label="Competitor comparisons"
          title="See how Remove Anything stacks up against popular alternatives"
          subtitle="These pages answer high-intent comparison queries and help buyers understand where Remove Anything fits best."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {compareVariants.map((variant) => {
            const page = alternativePages[variant];

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
                  Compare now →
                </div>
              </NextLink>
            );
          })}
        </div>
      </MaxWidthWrapper>
    </section>
  );
}
