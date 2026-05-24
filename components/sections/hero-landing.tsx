import { getLocale, getTranslations } from "next-intl/server";
import NextLink from "next/link";

import { Icons } from "@/components/shared/icons";
import { buttonVariants } from "@/components/ui/button";
import { buildLocalizedPath } from "@/lib/seo";
import { cn } from "@/lib/utils";

import AnimatedGradientText from "../magicui/animated-gradient-text";

export default async function HeroLanding() {
  const locale = await getLocale();
  const t = await getTranslations({ namespace: "IndexPage" });

  return (
    <section className="space-y-6 py-12 sm:py-20 lg:py-20">
      <div className="container flex max-w-5xl flex-col items-center gap-5 text-center">
        <AnimatedGradientText>
          <span className="mr-3">🎉</span>
          <span
            className={cn(
              `inline animate-gradient bg-gradient-to-r from-[#ffaa40] via-[#9c40ff] to-[#ffaa40] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent`,
            )}
          >
            {t("intro")}
          </span>
        </AnimatedGradientText>

        <h1 className="text-balance font-urban text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-[66px]">
          <span className="text-gradient_indigo-purple font-extrabold">{t("title")}</span>
        </h1>

        <p className="max-w-3xl text-balance text-lg font-medium text-foreground/80 sm:text-2xl">
          {t("subtitle")}
        </p>

        <p
          className="max-w-2xl text-balance leading-normal text-muted-foreground sm:text-xl sm:leading-8"
          style={{ animationDelay: "0.35s", animationFillMode: "forwards" }}
        >
          {t("description")}
        </p>

        <div
          className="flex flex-col justify-center space-y-4 md:flex-row md:space-x-4 md:space-y-0"
          style={{ animationDelay: "0.4s", animationFillMode: "forwards" }}
        >
          <NextLink
            href={buildLocalizedPath(locale, "/pricing")}
            className={cn(
              buttonVariants({
                variant: "outline",
                size: "lg",
              }),
              "min-w-34 rounded-full px-5",
            )}
          >
            <p>{t("action.pricing")}</p>
            <Icons.arrowRight className="ml-2 size-4" />
          </NextLink>
          {/* 添加"看看别人移除效果"按钮，锚点到瀑布流 */}
          <a
            href="#examples-gallery"
            className={cn(
              buttonVariants({
                variant: "default",
                size: "lg",
              }),
              "min-w-34 rounded-full px-5",
            )}
          >
            <p>{t("seeOthers")}</p>
            <Icons.arrowRight className="ml-2 size-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
