import { getTranslations } from "next-intl/server";
import { Eraser, Shield, Users, Image } from "lucide-react";
import { Link } from "@/lib/navigation";
import { HeaderSection } from "@/components/shared/header-section";
import MaxWidthWrapper from "@/components/shared/max-width-wrapper";

export default async function QuickAccess() {
  const t = await getTranslations({ namespace: "QuickAccess" });

  const features = [
    {
      icon: Eraser,
      title: t("backgroundRemoval.title"),
      description: t("backgroundRemoval.description"),
      href: "/remove-background",
      color: "bg-blue-500",
    },
    {
      icon: Users,
      title: t("objectRemoval.title"),
      description: t("objectRemoval.description"),
      href: "/remove-objects",
      color: "bg-green-500",
    },
    {
      icon: Shield,
      title: t("watermarkRemoval.title"),
      description: t("watermarkRemoval.description"),
      href: "/remove-watermark",
      color: "bg-purple-500",
    },
    {
      icon: Image,
      title: t("batchProcessing.title"),
      description: t("batchProcessing.description"),
      href: "/app/batch-remove-background",
      color: "bg-orange-500",
    },
  ];

  return (
    <section>
      <div className="pb-6 pt-4">
        <MaxWidthWrapper>
          <HeaderSection
            title={t("title")}
            subtitle={t("subtitle")}
          />

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                className="group relative overflow-hidden rounded-2xl border bg-background p-5 md:p-8"
                key={index}
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-0 aspect-video -translate-y-1/2 rounded-full border bg-gradient-to-b from-purple-500/80 to-white opacity-25 blur-2xl duration-300 group-hover:-translate-y-1/4 dark:from-white dark:to-white dark:opacity-5 dark:group-hover:opacity-10"
                />
                <div className="relative">
                  <div className="relative flex size-12 rounded-2xl border border-border shadow-sm *:relative *:m-auto *:size-6">
                    <feature.icon className="size-6" />
                  </div>

                  <h3 className="mt-6 text-lg font-semibold mb-2">
                    {feature.title}
                  </h3>

                  <p className="pb-6 text-muted-foreground">
                    {feature.description}
                  </p>

                  <div className="-mb-5 flex gap-3 border-t border-muted py-4 md:-mb-7">
                    <Link
                      href={feature.href}
                      className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      {t("useNow")} →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </MaxWidthWrapper>
      </div>
    </section>
  );
}
