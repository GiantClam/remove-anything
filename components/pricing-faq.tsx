import { useTranslations } from "next-intl";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { pricingFaqItems } from "@/lib/pricing-faq";

import { HeaderSection } from "./shared/header-section";

export function PricingFaq() {
  const t = useTranslations("PricingPage");

  return (
    <section className="container max-w-4xl py-2">
      <HeaderSection
        title={t("faq.title")}
        subtitle={t("faq.subtitle")}
      />

      <Accordion type="single" collapsible className="my-12 w-full">
        {pricingFaqItems.map((faqItem) => (
          <AccordionItem key={faqItem.id} value={faqItem.id}>
            <AccordionTrigger>{t(`faq.${faqItem.questionKey}`)}</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground sm:text-[15px]">
              {t(`faq.${faqItem.answerKey}`)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
