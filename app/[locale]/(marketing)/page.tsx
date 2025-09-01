import { unstable_setRequestLocale } from "next-intl/server";
import Script from "next/script";

import Examples from "@/components/sections/examples";
import Features from "@/components/sections/features";
import HeroLanding from "@/components/sections/hero-landing";
import PricingCard from "@/components/sections/pricing-card";
import HowTo from "@/components/sections/how-to";
import UseCases from "@/components/sections/use-cases";
import QuickAccess from "@/components/sections/quick-access";
import { env } from "@/env.mjs";

type Props = {
  params: { locale: string };
};

export default function IndexPage({ params: { locale } }: Props) {
  // Enable static rendering
  unstable_setRequestLocale(locale);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Remove Anything - All-in-One AI Image Eraser",
    "description": "Smart eraser tool that easily removes any flaws from photos. AI-powered, just paint to precisely remove people, objects, text, and blemishes from images.",
    "url": env.NEXT_PUBLIC_SITE_URL,
    "applicationCategory": "MultimediaApplication",
    "operatingSystem": "Any",
    "permissions": "browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "featureList": [
      "AI-powered object removal",
      "Person removal from photos",
      "Watermark removal",
      "Text removal from images",
      "Background removal",
      "High-quality results",
      "Fast processing",
      "Free to use",
      "No sign-up required",
      "Batch processing available"
    ],
    "screenshot": `${env.NEXT_PUBLIC_SITE_URL}/og.png`,
    "softwareVersion": "1.0",
    "author": {
      "@type": "Organization",
      "name": "Remove Anything",
      "url": env.NEXT_PUBLIC_SITE_URL
    }
  };

  return (
    <>
      <Script
        id="structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData)
        }}
      />
      <HeroLanding />
      <QuickAccess />
      <Examples />
      <Features />
      <HowTo />
      <UseCases />
      <PricingCard locale={locale} />
    </>
  );
}
