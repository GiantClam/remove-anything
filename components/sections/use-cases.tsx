import { getTranslations } from "next-intl/server";
import { ShoppingCart, Megaphone, Camera, Heart } from "lucide-react";

export default async function UseCases() {
  const t = await getTranslations({ namespace: "IndexPage.usecases" });

  const useCases = [
    {
      icon: ShoppingCart,
      title: t("ecommerce.title"),
      description: t("ecommerce.description"),
    },
    {
      icon: Megaphone,
      title: t("marketing.title"),
      description: t("marketing.description"),
    },
    {
      icon: Camera,
      title: t("photography.title"),
      description: t("photography.description"),
    },
    {
      icon: Heart,
      title: t("personal.title"),
      description: t("personal.description"),
    },
  ];

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">{t("title")}</h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t("description")}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {useCases.map((useCase, index) => (
            <div
              key={index}
              className="text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <useCase.icon className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{useCase.title}</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                {useCase.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
} 