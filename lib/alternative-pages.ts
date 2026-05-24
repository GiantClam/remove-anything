export type AlternativePageVariant =
  | "remove-bg-alternative"
  | "photoroom-alternative"
  | "pixelcut-alternative"
  | "remove-anything-vs-remove-bg";

type VerdictSection = {
  title: string;
  description: string;
};

type ComparisonRow = {
  feature: string;
  removeAnything: string;
  competitor: string;
};

type BestForColumn = {
  title: string;
  bullets: string[];
};

type FaqItem = {
  question: string;
  answer: string;
};

type RelatedLink = {
  href: string;
  title: string;
  description: string;
};

export type AlternativePageConfig = {
  variant: AlternativePageVariant;
  path: string;
  metadataTitle: string;
  metadataDescription: string;
  metadataKeywords: string;
  heroLabel: string;
  heroTitle: string;
  heroDescription: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  verdict: VerdictSection;
  comparisonTitle: string;
  comparisonDescription: string;
  competitorName: string;
  comparisonRows: ComparisonRow[];
  bestForTitle: string;
  bestForColumns: BestForColumn[];
  whySwitchTitle: string;
  whySwitchBullets: string[];
  faqTitle: string;
  faqItems: FaqItem[];
  relatedToolsTitle: string;
  relatedTools: RelatedLink[];
};

const SHARED_ROWS = {
  localBatch: {
    feature: "Local browser-based batch tools",
    removeAnything: "Yes - compression, resizing, and format conversion process locally",
  },
  oneTimePricing: {
    feature: "One-time credit model",
    removeAnything: "Yes - buy credits only when needed",
  },
  objectRemoval: {
    feature: "Object removal workflows",
    removeAnything: "Yes - AI erase and background cleanup entry points",
  },
  transparentPng: {
    feature: "Transparent PNG workflow",
    removeAnything: "Yes - dedicated transparent PNG landing flow",
  },
  ecommerceFlexibility: {
    feature: "Ecommerce workflow flexibility",
    removeAnything: "Strong - white background, color swap, batch cleanup, and export tools",
  },
};

const RELATED_TOOLS: RelatedLink[] = [
  {
    href: "/remove-background",
    title: "AI Background Remover",
    description: "Try the main background removal workflow with clean cutouts and exports.",
  },
  {
    href: "/transparent-png-maker",
    title: "Transparent PNG Maker",
    description: "Turn product shots, signatures, and logos into transparent PNGs in seconds.",
  },
  {
    href: "/batch-image-compressor",
    title: "Batch Image Compressor",
    description: "Compress multiple product and content images in one run without extra uploads.",
  },
  {
    href: "/batch-image-format-converter",
    title: "Batch Image Format Converter",
    description: "Convert multiple images to JPG, PNG, or WebP as part of your publishing workflow.",
  },
];

