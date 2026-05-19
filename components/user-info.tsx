"use client";

import React from "react";
import { usePathname } from "next/navigation";

import { SignedIn, SignedOut, SignInButton } from "@/components/auth/auth-components";
import { UserButton } from "@/components/auth/user-button";
import { useAuth } from "@/hooks/use-auth";
import { useTranslations } from "next-intl";

import { GoogleBrandIcon, UserArrowLeftIcon } from "@/assets";
import ShimmerButton from "@/components/forms/shimmer-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "@/lib/navigation";

import { LocaleSwitcher } from "./layout/locale-switcher";

export function UserInfo() {
  const t = useTranslations("Navigation");
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const pathname = usePathname();
  const { user } = useAuth();
  const StrategyIcon = React.useMemo(() => {
    // Since we're using Google OAuth through NextAuth, always show Google icon
    if (user) {
      return GoogleBrandIcon;
    }
    return null;
  }, [user]);

  // 避免framer-motion在服务器端和客户端行为不一致
  if (!isClient) {
    return (
      <div>
        <SignedIn>
          <div className="flex items-center space-x-3">
            <LocaleSwitcher />
            <div className="pointer-events-auto relative flex h-10 items-center">
              <UserButton
                afterSignOutUrl={pathname}
                appearance={{
                  elements: {
                    avatarBox: "w-9 h-9 ring-2 ring-white/20",
                  },
                }}
              />
              {StrategyIcon && (
                <span className="pointer-events-none absolute -bottom-1 -right-1 flex size-4 select-none items-center justify-center rounded-full bg-white dark:bg-zinc-900">
                  <StrategyIcon className="size-3" />
                </span>
              )}
            </div>
            {!pathname?.includes("app") && (
              <Link href="/app" className="size-full">
                <ShimmerButton>
                  <span className="whitespace-pre-wrap text-center text-sm font-medium leading-none tracking-tight text-white dark:from-white dark:to-slate-900/10">
                    {t("dashboard")}
                  </span>
                </ShimmerButton>
              </Link>
            )}
          </div>
        </SignedIn>
        <SignedOut>
          <div className="flex items-center space-x-3">
            <LocaleSwitcher />
            <div className="pointer-events-auto">
              <SignInButton
                mode="modal"
                forceRedirectUrl={pathname}
              >
                <button
                  type="button"
                  className="group h-10 rounded-full bg-gradient-to-b from-zinc-50/50 to-white/90 px-3 text-sm shadow-lg shadow-zinc-800/5 ring-1 ring-zinc-900/5 backdrop-blur transition dark:from-zinc-900/50 dark:to-zinc-800/90 dark:ring-white/10 dark:hover:ring-white/20"
                >
                  <UserArrowLeftIcon className="size-5" />
                </button>
              </SignInButton>
            </div>
          </div>
        </SignedOut>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning>
      <SignedIn>
        <div className="flex items-center space-x-3">
          <LocaleSwitcher />
          <div className="pointer-events-auto relative flex h-10 items-center">
            <UserButton
              afterSignOutUrl={pathname}
              appearance={{
                elements: {
                  avatarBox: "w-9 h-9 ring-2 ring-white/20",
                },
              }}
            />
            {StrategyIcon ? (
              <span className="pointer-events-none absolute -bottom-1 -right-1 flex size-4 select-none items-center justify-center rounded-full bg-white dark:bg-zinc-900">
                <StrategyIcon className="size-3" />
              </span>
            ) : null}
          </div>
          {!pathname?.includes("app") ? (
            <Link href="/app" className="size-full">
              <ShimmerButton>
                <span className="whitespace-pre-wrap text-center text-sm font-medium leading-none tracking-tight text-white dark:from-white dark:to-slate-900/10">
                  {t("dashboard")}
                </span>
              </ShimmerButton>
            </Link>
          ) : null}
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex items-center space-x-3">
          <LocaleSwitcher />
          <div className="pointer-events-auto">
            <TooltipProvider>
              <Tooltip>
                <SignInButton
                  mode="modal"
                  forceRedirectUrl={pathname}
                >
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="group h-10 rounded-full bg-gradient-to-b from-zinc-50/50 to-white/90 px-3 text-sm shadow-lg shadow-zinc-800/5 ring-1 ring-zinc-900/5 backdrop-blur transition dark:from-zinc-900/50 dark:to-zinc-800/90 dark:ring-white/10 dark:hover:ring-white/20"
                    >
                      <UserArrowLeftIcon className="size-5" />
                    </button>
                  </TooltipTrigger>
                </SignInButton>

                <TooltipContent>
                  {t("tooltip.login")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </SignedOut>
    </div>
  );
}
