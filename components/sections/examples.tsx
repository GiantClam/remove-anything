import { useTranslations } from "next-intl";
import { HeaderSection } from "@/components/shared/header-section";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";

export default function Examples() {
  const t = useTranslations("IndexPage");

  const examples = [
    {
      category: "Portraits",
      before: "/images/portrait_before.png",
      after: "/images/portrait_after.png",
      alt: "AI portrait background removal - professional headshot editing",
      description: "Perfect for profile photos and portraits"
    },
    {
      category: "Products",
      before: "/images/product_before.png",
      after: "/images/product_after.png",
      alt: "AI product background removal - e-commerce photo editing",
      description: "Ideal for e-commerce and product photography"
    },
    {
      category: "Objects",
      before: "/images/object_before.png",
      after: "/images/object_after.png",
      alt: "AI object background removal - clean object isolation",
      description: "Great for object isolation and editing"
    }
  ];

  return (
    <section className="py-16 bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4">
        <HeaderSection
          title={t("examples.title")}
          subtitle={t("examples.subtitle")}
        />

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mt-12">
          {examples.map((example, index) => (
            <div key={index} className="group">
              <div className="text-center mb-4">
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {example.category}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {example.description}
                </p>
              </div>
              
              <div className="relative bg-white dark:bg-gray-900 rounded-xl p-4 shadow-lg border border-border hover:shadow-xl transition-all duration-300">
                <div className="flex flex-col gap-4">
                  {/* Before Image */}
                  <div className="relative">
                    <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-border">
                      <Image
                        src={example.before}
                        alt={`${example.alt} - original image before AI processing`}
                        width={300}
                        height={225}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute top-2 left-2">
                        <Badge variant="secondary" className="bg-black/80 text-white border-0">
                          Before
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  {/* Arrow Indicator */}
                  <div className="flex justify-center">
                    <div className="bg-primary text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                      <span>AI Processing</span>
                      <span className="text-lg">↓</span>
                    </div>
                  </div>
                  
                  {/* After Image */}
                  <div className="relative">
                    <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-border">
                      <Image
                        src={example.after}
                        alt={`${example.alt} - processed result after AI background removal`}
                        width={300}
                        height={225}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute top-2 left-2">
                        <Badge variant="default" className="bg-green-600 border-0">
                          After
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                    AI Powered
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* 添加CTA按钮 */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            {t("examples.cta.description")}
          </p>
          <a
            href="/remove-background"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            {t("examples.cta.button")}
            <span className="text-lg">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
