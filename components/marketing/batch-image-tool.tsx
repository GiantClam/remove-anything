import dynamic from "next/dynamic";

import { Link } from "@/lib/navigation";
import {
  buildBreadcrumbListSchema,
  buildLocalizedUrl,
} from "@/lib/seo";
import {
  BatchImageToolCopy,
  BatchImageToolVariant,
  getBatchImageToolCopy,
  getRelatedBatchImageTools,
} from "@/lib/batch-image-tool-variants";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BatchImageToolClient = dynamic(
  () => import("./batch-image-tool-client"),
  {
    ssr: false,
    loading: () => <BatchImageToolInteractiveSkeleton />,
  },
);

interface BatchImageToolProps {
  locale: string;
  variant: BatchImageToolVariant;
}

function BatchImageToolInteractiveSkeleton() {
  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-dashed">
        <CardHeader>
          <div className="h-6 w-40 rounded bg-muted/60" />
          <div className="h-4 w-full rounded bg-muted/40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-44 rounded-2xl border border-dashed bg-muted/20" />
          <div className="h-14 rounded-xl border bg-muted/20" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="h-6 w-32 rounded bg-muted/60" />
          <div className="h-4 w-full rounded bg-muted/40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 rounded-md bg-muted/20" />
          <div className="h-10 rounded-md bg-muted/20" />
          <div className="h-12 rounded-md bg-muted/30" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-20 rounded-xl border bg-muted/20" />
            <div className="h-20 rounded-xl border bg-muted/20" />
            <div className="h-20 rounded-xl border bg-muted/20" />
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="h-6 w-36 rounded bg-muted/60" />
          <div className="h-4 w-full rounded bg-muted/40" />
        </CardHeader>
        <CardContent>
          <div className="h-44 rounded-2xl border border-dashed bg-muted/20" />
        </CardContent>
      </Card>
    </div>
  );
}

function buildSchemas(copy: BatchImageToolCopy, locale: string) {
  const pageUrl = buildLocalizedUrl(locale, copy.path);
  const [schemaName] = copy.metadataTitle.split(" - ");
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: schemaName?.trim() || copy.heroTitle,
    description: copy.metadataDescription,
    applicationCategory: "PhotoEditingApplication",
    operatingSystem: "Web",
    url: pageUrl,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: copy.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
  const breadcrumbSchema = buildBreadcrumbListSchema(locale, [
    { name: locale === "tw" ? "首頁" : "Home", path: "/" },
    { name: schemaName?.trim() || copy.heroTitle, path: copy.path },
  ]);

  return { softwareSchema, faqSchema, breadcrumbSchema };
}

export default function BatchImageTool({
  locale,
  variant,
}: BatchImageToolProps) {
  const copy = getBatchImageToolCopy(locale, variant);
  const relatedTools = getRelatedBatchImageTools(locale, variant);
  const { softwareSchema, faqSchema, breadcrumbSchema } = buildSchemas(copy, locale);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10 md:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div className="mx-auto max-w-3xl text-center">
        <Badge variant="secondary" className="mb-4">
          {copy.primaryCta}
        </Badge>
        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          {copy.heroTitle}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {copy.heroDescription}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {copy.secondaryCta}
        </p>
      </div>

      <BatchImageToolClient locale={locale} variant={variant} copy={copy} />

      <div className="mt-10 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>{copy.relatedToolsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {relatedTools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="block rounded-xl border p-4 transition-colors hover:bg-muted/40"
              >
                <p className="font-medium">{tool.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tool.description}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.faqTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              {copy.featureBullets.map((bullet) => (
                <div key={bullet} className="rounded-xl border bg-muted/20 p-4 text-sm">
                  {bullet}
                </div>
              ))}
            </div>

            <Accordion type="single" collapsible className="w-full">
              {copy.faqs.map((faq, index) => (
                <AccordionItem key={faq.question} value={`faq-${index}`}>
                  <AccordionTrigger>{faq.question}</AccordionTrigger>
                  <AccordionContent>{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
