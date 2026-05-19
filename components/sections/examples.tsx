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
  // 优先从公开 URL 拉取（Vercel 环境稳定），失败时再回退到 fs
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (base) {
    try {
      const res = await fetch(`${base}/data/examples.json`, { next: { revalidate: 3600 } });
      if (res.ok) return (await res.json()) as ExampleItem[];
    } catch {}
  }
  try {
    const { promises: fs } = await import("fs");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "public", "data", "examples.json");
    const fileContents = await fs.readFile(filePath, "utf8");
    return JSON.parse(fileContents) as ExampleItem[];
  } catch {
    return [];
  }
}

export default async function Examples() {
  const t = await getTranslations({ namespace: "IndexPage" });
  const examples = await loadExamples();

  return (
    <section className="bg-gradient-to-b from-background to-muted/20 py-16">
      <div className="container mx-auto px-4">
        <HeaderSection
          title={t("examples.title")}
          subtitle={t("examples.subtitle")}
        />

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-8" id="examples-gallery">
          {examples.map((example, index) => (
            <div key={example.id} className="group">
              <div className="mb-4 text-center">
                <h3 className="mb-2 text-xl font-semibold text-foreground">
                  {example.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {example.description}
                </p>
              </div>
              
              <div className="relative rounded-xl border border-border bg-white p-4 shadow-lg transition-all duration-300 hover:shadow-xl dark:bg-gray-900">
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <div className="aspect-square overflow-hidden rounded-lg border border-border bg-gray-100 dark:bg-gray-800">
                      <Image
                        src={example.before}
                        alt={example.altBefore}
                        width={200}
                        height={200}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading={index === 0 ? "eager" : "lazy"}
                        decoding="async"
                        fetchPriority={index === 0 ? "high" : "low"}
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                      <div className="absolute left-2 top-2">
                        <Badge variant="secondary" className="border-0 bg-black/80 text-white">
                          Before
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <div className="aspect-square overflow-hidden rounded-lg border border-border bg-gray-100 dark:bg-gray-800">
                      {example.videoMp4 || example.videoWebm ? (
                        <video
                          className="size-full object-cover"
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
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading={index === 0 ? "eager" : "lazy"}
                          decoding="async"
                          fetchPriority={index === 0 ? "high" : "low"}
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      )}
                      <div className="absolute left-2 top-2">
                        <Badge variant="default" className="border-0 bg-green-600">
                          After
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                    <span className="size-2 animate-pulse rounded-full bg-primary"></span>
                    AI Powered
                  </div>
                </div>
                
                {/* 箭头指示 */}
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="rounded-full bg-primary px-2 py-1 text-xs font-bold text-white">
                    →
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-12 text-center">
          <p className="mb-4 text-muted-foreground">
            {t("examples.cta.description")}
          </p>
          <a
            href="/remove-background"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("examples.cta.button")}
            <span className="text-lg">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
