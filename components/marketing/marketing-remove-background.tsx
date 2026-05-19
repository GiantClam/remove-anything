import dynamic from "next/dynamic";
import { getTranslations } from "next-intl/server";
import { AlertCircle, ArrowRight, CheckCircle, LogIn, Sparkles } from "lucide-react";

import { env } from "@/env.mjs";
import { Link } from "@/lib/navigation";
import {
  getBackgroundToolCopy,
  getRelatedBackgroundTools,
  type BackgroundToolVariant,
} from "@/lib/background-tool-variants";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const MarketingRemoveBackgroundClient = dynamic(
  () => import("./marketing-remove-background-client"),
  {
    ssr: false,
    loading: () => <MarketingRemoveBackgroundInteractiveSkeleton />,
  },
);

interface MarketingRemoveBackgroundProps {
  locale: string;
  variant?: BackgroundToolVariant;
}

function MarketingRemoveBackgroundInteractiveSkeleton() {
  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="h-6 w-40 rounded bg-muted/60" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="mx-auto h-64 max-w-2xl rounded-2xl border border-dashed bg-muted/20" />
        <div className="mx-auto h-[520px] max-w-[520px] rounded-2xl border bg-muted/20" />
      </CardContent>
    </Card>
  );
}

function buildSchemas(locale: string, path: string, metadataTitle: string, metadataDescription: string, schemaCategory: string, faqItems: Array<{ question: string; answer: string }>) {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const pageUrl = `${base}/${locale}${path}`;
  const [schemaName] = metadataTitle.split(" - ");

  return {
    softwareSchema: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: schemaName?.trim() || metadataTitle,
      description: metadataDescription,
      applicationCategory: schemaCategory,
      operatingSystem: "Web",
      url: pageUrl,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    faqSchema: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  };
}

export default async function MarketingRemoveBackground({
  locale,
  variant = "remove-background",
}: MarketingRemoveBackgroundProps) {
  const tPage = await getTranslations({ locale, namespace: "RemoveBackgroundPage" });
  const toolCopy = getBackgroundToolCopy(locale, variant);
  const relatedTools = getRelatedBackgroundTools(locale, variant);
  const { softwareSchema, faqSchema } = buildSchemas(
    locale,
    toolCopy.path,
    toolCopy.metadataTitle,
    toolCopy.metadataDescription,
    toolCopy.schemaCategory,
    toolCopy.faqItems,
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <script
        id={`${variant}-software-structured-data`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        id={`${variant}-faq-structured-data`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <MarketingRemoveBackgroundClient locale={locale} variant={variant} />

      <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-3">
        <Card>
          <CardHeader className="text-center">
            <Sparkles className="mx-auto mb-2 size-8 text-primary" />
            <CardTitle className="text-lg">{tPage("aiPowered")}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <CardDescription>{tPage("aiPoweredDesc")}</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CheckCircle className="mx-auto mb-2 size-8 text-primary" />
            <CardTitle className="text-lg">{tPage("hairLevelPrecision")}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <CardDescription>{tPage("hairLevelPrecisionDesc")}</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <AlertCircle className="mx-auto mb-2 size-8 text-primary" />
            <CardTitle className="text-lg">{tPage("freeTrial")}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <CardDescription>{tPage("freeTrialDesc")}</CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{toolCopy.useCasesTitle}</CardTitle>
          <CardDescription className="mx-auto max-w-3xl text-base">
            {toolCopy.useCasesDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {toolCopy.useCases.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border bg-muted/20 p-5 text-left"
              >
                <div className="mb-3 inline-flex rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                  {item.title}
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8 border-green-200 bg-gradient-to-r from-green-50 to-blue-50">
        <CardHeader className="text-center">
          <CardTitle className="mb-2 text-2xl text-green-800">{toolCopy.stepsTitle}</CardTitle>
          <CardDescription className="text-lg text-green-700">
            {toolCopy.stepsDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {toolCopy.steps.map((step, index) => (
              <div key={step.title} className="rounded-2xl bg-white/70 p-5 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-lg font-bold text-green-700">
                  {index + 1}
                </div>
                <h3 className="mb-2 text-base font-semibold text-green-900">{step.title}</h3>
                <p className="text-sm leading-6 text-green-800">{step.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{toolCopy.faqTitle}</CardTitle>
          <CardDescription>{toolCopy.faqDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {toolCopy.faqItems.map((item, index) => (
              <AccordionItem key={item.question} value={`faq-${index}`}>
                <AccordionTrigger className="text-left">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-6 text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{toolCopy.relatedToolsTitle}</CardTitle>
          <CardDescription>{toolCopy.relatedToolsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {relatedTools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="rounded-xl border p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <div className="mb-2 text-base font-semibold">{tool.title}</div>
                <p className="text-sm text-muted-foreground">{tool.description}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>{toolCopy.primaryBlogTitle}</CardTitle>
          <CardDescription>{toolCopy.primaryBlogDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={toolCopy.primaryBlogHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            {locale === "tw" ? "閱讀詳細教學" : "Read the detailed guide"}
            <ArrowRight className="size-4" />
          </Link>
        </CardContent>
      </Card>

      <Card className="text-center">
        <CardHeader>
          <CardTitle>{tPage("readyToGetStarted")}</CardTitle>
          <CardDescription>{tPage("signUpFreeDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="flex items-center gap-2">
              <Link href={`/${locale}/signin`}>
                <LogIn className="size-4" />
                {tPage("getStartedFree")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={`/${locale}/pricing`}>
                {tPage("viewPricing")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
