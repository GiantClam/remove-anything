"use client";

import { ArrowRight, Wand2 } from "lucide-react";

import { trackEvent } from "@/lib/gtag";
import { Link } from "@/lib/navigation";

interface BlogToolCtaProps {
  href: string;
  title: string;
  description?: string;
  locale: string;
}

export function BlogToolCta({
  href,
  title,
  description,
  locale,
}: BlogToolCtaProps) {
  return (
    <div className="my-10 rounded-2xl border bg-muted/20 p-6 md:p-8">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border bg-background">
          <Wand2 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            {locale === "tw" ? "相关工具" : "Recommended tool"}
          </p>
          <h3 className="mt-2 text-xl font-semibold">{title}</h3>
          {description ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
          <Link
            href={href}
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            onClick={() =>
              trackEvent("blog_tool_cta_clicked", {
                tool_href: href,
                tool_title: title,
              })
            }
          >
            {locale === "tw" ? "打开这个工具" : "Open this tool"}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
