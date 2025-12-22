import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Clock, Bell, ArrowRight } from "lucide-react";
import { Link } from "@/lib/navigation";
import { constructAlternates } from "@/lib/seo";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "RemoveObjectsPage" });

  return {
    title: t("title"),
    description: t("description"),
    keywords: t("keywords"),
    alternates: constructAlternates({ locale, path: "/remove-objects" }),
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
    },
  };
}

export default async function RemoveObjectsPage({
  params: { locale },
}: PageProps) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "RemoveObjectsPage" });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <div className="mb-8">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            {t("hero.title")}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            {t("hero.description")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gap-2" disabled>
            <Clock className="w-5 h-5" />
            {t("hero.startButton")}
          </Button>
          <Link href={`/${locale}/pricing`}>
            <Button variant="outline" size="lg">
              {t("hero.pricingButton")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Coming Soon Features Preview */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-12">What's Coming Soon</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center p-6 border rounded-lg bg-muted/30">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Recognition</h3>
            <p className="text-muted-foreground">
              AI automatically identifies objects to remove without manual boundary selection
            </p>
          </div>
          <div className="text-center p-6 border rounded-lg bg-muted/30">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Simple Operation</h3>
            <p className="text-muted-foreground">
              Just paint the area to remove, AI automatically completes the rest
            </p>
          </div>
          <div className="text-center p-6 border rounded-lg bg-muted/30">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">High Quality Output</h3>
            <p className="text-muted-foreground">
              Maintains original image quality with high-definition, watermark-free results
            </p>
          </div>
        </div>
      </div>

      {/* Coming Soon Use Cases */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-12">Future Use Cases</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-6 border rounded-lg bg-muted/30">
            <h3 className="text-xl font-semibold mb-3">Remove Tourists and Passersby</h3>
            <p className="text-muted-foreground mb-4">
              Easily remove background tourists from photos taken at tourist attractions, making your photos more perfect.
            </p>
            <div className="text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 text-primary">
                <Clock className="w-4 h-4" />
                Coming Soon
              </span>
            </div>
          </div>
          <div className="p-6 border rounded-lg bg-muted/30">
            <h3 className="text-xl font-semibold mb-3">Remove Watermarks and Text</h3>
            <p className="text-muted-foreground mb-4">
              Easily remove watermarks, text marks, or unwanted identifiers from images to protect your work.
            </p>
            <div className="text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 text-primary">
                <Clock className="w-4 h-4" />
                Coming Soon
              </span>
            </div>
          </div>
          <div className="p-6 border rounded-lg bg-muted/30">
            <h3 className="text-xl font-semibold mb-3">Clean Product Photos</h3>
            <p className="text-muted-foreground mb-4">
              Create professional product photos for e-commerce platforms by removing background clutter and highlighting the main product.
            </p>
            <div className="text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 text-primary">
                <Clock className="w-4 h-4" />
                Coming Soon
              </span>
            </div>
          </div>
          <div className="p-6 border rounded-lg bg-muted/30">
            <h3 className="text-xl font-semibold mb-3">Restore Old Photos</h3>
            <p className="text-muted-foreground mb-4">
              Repair creases, stains, or damaged areas in old photos, bringing precious memories back to life.
            </p>
            <div className="text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 text-primary">
                <Clock className="w-4 h-4" />
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center p-8 bg-primary/5 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">{t("cta.title")}</h2>
        <p className="text-muted-foreground mb-6">
          {t("cta.description")}
        </p>
        <Button size="lg" className="gap-2" disabled>
          <Bell className="w-5 h-5" />
          {t("cta.button")}
        </Button>
      </div>
    </div>
  );
}
