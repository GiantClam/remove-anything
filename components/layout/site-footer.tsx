import * as React from "react";

import { getLocale, getTranslations } from "next-intl/server";

import { ModeToggle } from "@/components/layout/mode-toggle";
import { Link } from "@/lib/navigation";
import { getToolDiscoveryContent } from "@/lib/tool-discovery-content";
import { cn } from "@/lib/utils";

import NewsletterForm from "../forms/newsletter-form";
import { Icons } from "../shared/icons";

export async function SiteFooter({ className }: React.HTMLAttributes<HTMLElement>) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "PageLayout" });
  const quickAccess = await getTranslations({ locale, namespace: "QuickAccess" });
  const discovery = getToolDiscoveryContent(locale);
  
  return (
    <footer
      className={cn(
        "container border-t",
        "w-full p-6 pb-4 md:py-12",
        className,
      )}
    >
      <div className="flex max-w-7xl flex-col items-center justify-end gap-6 text-sm md:items-start md:justify-between">
        <div className="space-y-3 text-center md:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {discovery.footerTitle}
          </p>
          <div className="flex flex-col gap-3 md:flex-row md:gap-8">
            {discovery.footerGroups.map((group) => (
              <div key={group.title}>
                <p className="mb-2 text-sm font-medium">{group.title}</p>
                <div className="flex flex-wrap items-center justify-center gap-4 md:justify-start">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="underline-offset-4 hover:underline"
                      prefetch={false}
                      title={link.title}
                    >
                      {link.title}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/remove-background"
            className="underline-offset-4 hover:underline"
            prefetch={false}
            title={quickAccess("backgroundRemoval.title")}
          >
            {quickAccess("backgroundRemoval.title")}
          </Link>
          <Link
            href="/remove-objects"
            className="underline-offset-4 hover:underline"
            prefetch={false}
            title={quickAccess("objectRemoval.title")}
          >
            {quickAccess("objectRemoval.title")}
          </Link>
          <Link
            href="/remove-watermark"
            className="underline-offset-4 hover:underline"
            prefetch={false}
            title={quickAccess("watermarkRemoval.title")}
          >
            {quickAccess("watermarkRemoval.title")}
          </Link>
          <Link
            href="/terms-of-use"
            className="underline-offset-4 hover:underline"
            prefetch={false}
            title={t("footer.term")}
          >
            {t("footer.term")}
          </Link>
          <Link
            href="/privacy-policy"
            className="underline-offset-4 hover:underline"
            prefetch={false}
            title={t("footer.privacy")}
          >
            {t("footer.privacy")}
          </Link>
          <Link
            href="mailto:support@remove-anything.com"
            className="underline-offset-4 hover:underline"
            prefetch={false}
            title={t("footer.contact")}
          >
            {t("footer.contact")}
          </Link>
          <ModeToggle />
        </div>
      </div>
      <div className="mt-4 flex max-w-7xl flex-col items-center justify-between gap-4 text-sm md:flex-row">
        <div className="flex items-center gap-2">
          <Icons.logo className="h-6 w-6" />
                      <span className="font-medium">Remove Anything Inc.</span>
        </div>
      </div>
      <div className="mt-4 flex max-w-7xl flex-col items-center justify-center gap-4 text-sm md:flex-row">
        <p className="text-muted-foreground">
          &copy; 2024 Remove Anything. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
