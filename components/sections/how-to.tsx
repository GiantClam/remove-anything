import { getTranslations } from "next-intl/server";
import { Upload, Download, Zap } from "lucide-react";
import { HeaderSection } from "@/components/shared/header-section";
import MaxWidthWrapper from "@/components/shared/max-width-wrapper";

export default async function HowTo() {
  const t = await getTranslations({ namespace: "IndexPage.howto" });

  const steps = [
    {
      icon: Upload,
      title: t("step1.title"),
      description: t("step1.description"),
    },
    {
      icon: Zap,
      title: t("step2.title"),
      description: t("step2.description"),
    },
    {
      icon: Download,
      title: t("step3.title"),
      description: t("step3.description"),
    },
  ];

  return (
    <section>
      <div className="pb-6 pt-4">
        <MaxWidthWrapper>
          <HeaderSection
            title={t("title")}
            subtitle={t("description")}
          />

          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            {steps.map((step, index) => (
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
                    <step.icon className="size-6" />
                  </div>

                  <h3 className="mt-6 text-lg font-semibold mb-2">
                    {step.title}
                  </h3>

                  <p className="pb-6 text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </MaxWidthWrapper>
      </div>
    </section>
  );
} 