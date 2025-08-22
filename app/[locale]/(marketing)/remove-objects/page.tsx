import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Eraser, Upload, Download } from "lucide-react";
import { Link } from "@/lib/navigation";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "RemoveObjectsPage" });

  return {
    title: t("title"),
    description: t("description"),
    keywords: t("keywords"),
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
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          {t("hero.title")}
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
          {t("hero.description")}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={`/${locale}/remove-background`}>
            <Button size="lg" className="gap-2">
              <Upload className="w-5 h-5" />
              {t("hero.startButton")}
            </Button>
          </Link>
          <Link href={`/${locale}/pricing`}>
            <Button variant="outline" size="lg">
              {t("hero.pricingButton")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="text-center p-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Eraser className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">{t("features.smartRecognition.title")}</h3>
          <p className="text-muted-foreground">
            {t("features.smartRecognition.description")}
          </p>
        </div>
        <div className="text-center p-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">{t("features.simpleOperation.title")}</h3>
          <p className="text-muted-foreground">
            {t("features.simpleOperation.description")}
          </p>
        </div>
        <div className="text-center p-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Download className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">{t("features.highQuality.title")}</h3>
          <p className="text-muted-foreground">
            {t("features.highQuality.description")}
          </p>
        </div>
      </div>

      {/* Use Cases */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-12">{t("useCases.title")}</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-3">{t("useCases.touristRemoval.title")}</h3>
            <p className="text-muted-foreground mb-4">
              {t("useCases.touristRemoval.description")}
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• {t("useCases.touristRemoval.benefit1")}</li>
              <li>• {t("useCases.touristRemoval.benefit2")}</li>
              <li>• {t("useCases.touristRemoval.benefit3")}</li>
            </ul>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-3">{t("useCases.watermarkRemoval.title")}</h3>
            <p className="text-muted-foreground mb-4">
              {t("useCases.watermarkRemoval.description")}
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• {t("useCases.watermarkRemoval.benefit1")}</li>
              <li>• {t("useCases.watermarkRemoval.benefit2")}</li>
              <li>• {t("useCases.watermarkRemoval.benefit3")}</li>
            </ul>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-3">{t("useCases.productPhoto.title")}</h3>
            <p className="text-muted-foreground mb-4">
              {t("useCases.productPhoto.description")}
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• {t("useCases.productPhoto.benefit1")}</li>
              <li>• {t("useCases.productPhoto.benefit2")}</li>
              <li>• {t("useCases.productPhoto.benefit3")}</li>
            </ul>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-3">{t("useCases.photoRestoration.title")}</h3>
            <p className="text-muted-foreground mb-4">
              {t("useCases.photoRestoration.description")}
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• {t("useCases.photoRestoration.benefit1")}</li>
              <li>• {t("useCases.photoRestoration.benefit2")}</li>
              <li>• {t("useCases.photoRestoration.benefit3")}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center p-8 bg-primary/5 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">{t("cta.title")}</h2>
        <p className="text-muted-foreground mb-6">
          {t("cta.description")}
        </p>
        <Link href={`/${locale}/remove-background`}>
          <Button size="lg" className="gap-2">
            <Eraser className="w-5 h-5" />
            {t("cta.button")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