export const alternativePages: Record<AlternativePageVariant, AlternativePageConfig> = {
  "remove-bg-alternative": {
    variant: "remove-bg-alternative",
    path: "/remove-bg-alternative",
    metadataTitle: "Best remove.bg Alternative for Batch Image Workflows",
    metadataDescription:
      "Looking for a remove.bg alternative? Compare Remove Anything vs remove.bg for background removal, batch utilities, one-time pricing, and workflow flexibility.",
    metadataKeywords:
      "remove.bg alternative, best remove.bg alternative, remove bg alternative, remove anything vs remove.bg",
    heroLabel: "Competitor alternative",
    heroTitle: "A practical remove.bg alternative for batch image workflows",
    heroDescription:
      "Remove Anything pairs AI background removal with local batch compression, resizing, format conversion, and one-time credits so teams can clean up images without juggling extra tools.",
    primaryCtaLabel: "Try Remove Anything",
    primaryCtaHref: "/remove-background",
    secondaryCtaLabel: "See pricing",
    secondaryCtaHref: "/pricing",
    verdict: {
      title: "Quick verdict",
      description:
        "If you only need simple background removal at scale, remove.bg stays familiar. If you want background removal plus adjacent image cleanup and export tools in one stack, Remove Anything is the stronger alternative.",
    },
    comparisonTitle: "Remove Anything vs remove.bg",
    comparisonDescription:
      "This comparison focuses on real workflow differences that matter for ecommerce teams, creators, and marketers publishing image-heavy content.",
    competitorName: "remove.bg",
    comparisonRows: [
      {
        feature: "Background removal quality",
        removeAnything: "Strong AI cutouts with dedicated transparent PNG and white background workflows",
        competitor: "Strong single-purpose background removal",
      },
      {
        feature: "Batch background removal",
        removeAnything: "Yes - dedicated batch background workflow",
        competitor: "Yes - widely used for bulk cutouts",
      },
      {
        ...SHARED_ROWS.localBatch,
        competitor: "No - usually requires extra tooling outside the core remover",
      },
      {
        ...SHARED_ROWS.oneTimePricing,
        competitor: "Subscription and usage patterns vary by plan",
      },
      {
        ...SHARED_ROWS.objectRemoval,
        competitor: "Limited focus outside background removal",
      },
      {
        ...SHARED_ROWS.transparentPng,
        competitor: "Yes - via background removal output",
      },
      {
        ...SHARED_ROWS.ecommerceFlexibility,
        competitor: "More specialized around background removal itself",
      },
    ],
    bestForTitle: "Best fit by use case",
    bestForColumns: [
      {
        title: "Choose Remove Anything if you need",
        bullets: [
          "background removal plus batch cleanup tools",
          "one-time credits instead of recurring lock-in",
          "extra product-image workflows like white background and color swaps",
        ],
      },
      {
        title: "Choose remove.bg if you need",
        bullets: [
          "a familiar brand focused tightly on background removal",
          "an established single-job background cutout workflow",
          "less emphasis on surrounding image utility tools",
        ],
      },
    ],
    whySwitchTitle: "Why people switch from remove.bg",
    whySwitchBullets: [
      "You need more than background removal, especially compression, resizing, and format conversion after export.",
      "You want one-time credit purchases instead of forcing every team into a recurring plan.",
      "You want adjacent ecommerce tools such as transparent PNG, white background, and color background workflows in one product path.",
    ],
    faqTitle: "remove.bg alternative FAQ",
    faqItems: [
      {
        question: "Is Remove Anything a direct remove.bg alternative?",
        answer:
          "Yes. It covers AI background removal while also adding adjacent image utility tools that many teams need after cutout work is done.",
      },
      {
        question: "What makes Remove Anything different from remove.bg?",
        answer:
          "The main difference is workflow breadth. Remove Anything combines background removal with local batch compression, resizing, format conversion, white background, and transparent PNG entry points.",
      },
      {
        question: "Which one is better for ecommerce teams?",
        answer:
          "Teams handling product catalogs often benefit from Remove Anything because it supports background cleanup plus downstream image prep steps in one place.",
      },
    ],
    relatedToolsTitle: "Related tools to try next",
    relatedTools: RELATED_TOOLS,
  },
  "photoroom-alternative": {
    variant: "photoroom-alternative",
    path: "/photoroom-alternative",
    metadataTitle: "Photoroom Alternative for Faster Image Cleanup Workflows",
    metadataDescription:
      "Need a Photoroom alternative? Compare Remove Anything for background removal, white backgrounds, batch image utilities, and one-time pricing.",
    metadataKeywords:
      "photoroom alternative, best photoroom alternative, remove anything vs photoroom, photoroom competitor",
    heroLabel: "Competitor alternative",
    heroTitle: "A Photoroom alternative for teams that want simpler pricing and more utility tools",
    heroDescription:
      "Remove Anything is a strong Photoroom alternative when your team needs AI background removal plus local batch image cleanup without adding another editing app to finish the job.",
    primaryCtaLabel: "Try background removal",
    primaryCtaHref: "/remove-background",
    secondaryCtaLabel: "See credits and pricing",
    secondaryCtaHref: "/pricing",
    verdict: {
      title: "Quick verdict",
      description:
        "Photoroom is well-known for mobile-first editing and ecommerce visuals. Remove Anything is the better fit if your team wants a lighter browser workflow with one-time credits and built-in batch utility pages.",
    },
    comparisonTitle: "Remove Anything vs Photoroom",
    comparisonDescription:
      "This comparison focuses on how each product fits publishing, ecommerce cleanup, and repeatable image prep work.",
    competitorName: "Photoroom",
    comparisonRows: [
      {
        feature: "Background removal",
        removeAnything: "Yes - dedicated AI remover plus transparent PNG and white background flows",
        competitor: "Yes - well-known for product and profile visual cleanup",
      },
      {
        feature: "White background output",
        removeAnything: "Yes - dedicated white background landing page",
        competitor: "Yes - often used for ecommerce product presentation",
      },
      {
        ...SHARED_ROWS.localBatch,
        competitor: "Less centered around standalone browser batch utility pages",
      },
      {
        ...SHARED_ROWS.oneTimePricing,
        competitor: "Often positioned around app-centric paid workflows",
      },
      {
        ...SHARED_ROWS.objectRemoval,
        competitor: "Broader design editing focus depending on workflow",
      },
      {
        feature: "Format conversion and export prep",
        removeAnything: "Yes - built-in batch format converter and resizer",
        competitor: "Not the main product focus",
      },
      {
        ...SHARED_ROWS.ecommerceFlexibility,
        competitor: "Strong for listing visuals and presentation-oriented edits",
      },
    ],
    bestForTitle: "Best fit by use case",
    bestForColumns: [
      {
        title: "Choose Remove Anything if you need",
        bullets: [
          "browser-first batch image cleanup",
          "one-time credits without subscription pressure",
          "a lighter utility-tool workflow around exports and prep",
        ],
      },
      {
        title: "Choose Photoroom if you need",
        bullets: [
          "a design-heavy editing workflow around marketing visuals",
          "a product experience centered on image composition and visual polish",
          "a familiar mobile-first editing brand",
        ],
      },
    ],
    whySwitchTitle: "Why people look for a Photoroom alternative",
    whySwitchBullets: [
      "You want simpler pricing for occasional or mixed-use image cleanup.",
      "You need bulk compression, resizing, and format conversion after the background removal step.",
      "You prefer direct browser utilities over a more app-centric editing experience.",
    ],
    faqTitle: "Photoroom alternative FAQ",
    faqItems: [
      {
        question: "Is Remove Anything a good Photoroom alternative?",
        answer:
          "Yes, especially for users who care more about image cleanup workflows and bulk utility steps than full design composition features.",
      },
      {
        question: "What is the biggest difference between Remove Anything and Photoroom?",
        answer:
          "Remove Anything leans into focused AI cleanup plus local batch utility tools, while Photoroom is more associated with broader product-visual editing and presentation workflows.",
      },
      {
        question: "Which is better for product image operations?",
        answer:
          "If your workflow includes cutout, white background, compression, resize, and format prep, Remove Anything can cover more of that pipeline in one browser-based tool path.",
      },
    ],
    relatedToolsTitle: "Related tools to try next",
    relatedTools: RELATED_TOOLS,
  },
  "pixelcut-alternative": {
    variant: "pixelcut-alternative",
    path: "/pixelcut-alternative",
    metadataTitle: "Pixelcut Alternative for Product Image and Batch Utility Workflows",
    metadataDescription:
      "Compare Remove Anything as a Pixelcut alternative for background removal, white backgrounds, batch image cleanup, and flexible credit-based pricing.",
    metadataKeywords:
      "pixelcut alternative, best pixelcut alternative, remove anything vs pixelcut, pixelcut competitor",
    heroLabel: "Competitor alternative",
    heroTitle: "A Pixelcut alternative for product image cleanup and export prep",
    heroDescription:
      "Remove Anything is a practical Pixelcut alternative when you need AI cleanup plus fast batch browser tools for compression, resizing, and format conversion.",
    primaryCtaLabel: "Try Remove Anything",
    primaryCtaHref: "/remove-background",
    secondaryCtaLabel: "View pricing",
    secondaryCtaHref: "/pricing",
    verdict: {
      title: "Quick verdict",
      description:
        "Pixelcut is popular for product-image editing and marketplace visuals. Remove Anything is the stronger alternative if you want more utility-style workflow coverage and one-time credit pricing.",
    },
    comparisonTitle: "Remove Anything vs Pixelcut",
    comparisonDescription:
      "This view compares workflow fit instead of chasing feature checklist inflation.",
    competitorName: "Pixelcut",
    comparisonRows: [
      {
        feature: "Background removal",
        removeAnything: "Yes - AI cutouts with dedicated transparent PNG and white background pages",
        competitor: "Yes - common product-image editing use case",
      },
      {
        feature: "Batch background removal",
        removeAnything: "Yes - dedicated batch workflow",
        competitor: "Batch support depends on workflow and plan context",
      },
      {
        ...SHARED_ROWS.localBatch,
        competitor: "Not centered around standalone browser utility workflows",
      },
      {
        ...SHARED_ROWS.oneTimePricing,
        competitor: "Pricing is less centered on occasional-use credit flexibility",
      },
      {
        ...SHARED_ROWS.objectRemoval,
        competitor: "More focused on broader product visual editing",
      },
      {
        feature: "White background for marketplace prep",
        removeAnything: "Yes - dedicated page and workflow",
        competitor: "Yes - commonly aligned with product listings",
      },
      {
        ...SHARED_ROWS.ecommerceFlexibility,
        competitor: "Strong for product presentation, less focused on utility-style post-processing",
      },
    ],
    bestForTitle: "Best fit by use case",
    bestForColumns: [
      {
        title: "Choose Remove Anything if you need",
        bullets: [
          "product image cleanup plus batch file prep tools",
          "one-time pricing flexibility for mixed workloads",
          "a more utility-focused browser flow",
        ],
      },
      {
        title: "Choose Pixelcut if you need",
        bullets: [
          "a product-editing workflow oriented around polished listing visuals",
          "stronger emphasis on visual merchandising style use cases",
          "a familiar creator/ecommerce editing brand",
        ],
      },
    ],
    whySwitchTitle: "Why people search for a Pixelcut alternative",
    whySwitchBullets: [
      "You need more low-friction export tooling after image editing.",
      "You want AI background removal plus browser-side batch utilities instead of a more design-centric flow.",
      "You prefer one-time credits for occasional image operations.",
    ],
    faqTitle: "Pixelcut alternative FAQ",
    faqItems: [
      {
        question: "Is Remove Anything a good Pixelcut alternative?",
        answer:
          "Yes, especially if your team cares about utility workflows like compression, resizing, and conversion in addition to AI cleanup.",
      },
      {
        question: "What is the main advantage of Remove Anything over Pixelcut?",
        answer:
          "Remove Anything combines cleanup and export-oriented batch utilities in one browser workflow with one-time credits, which is useful for recurring operational image prep.",
      },
      {
        question: "Which tool is better for marketplace image pipelines?",
        answer:
          "If your pipeline includes white background, transparent PNG, compression, resizing, and format conversion, Remove Anything covers more of the operational workflow directly.",
      },
    ],
    relatedToolsTitle: "Related tools to try next",
    relatedTools: RELATED_TOOLS,
  },
  "remove-anything-vs-remove-bg": {
    variant: "remove-anything-vs-remove-bg",
    path: "/remove-anything-vs-remove-bg",
    metadataTitle: "Remove Anything vs remove.bg: Which Tool Fits Your Workflow?",
    metadataDescription:
      "Compare Remove Anything vs remove.bg across background removal, batch tools, transparent PNG workflows, one-time pricing, and ecommerce image prep.",
    metadataKeywords:
      "remove anything vs remove.bg, remove.bg comparison, remove anything comparison, best background remover comparison",
    heroLabel: "Direct comparison",
    heroTitle: "Remove Anything vs remove.bg: choose the tool that matches your image workflow",
    heroDescription:
      "Both tools help with background removal. The better choice depends on whether you want a focused remover or a broader browser workflow that includes batch cleanup and export prep.",
    primaryCtaLabel: "Try the remover",
    primaryCtaHref: "/remove-background",
    secondaryCtaLabel: "Compare pricing",
    secondaryCtaHref: "/pricing",
    verdict: {
      title: "Quick verdict",
      description:
        "Choose remove.bg if your priority is a familiar single-job background removal product. Choose Remove Anything if your workflow continues after cutout and you need white backgrounds, transparent PNG, batch cleanup, or utility exports.",
    },
    comparisonTitle: "Feature-by-feature comparison",
    comparisonDescription:
      "This page compares workflow fit, not just isolated features. It is most useful for ecommerce teams, creators, and content operators choosing a repeatable image stack.",
    competitorName: "remove.bg",
    comparisonRows: [
      {
        feature: "Core background removal",
        removeAnything: "Strong AI cutouts for product photos, portraits, and transparent PNG workflows",
        competitor: "Strong dedicated background removal",
      },
      {
        feature: "Transparent PNG export flow",
        removeAnything: "Dedicated transparent PNG page plus cutout workflow",
        competitor: "Common core export use case",
      },
      {
        feature: "White background ecommerce workflow",
        removeAnything: "Dedicated landing page and supporting tools",
        competitor: "Usually requires narrower background-removal-centric workflow",
      },
      {
        feature: "Batch image cleanup after cutout",
        removeAnything: "Compression, resizing, and format conversion built in",
        competitor: "Usually requires extra tools",
      },
      {
        feature: "One-time pricing flexibility",
        removeAnything: "One-time credits available",
        competitor: "More plan-dependent",
      },
      {
        feature: "Object and visual cleanup breadth",
        removeAnything: "Background, object cleanup entry points, and image utility workflows",
        competitor: "More narrowly centered on background removal",
      },
      {
        feature: "Best overall fit",
        removeAnything: "Operators who want one browser workflow for cleanup and export prep",
        competitor: "Users who mainly need background removal itself",
      },
    ],
    bestForTitle: "Who each tool is best for",
    bestForColumns: [
      {
        title: "Remove Anything is best for",
        bullets: [
          "multi-step image cleanup workflows",
          "teams shipping many ecommerce or content images",
          "users who want batch utilities after background removal",
        ],
      },
      {
        title: "remove.bg is best for",
        bullets: [
          "users focused mainly on background removal itself",
          "teams already committed to a separate downstream image tool stack",
          "buyers who prioritize a category-specialist brand",
        ],
      },
    ],
    whySwitchTitle: "Why teams switch from remove.bg to Remove Anything",
    whySwitchBullets: [
      "They need the post-cutout workflow, not just the cutout itself.",
      "They want local browser-based batch utilities without routing every step through another service.",
      "They want more flexibility with one-time credits and adjacent ecommerce image tools.",
    ],
    faqTitle: "Remove Anything vs remove.bg FAQ",
    faqItems: [
      {
        question: "Is Remove Anything better than remove.bg?",
        answer:
          "It is better for users who want background removal plus adjacent image utility tools. If you only care about a familiar dedicated remover, remove.bg may still fit well.",
      },
      {
        question: "What is the biggest workflow difference?",
        answer:
          "Remove Anything extends further into white background, transparent PNG, compression, resizing, and format conversion workflows, while remove.bg stays more tightly centered on background removal.",
      },
      {
        question: "Which one should an ecommerce team choose?",
        answer:
          "Teams preparing many catalog or marketplace images often gain more from Remove Anything because it handles more of the post-removal image prep process directly.",
      },
    ],
    relatedToolsTitle: "Try the product pages behind this comparison",
    relatedTools: RELATED_TOOLS,
  },
};

export function getAlternativePage(variant: AlternativePageVariant) {
  return alternativePages[variant];
}
