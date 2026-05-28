import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Clock, Bell, ArrowRight } from "lucide-react";
import { Link } from "@/lib/navigation";
import { buildLocalizedPath, buildSeoMetadata } from "@/lib/seo";
import { getMetadataBase } from "@/lib/utils";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "RemoveObjectsPage" });

  return {
    metadataBase: getMetadataBase(),
    ...buildSeoMetadata({
      locale,
      path: "/remove-objects",
      title: t("title"),
      description: t("description"),
      keywords: t("keywords"),
      noIndex: true,
    }),
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
      <div className="mb-16 text-center">
        <div className="mb-8">
          <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-primary/10">
            <Clock className="size-12 text-primary" />
          </div>
          <h1 className="mb-6 text-4xl font-bold md:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="mx-auto mb-8 max-w-3xl text-xl text-muted-foreground">
            {t("hero.description")}
          </p>
        </div>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button size="lg" className="gap-2" disabled>
            <Clock className="size-5" />
            {t("hero.startButton")}
          </Button>
          <Link href={buildLocalizedPath(locale, "/pricing")}>
            <Button variant="outline" size="lg">
              {t("hero.pricingButton")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Coming Soon Features Preview */}
      <div className="mb-16">
        <h2 className="mb-12 text-center text-3xl font-bold">What's Coming Soon</h2>
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-6 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Clock className="size-8 text-primary" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Smart Recognition</h3>
            <p className="text-muted-foreground">
              AI automatically identifies objects to remove without manual boundary selection
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-6 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Clock className="size-8 text-primary" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Simple Operation</h3>
            <p className="text-muted-foreground">
              Just paint the area to remove, AI automatically completes the rest
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-6 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Clock className="size-8 text-primary" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">High Quality Output</h3>
            <p className="text-muted-foreground">
              Maintains original image quality with high-definition, watermark-free results
            </p>
          </div>
        </div>
      </div>

      {/* Coming Soon Use Cases */}
      <div className="mb-16">
        <h2 className="mb-12 text-center text-3xl font-bold">Future Use Cases</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-6">
            <h3 className="mb-3 text-xl font-semibold">Remove Tourists and Passersby</h3>
            <p className="mb-4 text-muted-foreground">
              Easily remove background tourists from photos taken at tourist attractions, making your photos more perfect.
            </p>
            <div className="text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 text-primary">
                <Clock className="size-4" />
                Coming Soon
              </span>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-6">
            <h3 className="mb-3 text-xl font-semibold">Remove Watermarks and Text</h3>
            <p className="mb-4 text-muted-foreground">
              Easily remove watermarks, text marks, or unwanted identifiers from images to protect your work.
            </p>
            <div className="text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 text-primary">
                <Clock className="size-4" />
                Coming Soon
              </span>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-6">
            <h3 className="mb-3 text-xl font-semibold">Clean Product Photos</h3>
            <p className="mb-4 text-muted-foreground">
              Create professional product photos for e-commerce platforms by removing background clutter and highlighting the main product.
            </p>
            <div className="text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 text-primary">
                <Clock className="size-4" />
                Coming Soon
              </span>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-6">
            <h3 className="mb-3 text-xl font-semibold">Restore Old Photos</h3>
            <p className="mb-4 text-muted-foreground">
              Repair creases, stains, or damaged areas in old photos, bringing precious memories back to life.
            </p>
            <div className="text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 text-primary">
                <Clock className="size-4" />
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="rounded-lg bg-primary/5 p-8 text-center">
        <h2 className="mb-4 text-2xl font-bold">{t("cta.title")}</h2>
        <p className="mb-6 text-muted-foreground">
          {t("cta.description")}
        </p>
        <Button size="lg" className="gap-2" disabled>
          <Bell className="size-5" />
          {t("cta.button")}
        </Button>
      </div>
    </div>
  );
}
