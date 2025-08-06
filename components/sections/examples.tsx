import { useTranslations } from "next-intl";
import { HeaderSection } from "@/components/shared/header-section";

export default function Examples() {
  const t = useTranslations("IndexPage");

  const examples = [
    {
      category: "Portraits",
      before: "/examples/portrait-before.jpg",
      after: "/examples/portrait-after.png",
      alt: "Portrait background removal example"
    },
    {
      category: "Products",
      before: "/examples/product-before.jpg",
      after: "/examples/product-after.png",
      alt: "Product background removal example"
    },
    {
      category: "Objects",
      before: "/examples/object-before.jpg",
      after: "/examples/object-after.png",
      alt: "Object background removal example"
    }
  ];

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <HeaderSection
          title={t("examples.title")}
          subtitle={t("examples.subtitle")}
        />

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mt-12">
          {examples.map((example, index) => (
            <div key={index} className="text-center">
              <h3 className="text-lg font-semibold mb-4">{example.category}</h3>
              <div className="relative">
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <span className="text-sm text-gray-500">Before</span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <span className="text-sm text-gray-500">After</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
