import { CheckCircle2, ArrowRight } from "lucide-react";

import {
  getAlternativePage,
  type AlternativePageLocale,
  type AlternativePageVariant,
} from "@/lib/alternative-pages";
import { buildBreadcrumbListSchema, buildLocalizedUrl } from "@/lib/seo";
import { Link } from "@/lib/navigation";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AlternativeLandingProps {
  locale: string;
  variant: AlternativePageVariant;
}

function buildSchemas(locale: string, variant: AlternativePageVariant) {
  const page = getAlternativePage(variant, locale as AlternativePageLocale);

  return {
    faqSchema: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
    breadcrumbSchema: buildBreadcrumbListSchema(locale, [
      { name: locale === "zh-tw" ? "首頁" : "Home", path: "/" },
      { name: page.heroTitle, path: page.path },
    ]),
    webPageSchema: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: page.metadataTitle,
      description: page.metadataDescription,
      url: buildLocalizedUrl(locale, page.path),
    },
  };
}

export default function AlternativeLanding({
  locale,
  variant,
}: AlternativeLandingProps) {
  const page = getAlternativePage(variant, locale as AlternativePageLocale);
  const { faqSchema, breadcrumbSchema, webPageSchema } = buildSchemas(
    locale,
    variant,
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10 md:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <section className="mx-auto max-w-4xl text-center">
        <Badge variant="secondary" className="mb-4">
          {page.heroLabel}
        </Badge>
        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          {page.heroTitle}
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-lg text-muted-foreground">
          {page.heroDescription}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link href={page.primaryCtaHref}>
              {page.primaryCtaLabel}
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={page.secondaryCtaHref}>
              {page.secondaryCtaLabel}
            </Link>
          </Button>
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{page.verdict.title}</CardTitle>
            <CardDescription>{page.verdict.description}</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{page.whySwitchTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {page.whySwitchBullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                <p className="text-sm text-muted-foreground">{bullet}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-10">
        <CardHeader>
          <CardTitle>{page.comparisonTitle}</CardTitle>
          <CardDescription>{page.comparisonDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Remove Anything</TableHead>
                <TableHead>{page.competitorName}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.comparisonRows.map((row) => (
                <TableRow key={row.feature}>
                  <TableCell className="font-medium">{row.feature}</TableCell>
                  <TableCell>{row.removeAnything}</TableCell>
                  <TableCell>{row.competitor}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        {page.bestForColumns.map((column) => (
          <Card key={column.title}>
            <CardHeader>
              <CardTitle>{column.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {column.bullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                  <p className="text-sm text-muted-foreground">{bullet}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>{page.relatedToolsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {page.relatedTools.map((tool) => (
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
            <CardTitle>{page.faqTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {page.faqItems.map((item, index) => (
                <AccordionItem key={item.question} value={`faq-${index}`}>
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
