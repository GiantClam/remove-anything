import { unstable_setRequestLocale } from "next-intl/server";

import Examples from "@/components/sections/examples";
import Features from "@/components/sections/features";
import HeroLanding from "@/components/sections/hero-landing";
import PricingCard from "@/components/sections/pricing-card";
import HowTo from "@/components/sections/how-to";
import UseCases from "@/components/sections/use-cases";
import FAQWrapper from "@/components/sections/faq-wrapper";

type Props = {
  params: { locale: string };
};

export default function IndexPage({ params: { locale } }: Props) {
  // Enable static rendering
  unstable_setRequestLocale(locale);

  return (
    <>
      <HeroLanding />
      <Features />
      <Examples />
      <HowTo />
      <UseCases />
      <FAQWrapper />
      <PricingCard locale={locale} />
    </>
  );
}
