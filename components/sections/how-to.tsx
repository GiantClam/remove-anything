import { getTranslations } from "next-intl/server";
import { Upload, Download, Zap } from "lucide-react";

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
    <section className="py-16 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">{t("title")}</h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t("description")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={index}
              className="text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm"
            >
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <step.icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
              <p className="text-gray-600 dark:text-gray-300">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
} 