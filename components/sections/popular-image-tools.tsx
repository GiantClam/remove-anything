"use client";

import NextLink from "next/link";
import { HeaderSection } from "@/components/shared/header-section";
import MaxWidthWrapper from "@/components/shared/max-width-wrapper";
import { trackEvent } from "@/lib/gtag";
import { buildLocalizedPath } from "@/lib/seo";
import { getToolDiscoveryContent } from "@/lib/tool-discovery-content";

interface PopularImageToolsProps {
  locale: string;
}

export default function PopularImageTools({
  locale,
}: PopularImageToolsProps) {
  const content = getToolDiscoveryContent(locale);

  return (
    <section className="py-6">
      <MaxWidthWrapper>
        <HeaderSection
          label={content.homepageLabel}
          title={content.homepageTitle}
          subtitle={content.homepageSubtitle}
        />

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {content.featuredTools.map((tool) => (
            <NextLink
              key={tool.href}
              href={buildLocalizedPath(locale, tool.href)}
              className="group rounded-3xl border bg-background p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
              onClick={() =>
                trackEvent("homepage_tool_card_clicked", {
                  tool_href: tool.href,
                  tool_title: tool.title,
                })
              }
            >
              <div className="flex size-12 items-center justify-center rounded-2xl border bg-muted/40">
                <tool.icon className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{tool.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {tool.description}
              </p>
              <div className="mt-5 text-sm font-medium text-primary transition-colors group-hover:text-primary/80">
                {locale === "tw" ? "立即使用" : "Open tool"} →
              </div>
            </NextLink>
          ))}
        </div>
      </MaxWidthWrapper>
    </section>
  );
}
