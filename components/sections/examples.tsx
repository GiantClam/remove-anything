import { getTranslations } from "next-intl/server";
import { HeaderSection } from "@/components/shared/header-section";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";

interface ExampleItem {
  id: string;
  title: string;
  before: string;
  after: string;
  poster?: string;
  videoMp4?: string;
  videoWebm?: string;
  altBefore: string;
  altAfter: string;
  description: string;
}

async function loadExamples(): Promise<ExampleItem[]> {
  try {
    const { promises: fs } = await import("fs");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "public", "data", "examples.json");
    const fileContents = await fs.readFile(filePath, "utf8");
    return JSON.parse(fileContents) as ExampleItem[];
  } catch (e) {
    console.error("examples: fs load failed", e);
    return [];
  }
}

export default async function Examples() {
  const t = await getTranslations({ namespace: "IndexPage" });
  const examples = await loadExamples();

  return (
    <section className="py-16 bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4">
        <HeaderSection
          title={t("examples.title")}
          subtitle={t("examples.subtitle")}
        />

        <div className="grid grid-cols-1 gap-8 max-w-4xl mx-auto mt-12" id="examples-gallery">
          {examples.map((example, index) => (
            <div key={example.id} className="group">
              <div className="text-center mb-4">
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {example.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {example.description}
                </p>
              </div>
              
              <div className="relative bg-white dark:bg-gray-900 rounded-xl p-4 shadow-lg border border-border hover:shadow-xl transition-all duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-border">
                      <Image
                        src={example.before}
                        alt={example.altBefore}
                        width={200}
                        height={200}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading={index === 0 ? "eager" : "lazy"}
                        decoding="async"
                        fetchPriority={index === 0 ? "high" : "low"}
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                      <div className="absolute top-2 left-2">
                        <Badge variant="secondary" className="bg-black/80 text-white border-0">
                          Before
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-border">
                      {example.videoMp4 || example.videoWebm ? (
                        <video
                          className="w-full h-full object-cover"
                          poster={example.poster}
                          playsInline
                          muted
                          loop
                          preload="metadata"
                          autoPlay
                        >
                          {example.videoWebm && <source src={example.videoWebm} type="video/webm" />}
                          {example.videoMp4 && <source src={example.videoMp4} type="video/mp4" />}
                        </video>
                      ) : (
                        <Image
                          src={example.after}
                          alt={example.altAfter}
                          width={200}
                          height={200}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading={index === 0 ? "eager" : "lazy"}
                          decoding="async"
                          fetchPriority={index === 0 ? "high" : "low"}
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      )}
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
                
                {/* 箭头指示 */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="bg-primary text-white px-2 py-1 rounded-full text-xs font-bold">
                    →
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
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
