"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import { Icons } from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Locale, locales } from "@/config";
import { usePathname, useRouter } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const pathname = usePathname();
  const params = useParams();
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const changeLocale = (nextLocale: Locale) => {
    startTransition(() => {
      router.replace(
        {
          pathname,
          // @ts-expect-error -- TypeScript will validate that only known `params`
          // are used in combination with a given `pathname`. Since the two will
          // always match for the current route, we can skip runtime checks.
          params,
        },
        { locale: nextLocale },
      );
    });
  };

  // 使用一致的基础按钮，避免HTML结构差异
  const buttonContent = (
    <Button variant="ghost" size="sm" className="size-8 px-0">
      <Icons.Languages className="rotate-0 scale-100 transition-all" />
      <span className="sr-only">{isClient ? t("label") : "Language"}</span>
    </Button>
  );

  // 服务器端：只渲染按钮，无交互
  if (!isClient) {
    return (
      <div className="flex h-full items-center justify-center">
        {buttonContent}
      </div>
    );
  }

  // 客户端：渲染完整的DropdownMenu
  return (
    <div className="flex h-full items-center justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {buttonContent}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {locales.map((cur) => (
            <DropdownMenuItem
              disabled={isPending}
              key={cur}
              onClick={() => changeLocale(cur)}
            >
              <span>{t("locale", { locale: cur })}</span>
              {locale === cur && (
                <Icons.CheckIcon
                  className={cn("ml-auto h-4 w-4 opacity-100")}
                />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
