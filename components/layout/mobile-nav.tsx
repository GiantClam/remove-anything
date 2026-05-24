"use client";

import { useEffect, useState } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import dynamic from "next/dynamic";
import NextLink from "next/link";

import { Menu, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Icons } from "@/components/shared/icons";
import { dashboardConfig } from "@/config/dashboard";
import { docsConfig } from "@/config/docs";
import { marketingConfig, marketingToolGroups } from "@/config/marketing";
import { siteConfig } from "@/config/site";
import { buildLocalizedPath } from "@/lib/seo";
import { cn } from "@/lib/utils";

import { ModeToggle } from "./mode-toggle";

const UserInfo = dynamic(
  () => import("../user-info").then((mod) => ({ default: mod.UserInfo })),
  {
    ssr: false,
    loading: () => <div className="h-10 w-full rounded-md bg-muted/40" />,
  },
);

export function NavMobile() {
  const t = useTranslations("Navigation");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const selectedLayout = useSelectedLayoutSegment();
  const dashBoard = selectedLayout === "app";
  const documentation = selectedLayout === "docs";
  const isMarketing = !documentation && !dashBoard;
  const links = documentation
    ? docsConfig.mainNav
      : dashBoard
      ? dashboardConfig.mainNav
      : marketingConfig.mainNav;
  const localizeHref = (href: string) =>
    href.startsWith("/") ? buildLocalizedPath(locale, href) : href;

  // prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed right-2 top-2.5 z-50 rounded-full p-2 transition-colors duration-200 hover:bg-muted focus:outline-none active:bg-muted md:hidden",
          open && "hover:bg-muted active:bg-muted",
        )}
      >
        {open ? (
          <X className="size-5 text-muted-foreground" />
        ) : (
          <Menu className="size-5 text-muted-foreground" />
        )}
      </button>

      <nav
        className={cn(
          "fixed inset-0 z-20 hidden w-full overflow-auto bg-background px-5 py-16 lg:hidden",
          open && "block",
        )}
      >
        <ul className="grid divide-y divide-muted">
          {links.map(({ title, href }) => (
            <li key={href} className="py-3">
              <NextLink
                href={localizeHref(href)}
                onClick={() => setOpen(false)}
                className="flex w-full font-medium capitalize"
              >
                {t(title)}
              </NextLink>
            </li>
          ))}

          {isMarketing ? (
            <li className="py-3">
              <div className="space-y-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("tools")}
                </p>
                {marketingToolGroups.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <p className="text-sm font-medium text-foreground/70">
                      {t(group.title)}
                    </p>
                    <div className="grid gap-2 pl-3">
                      {group.items.map((item) => (
                        <NextLink
                          key={item.href}
                          href={localizeHref(item.href)}
                          onClick={() => setOpen(false)}
                          className="text-sm text-foreground/80"
                        >
                          {t(item.title)}
                        </NextLink>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </li>
          ) : null}

          <UserInfo />
        </ul>

        <div className="mt-5 flex items-center justify-end space-x-4">
          <NextLink href={siteConfig.links.github} target="_blank" rel="noreferrer">
            <Icons.gitHub className="size-6" />
            <span className="sr-only">GitHub</span>
          </NextLink>
          <ModeToggle />
        </div>
      </nav>
    </>
  );
}
