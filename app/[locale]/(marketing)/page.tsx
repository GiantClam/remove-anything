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
    "name": "Remove Anything - AI智能抠图工具",
    "alternateName": "Remove Anything",
    "description": "免费AI抠图工具，智能去除背景、物体、水印。3秒自动处理，支持批量编辑，永久保存。",
    "url": env.NEXT_PUBLIC_SITE_URL,
    "applicationCategory": "MultimediaApplication",
    "applicationSubCategory": "Photo Editor",
    "operatingSystem": "Any",
    "browserRequirements": "Requires JavaScript. Requires HTML5.",
    "permissions": "browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "priceValidUntil": "2026-12-31"
    },
    "featureList": [
      "AI智能抠图",
      "一键去除背景",
      "物体智能擦除",
      "水印自动移除",
      "批量图片处理",
      "永久免费存储",
      "无需注册登录",
      "支持高清图片",
      "3秒快速处理",
      "BiRefNet高精度算法"
    ],
    "screenshot": [
      `${env.NEXT_PUBLIC_SITE_URL}/og.png`,
      `${env.NEXT_PUBLIC_SITE_URL}/images/screenshot-1.png`,
      `${env.NEXT_PUBLIC_SITE_URL}/images/screenshot-2.png`
    ],
    "image": `${env.NEXT_PUBLIC_SITE_URL}/og.png`,
    "softwareVersion": "2.0",
    "datePublished": "2024-01-01",
    "dateModified": "2025-01-21",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "1520",
      "bestRating": "5",
      "worstRating": "1"
    },
    "author": {
      "@type": "Organization",
      "name": "Remove Anything",
      "url": env.NEXT_PUBLIC_SITE_URL,
      "logo": `${env.NEXT_PUBLIC_SITE_URL}/logo.png`,
      "sameAs": [
        "https://twitter.com/removeanything",
        "https://www.facebook.com/removeanything"
      ]
    },
    "potentialAction": {
      "@type": "UseAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": env.NEXT_PUBLIC_SITE_URL,
        "actionPlatform": [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform"
        ]
      }
    }
  };

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Remove Anything 是免费的吗？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "是的，Remove Anything 完全免费。您可以无限制地使用 AI 抠图、背景去除、物体擦除等所有功能，无需注册或付费。"
        }
      },
      {
        "@type": "Question",
        "name": "如何使用 AI 去除图片背景？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "只需3步：1) 上传您的图片 2) AI 自动识别并去除背景 3) 下载处理后的图片。整个过程只需3秒，无需任何PS技能。"
        }
      },
      {
        "@type": "Question",
        "name": "支持哪些图片格式？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "支持 JPG、PNG、WEBP 等常见图片格式。最大支持 10MB 的图片文件。"
        }
      },
      {
        "@type": "Question",
        "name": "Remove Anything 和 remove.bg 有什么区别？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Remove Anything 使用更先进的 BiRefNet 算法，提供更高精度的抠图效果。同时支持物体擦除、批量处理和永久存储，完全免费无限制使用。"
        }
      },
      {
        "@type": "Question",
        "name": "处理后的图片会保存多久？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "我们提供永久免费存储。您处理过的所有图片都会永久保存，随时可以下载，不会丢失。"
        }
      }
    ]
  };

  const howToStructuredData = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "如何使用 AI 快速去除图片背景",
    "description": "3步教你使用 Remove Anything 快速去除图片背景，无需 PS 技能",
    "image": `${env.NEXT_PUBLIC_SITE_URL}/images/howto-remove-background.png`,
    "totalTime": "PT3S",
    "estimatedCost": {
      "@type": "MonetaryAmount",
      "currency": "USD",
      "value": "0"
    },
    "tool": {
      "@type": "HowToTool",
      "name": "Remove Anything AI 抠图工具"
    },
    "step": [
      {
        "@type": "HowToStep",
        "position": 1,
        "name": "上传图片",
        "text": "点击上传按钮或直接拖拽图片到页面",
        "image": `${env.NEXT_PUBLIC_SITE_URL}/images/step1-upload.png`
      },
      {
        "@type": "HowToStep",
        "position": 2,
        "name": "AI 自动处理",
        "text": "AI 自动识别前景和背景，3秒完成抠图",
        "image": `${env.NEXT_PUBLIC_SITE_URL}/images/step2-processing.png`
      },
      {
        "@type": "HowToStep",
        "position": 3,
        "name": "下载结果",
        "text": "预览效果满意后，点击下载按钮保存图片",
        "image": `${env.NEXT_PUBLIC_SITE_URL}/images/step3-download.png`
      }
    ]
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
      <Script
        id="faq-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqStructuredData)
        }}
      />
      {/* 精简首页：首屏价值主张 + 快速入口 + 案例展示 */}
      <HeroLanding />
      <QuickAccess />
      <Examples />
    </>
  );
}
