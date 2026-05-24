import { Sparkles, PackageOpen, Eraser, PaintBucket, ScanLine, RefreshCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ToolDiscoveryLink = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export type ToolDiscoveryGroup = {
  title: string;
  links: Array<Pick<ToolDiscoveryLink, "href" | "title">>;
};

type ToolDiscoveryContent = {
  homepageLabel: string;
  homepageTitle: string;
  homepageSubtitle: string;
  footerTitle: string;
  featuredTools: ToolDiscoveryLink[];
  footerGroups: ToolDiscoveryGroup[];
};

function isChineseLocale(locale: string) {
  return locale === "tw";
}

export function getToolDiscoveryContent(locale: string): ToolDiscoveryContent {
  const zh = isChineseLocale(locale);

  const featuredTools: ToolDiscoveryLink[] = zh
    ? [
        {
          href: "/transparent-png-maker",
          title: "透明 PNG 生成器",
          description: "上传图片后快速生成透明背景素材，适合 logo、商品图和设计资源。",
          icon: Sparkles,
        },
        {
          href: "/white-background-maker",
          title: "白底图生成器",
          description: "把商品图片自动处理成纯白背景版本，适合 Amazon、Etsy 和 Shopify。",
          icon: PaintBucket,
        },
        {
          href: "/change-background-color",
          title: "换背景颜色",
          description: "一键切换白底、黑底和品牌色背景，适合商品图和证件照。",
          icon: Eraser,
        },
        {
          href: "/batch-image-compressor",
          title: "批量图片压缩",
          description: "批量减小图片体积，适合博客配图、商品图和落地页素材优化。",
          icon: PackageOpen,
        },
        {
          href: "/batch-image-resizer",
          title: "批量改尺寸",
          description: "统一多张图片的宽高范围，方便上传 CMS、电商后台和社媒平台。",
          icon: ScanLine,
        },
        {
          href: "/batch-image-format-converter",
          title: "批量格式转换",
          description: "批量把图片转成 JPG、PNG 或 WebP，方便发布、归档和素材整理。",
          icon: RefreshCcw,
        },
      ]
    : [
        {
          href: "/transparent-png-maker",
          title: "Transparent PNG Maker",
          description: "Turn any image into a clean transparent PNG for logos, products, and design assets.",
          icon: Sparkles,
        },
        {
          href: "/white-background-maker",
          title: "White Background Maker",
          description: "Convert product photos into white-background images for Amazon, Etsy, and Shopify listings.",
          icon: PaintBucket,
        },
        {
          href: "/change-background-color",
          title: "Change Background Color",
          description: "Swap image backgrounds to white, black, or brand colors for products and profile photos.",
          icon: Eraser,
        },
        {
          href: "/batch-image-compressor",
          title: "Batch Image Compressor",
          description: "Shrink image file sizes in bulk for blogs, landing pages, and ecommerce catalogs.",
          icon: PackageOpen,
        },
        {
          href: "/batch-image-resizer",
          title: "Batch Image Resizer",
          description: "Resize multiple images into one consistent size range for CMS, storefront, and social use.",
          icon: ScanLine,
        },
        {
          href: "/batch-image-format-converter",
          title: "Batch Image Format Converter",
          description: "Convert multiple images into JPG, PNG, or WebP for publishing, optimization, and content cleanup.",
          icon: RefreshCcw,
        },
      ];

  return zh
    ? {
        homepageLabel: "高频图片工具",
        homepageTitle: "从去背景到批量优化，把常用图片流程串起来",
        homepageSubtitle:
          "这些页面最适合拿高频长尾搜索流量，也能帮助用户从一个任务自然跳到下一个任务。",
        footerTitle: "热门图片工具",
        featuredTools,
        footerGroups: [
          {
            title: "背景处理",
            links: [
              { href: "/remove-background", title: "AI 去背景" },
              { href: "/transparent-png-maker", title: "透明 PNG 生成器" },
              { href: "/white-background-maker", title: "白底图生成器" },
              { href: "/change-background-color", title: "换背景颜色" },
            ],
          },
          {
            title: "批量处理",
            links: [
              { href: "/batch-remove-background", title: "批量去背景" },
              { href: "/batch-image-compressor", title: "批量图片压缩" },
              { href: "/batch-image-resizer", title: "批量改尺寸" },
              { href: "/batch-image-format-converter", title: "批量格式转换" },
            ],
          },
          {
            title: "比較工具",
            links: [
              { href: "/remove-bg-alternative", title: "remove.bg 替代方案" },
              { href: "/photoroom-alternative", title: "Photoroom 替代方案" },
              { href: "/pixelcut-alternative", title: "Pixelcut 替代方案" },
              { href: "/remove-anything-vs-remove-bg", title: "Remove Anything vs remove.bg" },
            ],
          },
        ],
      }
    : {
        homepageLabel: "Popular image workflows",
        homepageTitle: "Connect background editing and batch image cleanup in one hub",
        homepageSubtitle:
          "These are the highest-leverage utility pages for short-tail and long-tail SEO, and they also help users move naturally between adjacent tasks.",
        footerTitle: "Popular image tools",
        featuredTools,
        footerGroups: [
          {
            title: "Background tools",
            links: [
              { href: "/remove-background", title: "AI Background Remover" },
              { href: "/transparent-png-maker", title: "Transparent PNG Maker" },
              { href: "/white-background-maker", title: "White Background Maker" },
              { href: "/change-background-color", title: "Change Background Color" },
            ],
          },
          {
            title: "Batch tools",
            links: [
              { href: "/batch-remove-background", title: "Batch Background Removal" },
              { href: "/batch-image-compressor", title: "Batch Image Compressor" },
              { href: "/batch-image-resizer", title: "Batch Image Resizer" },
              { href: "/batch-image-format-converter", title: "Batch Image Format Converter" },
            ],
          },
          {
            title: "Compare tools",
            links: [
              { href: "/remove-bg-alternative", title: "remove.bg Alternative" },
              { href: "/photoroom-alternative", title: "Photoroom Alternative" },
              { href: "/pixelcut-alternative", title: "Pixelcut Alternative" },
              { href: "/remove-anything-vs-remove-bg", title: "Remove Anything vs remove.bg" },
            ],
          },
        ],
      };
}
