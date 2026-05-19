"use client";
import { useSelectedLayoutSegment } from "next/navigation";
import dynamic from "next/dynamic";

import { useTranslations } from "next-intl";

import { Icons } from "@/components/shared/icons";
import MaxWidthWrapper from "@/components/shared/max-width-wrapper";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { dashboardConfig } from "@/config/dashboard";
import { docsConfig } from "@/config/docs";
import { marketingConfig, marketingToolGroups } from "@/config/marketing";
import { useScroll } from "@/hooks/use-scroll";
import { Link, usePathname } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const UserInfo = dynamic(
  () => import("../user-info").then((mod) => ({ default: mod.UserInfo })),
  {
    ssr: false,
    loading: () => <div className="h-10 w-24 rounded-full bg-muted/50" />,
  },
);

interface NavBarProps {
  scroll?: boolean;
  large?: boolean;
}

export function NavbarLogo(props: { size?: "sm" | "md" | "lg" | "xl" }) {
  const t = useTranslations("Navigation");
  const { size = "xl" } = props;
  const textSizeClass =
    {
      sm: "md:text-sm",
      md: "md:text-md",
      lg: "md:text-lg",
      xl: "md:text-xl",
    }[size] ?? "md:text-xl";

  return (
    <Link href="/" className="flex items-center space-x-2">
      <Icons.logo className="hidden size-6 md:block" />
      <span className={cn("font-urban text-xs font-bold", textSizeClass)}>
        {t("title")}
      </span>
    </Link>
  );
}

export function NavbarUserInfo() {
  return (
    <div className="flex items-center space-x-3">
      <UserInfo />
    </div>
  );
}

export function NavBar({ scroll = false }: NavBarProps) {
  const scrolled = useScroll(50);
  const t = useTranslations("Navigation");
  const selectedLayout = useSelectedLayoutSegment();
  const pathname = usePathname();
  const dashBoard = selectedLayout === "app";
  const blog = selectedLayout === "(blog)";
  const documentation = selectedLayout === "docs";
  const links = documentation
    ? docsConfig.mainNav
      : dashBoard
      ? dashboardConfig.mainNav
      : marketingConfig.mainNav;
  const isMarketing = !documentation && !dashBoard;
  const toolHrefs = marketingToolGroups.flatMap((group) =>
    group.items.map((item) => item.href),
  );
  const toolsActive = toolHrefs.some((href) => pathname === href);

  return (
    <header
      className={`sticky top-0 z-40 flex w-full justify-center bg-background/60 pr-9 backdrop-blur-xl transition-all md:pr-0 ${
        scroll ? (scrolled ? "border-b" : "bg-transparent") : "border-b"
      }`}
    >
      <MaxWidthWrapper
        className="flex h-14 items-center justify-between py-4"
        large={documentation}
      >
        <div className="flex gap-6 md:gap-10">
          <NavbarLogo />

          {links && links.length > 0 ? (
            <nav className="hidden gap-6 md:flex">
              {links.map((item, index) => (
                <Link
                  key={index}
                  href={item.disabled ? "#" : item.href}
                  prefetch={true}
                  className={cn(
                    "flex items-center text-lg font-medium transition-colors hover:text-foreground/80 sm:text-sm",
                    item.href.startsWith(`/${selectedLayout}`) ||
                      (item.href === "/blog" && blog)
                      ? "text-foreground"
                      : "text-foreground/60",
                    item.disabled && "cursor-not-allowed opacity-80",
                  )}
                >
                  {t(item.title)}
                </Link>
              ))}
              {isMarketing ? (
                <NavigationMenu>
                  <NavigationMenuList>
                    <NavigationMenuItem>
                      <NavigationMenuTrigger
                        className={cn(
                          "h-auto bg-transparent p-0 text-lg font-medium hover:bg-transparent focus:bg-transparent sm:text-sm",
                          toolsActive ? "text-foreground" : "text-foreground/60",
                        )}
                      >
                        {t("tools")}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <div className="grid w-[660px] gap-4 p-4 md:grid-cols-3">
                          {marketingToolGroups.map((group) => (
                            <div key={group.title} className="space-y-2">
                              <p className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                {t(group.title)}
                              </p>
                              <div className="space-y-1">
                                {group.items.map((item) => (
                                  <NavigationMenuLink key={item.href} asChild>
                                    <Link
                                      href={item.href}
                                      className={cn(
                                        "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                                        pathname === item.href
                                          ? "bg-accent/50 text-foreground"
                                          : "text-foreground/80",
                                      )}
                                    >
                                      {t(item.title)}
                                    </Link>
                                  </NavigationMenuLink>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  </NavigationMenuList>
                </NavigationMenu>
              ) : null}
            </nav>
          ) : null}
        </div>

        <NavbarUserInfo />
      </MaxWidthWrapper>
    </header>
  );
}
