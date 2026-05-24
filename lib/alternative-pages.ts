export type AlternativePageVariant =
  | "remove-bg-alternative"
  | "photoroom-alternative"
  | "pixelcut-alternative"
  | "remove-anything-vs-remove-bg";

export const alternativePageLocales = ["en", "tw"] as const;
export type AlternativePageLocale = (typeof alternativePageLocales)[number];

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

type AlternativePageLocalization = Partial<
  Omit<AlternativePageConfig, "variant" | "path" | "primaryCtaHref" | "secondaryCtaHref">
> & {
  verdict?: Partial<VerdictSection>;
  bestForColumns?: BestForColumn[];
  comparisonRows?: ComparisonRow[];
  faqItems?: FaqItem[];
  relatedTools?: RelatedLink[];
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

const RELATED_TOOLS_TW: RelatedLink[] = [
  {
    href: "/remove-background",
    title: "AI 去背景工具",
    description: "直接進入主去背景流程，快速拿到乾淨的去背結果與下載輸出。",
  },
  {
    href: "/transparent-png-maker",
    title: "透明 PNG 生成器",
    description: "把商品圖、簽名或 logo 轉成透明背景 PNG，方便後續排版與上架。",
  },
  {
    href: "/batch-image-compressor",
    title: "批量圖片壓縮",
    description: "一次壓縮多張商品圖與內容圖片，不用額外上傳到雲端再處理。",
  },
  {
    href: "/batch-image-format-converter",
    title: "批量格式轉換",
    description: "把多張圖片批量轉成 JPG、PNG 或 WebP，方便上架、歸檔與發布。",
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

const alternativePageLocalizations: Partial<
  Record<AlternativePageLocale, Record<AlternativePageVariant, AlternativePageLocalization>>
> = {
  tw: {
    "remove-bg-alternative": {
      metadataTitle: "remove.bg 替代方案：更適合批量圖片工作流的選擇",
      metadataDescription:
        "想找 remove.bg alternative？比較 Remove Anything 與 remove.bg 在去背景、批量圖片工具、一次性點數與電商工作流上的差異。",
      metadataKeywords:
        "remove.bg alternative, remove.bg 替代, remove.bg 替代方案, Remove Anything vs remove.bg",
      heroLabel: "競品替代方案",
      heroTitle: "更適合批量圖片工作流的 remove.bg 替代方案",
      heroDescription:
        "Remove Anything 把 AI 去背景、批量壓縮、改尺寸、格式轉換與一次性點數結合在一起，讓團隊不用切換多個工具就能完成圖片整理。",
      primaryCtaLabel: "立即試用 Remove Anything",
      secondaryCtaLabel: "查看方案與點數",
      verdict: {
        title: "快速結論",
        description:
          "如果你只需要單純的大量去背景，remove.bg 依然是熟悉的選擇；如果你還需要後續的圖片整理、壓縮、轉格式與白底流程，Remove Anything 會更完整。",
      },
      comparisonTitle: "Remove Anything 與 remove.bg 比較",
      comparisonDescription:
        "這份比較聚焦在真實工作流差異，特別適合電商團隊、內容營運與需要大量處理素材的人。",
      comparisonRows: [
        {
          feature: "去背景品質",
          removeAnything: "AI 去背效果穩定，並提供透明 PNG 與白底圖專屬流程",
          competitor: "擅長單一用途的去背景輸出",
        },
        {
          feature: "批量去背景",
          removeAnything: "有，提供獨立的批量去背景流程",
          competitor: "有，常見於大量商品圖去背",
        },
        {
          feature: "瀏覽器本地批量工具",
          removeAnything: "有，批量壓縮、改尺寸與格式轉換都可直接在瀏覽器處理",
          competitor: "沒有，通常還要額外搭配其他工具",
        },
        {
          feature: "一次性點數模式",
          removeAnything: "有，需要時再購買點數即可",
          competitor: "依方案而定，較偏向訂閱或固定用量模式",
        },
        {
          feature: "物件移除工作流",
          removeAnything: "有，提供 AI 擦除與背景修補入口",
          competitor: "重點仍在去背景本身",
        },
        {
          feature: "透明 PNG 工作流",
          removeAnything: "有，提供獨立透明 PNG 頁面與下載流程",
          competitor: "有，但主要附屬於去背景輸出",
        },
        {
          feature: "電商圖片流程彈性",
          removeAnything: "強，涵蓋白底、換色背景、批量整理與導出工具",
          competitor: "較集中在去背景本身",
        },
      ],
      bestForTitle: "適用情境",
      bestForColumns: [
        {
          title: "如果你需要以下流程，選 Remove Anything",
          bullets: [
            "去背景之後還要批量整理圖片",
            "想用一次性點數，而不是綁定長期訂閱",
            "需要白底圖、換背景色與透明 PNG 等電商圖片流程",
          ],
        },
        {
          title: "如果你主要需要以下流程，選 remove.bg",
          bullets: [
            "熟悉且專注於去背景的工具",
            "主要任務就是把背景去掉並導出 cutout",
            "後續圖片處理已經有其他既有工具鏈",
          ],
        },
      ],
      whySwitchTitle: "為什麼有人會從 remove.bg 轉向 Remove Anything",
      whySwitchBullets: [
        "因為你要處理的不只是去背景，還包括壓縮、改尺寸與轉格式。",
        "因為你希望按需購買點數，而不是每個團隊都綁到固定方案。",
        "因為你需要透明 PNG、白底圖與換背景色等更完整的商品圖片工作流。",
      ],
      faqTitle: "remove.bg 替代方案 FAQ",
      faqItems: [
        {
          question: "Remove Anything 算是 remove.bg 的直接替代嗎？",
          answer:
            "算。它除了 AI 去背景之外，還補上了很多團隊在 cutout 之後真正需要的圖片整理工具。",
        },
        {
          question: "Remove Anything 和 remove.bg 最大差異是什麼？",
          answer:
            "最大差異在於工作流廣度。Remove Anything 把去背景、白底圖、透明 PNG、批量壓縮、改尺寸與格式轉換都放在同一條路徑裡。",
        },
        {
          question: "哪一個更適合電商團隊？",
          answer:
            "如果你要處理商品目錄、白底圖與上架素材，Remove Anything 通常更合適，因為它能直接覆蓋更多後續步驟。",
        },
      ],
      relatedToolsTitle: "接下來可以一起使用的工具",
      relatedTools: RELATED_TOOLS_TW,
    },
    "photoroom-alternative": {
      metadataTitle: "Photoroom 替代方案：更輕量的商品圖整理工作流",
      metadataDescription:
        "想找 Photoroom alternative？比較 Remove Anything 在去背景、白底圖、批量圖片工具與一次性點數上的差異。",
      metadataKeywords:
        "Photoroom alternative, Photoroom 替代, Photoroom 替代方案, Remove Anything vs Photoroom",
      heroLabel: "競品替代方案",
      heroTitle: "更適合輕量批量整理的 Photoroom 替代方案",
      heroDescription:
        "如果你的團隊想用瀏覽器完成 AI 去背景，再接著做批量圖片壓縮、改尺寸與轉格式，Remove Anything 會是很實用的 Photoroom 替代。",
      primaryCtaLabel: "試試 AI 去背景",
      secondaryCtaLabel: "查看點數與方案",
      verdict: {
        title: "快速結論",
        description:
          "Photoroom 很適合偏 app 型態的商品圖編輯；如果你更在意瀏覽器工作流、一次性點數與獨立批量工具，Remove Anything 會更靈活。",
      },
      comparisonTitle: "Remove Anything 與 Photoroom 比較",
      comparisonDescription:
        "這份比較聚焦在商品圖處理、發布流程與重複性圖片整理的需求。",
      comparisonRows: [
        {
          feature: "去背景能力",
          removeAnything: "有，並提供透明 PNG 與白底圖專屬頁面",
          competitor: "有，常用於商品圖與頭像視覺整理",
        },
        {
          feature: "白底圖輸出",
          removeAnything: "有，提供獨立白底圖頁面",
          competitor: "有，常被拿來做電商商品展示",
        },
        {
          feature: "瀏覽器本地批量工具",
          removeAnything: "有，批量壓縮、改尺寸與格式轉換可獨立處理",
          competitor: "較少以獨立 browser-first 批量工具頁面為核心",
        },
        {
          feature: "一次性點數模式",
          removeAnything: "有，按需購買點數即可",
          competitor: "較偏 app 或訂閱導向的付費路徑",
        },
        {
          feature: "物件移除與清理",
          removeAnything: "有，提供物件擦除與背景修補入口",
          competitor: "偏向更廣泛的設計/版面編輯工作流",
        },
        {
          feature: "商品圖整理流程",
          removeAnything: "可串接白底、換背景色與批量整理工具",
          competitor: "較偏向單一編輯畫面流程",
        },
        {
          feature: "適合的團隊類型",
          removeAnything: "需要瀏覽器批量整理與快速導出的團隊",
          competitor: "偏向需要 app 內編排與視覺呈現的團隊",
        },
      ],
      bestForTitle: "適用情境",
      bestForColumns: [
        {
          title: "如果你需要以下流程，選 Remove Anything",
          bullets: [
            "以瀏覽器為主的商品圖整理流程",
            "批量壓縮、改尺寸與轉格式等獨立工具",
            "一次性點數而不是固定訂閱",
          ],
        },
        {
          title: "如果你主要需要以下流程，選 Photoroom",
          bullets: [
            "更偏 app 式的設計與商品展示工作流",
            "視覺編排比批量工具更重要",
            "團隊已經習慣在單一編輯器裡完成素材處理",
          ],
        },
      ],
      whySwitchTitle: "為什麼有人會從 Photoroom 看向 Remove Anything",
      whySwitchBullets: [
        "因為你想先去背景，再批量把圖片壓縮、改尺寸、轉格式。",
        "因為你希望用更簡單的點數模式處理階段性工作量。",
        "因為你需要的是一組更明確的 browser-first 工具，而不是更重的編輯 app 流程。",
      ],
      faqTitle: "Photoroom 替代方案 FAQ",
      faqItems: [
        {
          question: "Remove Anything 可以當 Photoroom 替代方案嗎？",
          answer:
            "可以，尤其是當你更在意瀏覽器批量整理、去背景之後的圖片處理，以及一次性點數模式時。",
        },
        {
          question: "Remove Anything 和 Photoroom 最大差別在哪？",
          answer:
            "Photoroom 更偏 app 式的商品圖編輯體驗；Remove Anything 更偏向把去背景、白底圖與批量圖片整理工具串成一條簡潔流程。",
        },
        {
          question: "哪一個更適合商品圖團隊？",
          answer:
            "如果你的核心任務是高頻整理商品圖並快速導出，Remove Anything 通常更直接；如果你更重視 app 內視覺編排，Photoroom 可能更貼近需求。",
        },
      ],
      relatedToolsTitle: "可以搭配使用的工具",
      relatedTools: RELATED_TOOLS_TW,
    },
    "pixelcut-alternative": {
      metadataTitle: "Pixelcut 替代方案：更適合批量導出的瀏覽器路徑",
      metadataDescription:
        "想找 Pixelcut alternative？比較 Remove Anything 在去背景、批量圖片整理、一次性點數與電商輸出上的差異。",
      metadataKeywords:
        "Pixelcut alternative, Pixelcut 替代, Pixelcut 替代方案, Remove Anything vs Pixelcut",
      heroLabel: "競品替代方案",
      heroTitle: "更適合批量導出與圖片整理的 Pixelcut 替代方案",
      heroDescription:
        "如果你的工作不只是在單張商品圖上做編輯，而是要把多張圖片整理成可上架、可發布的格式，Remove Anything 會比單一設計型流程更順。",
      primaryCtaLabel: "先試用去背景",
      secondaryCtaLabel: "查看方案與點數",
      verdict: {
        title: "快速結論",
        description:
          "Pixelcut 對偏模板和視覺呈現的商品圖工作流很有吸引力；如果你更在意 background cleanup 之後的批量整理與導出，Remove Anything 更合適。",
      },
      comparisonTitle: "Remove Anything 與 Pixelcut 比較",
      comparisonDescription:
        "這份比較偏重在商品圖處理、批量導出與重複工作流的效率，而不是單次設計感。",
      comparisonRows: [
        {
          feature: "AI 去背景",
          removeAnything: "有，並提供透明 PNG 與白底圖專屬流程",
          competitor: "有，常用於商品圖視覺優化",
        },
        {
          feature: "白底圖與純色背景",
          removeAnything: "有，對商品上架流程特別實用",
          competitor: "有，但通常更靠近模板化設計流程",
        },
        {
          feature: "瀏覽器本地批量整理",
          removeAnything: "有，壓縮、改尺寸、格式轉換都可本地處理",
          competitor: "較少強調獨立 batch utility 工具頁",
        },
        {
          feature: "一次性點數模式",
          removeAnything: "有，適合波段式工作量",
          competitor: "較偏產品內付費或固定方案",
        },
        {
          feature: "物件移除與延伸清理",
          removeAnything: "有，提供更多圖片清理入口",
          competitor: "更偏向商品圖展示與視覺模板能力",
        },
        {
          feature: "批量發布前整理",
          removeAnything: "適合把圖片整理成統一尺寸、體積與格式",
          competitor: "較偏向單圖視覺效果與模板製作",
        },
        {
          feature: "最佳使用情境",
          removeAnything: "大量處理商品圖與內容素材的營運團隊",
          competitor: "偏向用模板快速產出商品視覺的團隊",
        },
      ],
      bestForTitle: "適用情境",
      bestForColumns: [
        {
          title: "如果你需要以下流程，選 Remove Anything",
          bullets: [
            "去背景之後還要做批量壓縮、改尺寸與轉格式",
            "更在意導出效率，而不是模板式設計體驗",
            "按需購買點數，適合非每日固定工作量",
          ],
        },
        {
          title: "如果你主要需要以下流程，選 Pixelcut",
          bullets: [
            "偏向快速做商品圖視覺與模板內容",
            "更看重設計呈現而不是批量整理",
            "團隊流程本來就圍繞單圖編輯或模板展開",
          ],
        },
      ],
      whySwitchTitle: "為什麼有人會從 Pixelcut 轉向 Remove Anything",
      whySwitchBullets: [
        "因為你需要更完整的發布前圖片整理工具，而不只是單張商品圖視覺處理。",
        "因為你想把去背景、白底、壓縮、改尺寸與格式轉換放在同一路徑裡。",
        "因為你希望用更靈活的一次性點數來支援波段式圖片工作量。",
      ],
      faqTitle: "Pixelcut 替代方案 FAQ",
      faqItems: [
        {
          question: "Remove Anything 可以算是 Pixelcut 的替代嗎？",
          answer:
            "可以，尤其是當你的重點從單圖設計轉向批量整理、導出效率與電商圖片工作流時。",
        },
        {
          question: "Remove Anything 與 Pixelcut 的定位差在哪？",
          answer:
            "Pixelcut 更偏向商品圖視覺與模板呈現；Remove Anything 更偏向去背景後的批量清理、白底、壓縮、改尺寸與轉格式。",
        },
        {
          question: "哪一個更適合大量上架的團隊？",
          answer:
            "如果你要高頻處理大量商品圖並快速整理成可上架格式，Remove Anything 往往更適合。",
        },
      ],
      relatedToolsTitle: "適合一起使用的工具",
      relatedTools: RELATED_TOOLS_TW,
    },
    "remove-anything-vs-remove-bg": {
      metadataTitle: "Remove Anything vs remove.bg：哪個更適合你的圖片工作流？",
      metadataDescription:
        "比較 Remove Anything 與 remove.bg 在去背景、批量工具、透明 PNG、一次性點數與電商圖片整理上的差異。",
      metadataKeywords:
        "Remove Anything vs remove.bg, remove.bg 比較, 去背景工具比較, Remove Anything 比較",
      heroLabel: "直接比較",
      heroTitle: "Remove Anything vs remove.bg：選擇更符合你圖片工作流的工具",
      heroDescription:
        "兩者都能處理去背景，但真正差異在於：你需要的是一個專注 cutout 的工具，還是一條包含批量整理與導出的完整瀏覽器工作流。",
      primaryCtaLabel: "先試去背景工具",
      secondaryCtaLabel: "比較方案價格",
      verdict: {
        title: "快速結論",
        description:
          "如果你的核心是熟悉的單一去背景產品，remove.bg 很直接；如果去背之後還要做白底、透明 PNG、批量壓縮或轉格式，Remove Anything 更完整。",
      },
      comparisonTitle: "逐項功能比較",
      comparisonDescription:
        "這份比較不是只看單一功能，而是看哪一個工具更適合重複性的電商圖片與內容素材工作流。",
      comparisonRows: [
        {
          feature: "核心去背景能力",
          removeAnything: "AI 去背穩定，適合商品圖、人像與透明 PNG 工作流",
          competitor: "專注且成熟的去背景能力",
        },
        {
          feature: "透明 PNG 導出流程",
          removeAnything: "有獨立透明 PNG 頁面與 cutout 流程",
          competitor: "常見且直接的核心輸出用途",
        },
        {
          feature: "白底圖電商流程",
          removeAnything: "有獨立白底圖頁面與輔助工具",
          competitor: "通常仍以去背景為中心，流程較窄",
        },
        {
          feature: "去背後的批量整理",
          removeAnything: "內建批量壓縮、改尺寸與格式轉換",
          competitor: "通常要額外搭配其他工具",
        },
        {
          feature: "一次性點數彈性",
          removeAnything: "有，按需購買點數即可",
          competitor: "較依賴方案設定",
        },
        {
          feature: "圖片清理與延伸工作流",
          removeAnything: "去背景、物件清理與圖片整理工具更完整",
          competitor: "更集中在去背景本身",
        },
        {
          feature: "整體適配對象",
          removeAnything: "需要一條瀏覽器工作流完成清理與導出的團隊",
          competitor: "主要只需要去背景的人",
        },
      ],
      bestForTitle: "誰更適合哪個工具",
      bestForColumns: [
        {
          title: "Remove Anything 更適合",
          bullets: [
            "多步驟圖片清理與整理工作流",
            "需要處理大量商品圖與內容素材的團隊",
            "去背景後還要批量壓縮、改尺寸與轉格式的人",
          ],
        },
        {
          title: "remove.bg 更適合",
          bullets: [
            "主要只需要去背景本身的人",
            "後續圖片整理已經有既有工具鏈的團隊",
            "更偏好類別專注型品牌的買家",
          ],
        },
      ],
      whySwitchTitle: "為什麼團隊會從 remove.bg 轉向 Remove Anything",
      whySwitchBullets: [
        "因為他們需要的不只是 cutout，而是 cutout 之後的整套工作流。",
        "因為他們想要瀏覽器本地批量工具，而不是把每一步都丟給另一個服務。",
        "因為他們希望用更靈活的一次性點數，加上白底、透明 PNG 等電商工具。",
      ],
      faqTitle: "Remove Anything vs remove.bg FAQ",
      faqItems: [
        {
          question: "Remove Anything 一定比 remove.bg 好嗎？",
          answer:
            "如果你只在意熟悉的專用去背景產品，remove.bg 仍然可能很合適；如果你需要去背景之後的圖片整理工具，Remove Anything 通常更有優勢。",
        },
        {
          question: "兩者最大的工作流差異是什麼？",
          answer:
            "Remove Anything 往白底圖、透明 PNG、批量壓縮、改尺寸與格式轉換延伸得更遠；remove.bg 則更集中在去背景這個核心任務。",
        },
        {
          question: "電商團隊該選哪一個？",
          answer:
            "如果你要持續整理大量商品圖並快速產出上架素材，Remove Anything 往往更合適，因為它直接覆蓋更多去背後的步驟。",
        },
      ],
      relatedToolsTitle: "比較完可以直接試用的工具",
      relatedTools: RELATED_TOOLS_TW,
    },
  },
};

export function getAlternativePage(
  variant: AlternativePageVariant,
  locale: AlternativePageLocale = "en",
) {
  const basePage = alternativePages[variant];
  const localization = alternativePageLocalizations[locale]?.[variant];

  if (!localization) {
    return basePage;
  }

  return {
    ...basePage,
    ...localization,
    verdict: {
      ...basePage.verdict,
      ...localization.verdict,
    },
    comparisonRows: localization.comparisonRows ?? basePage.comparisonRows,
    bestForColumns: localization.bestForColumns ?? basePage.bestForColumns,
    faqItems: localization.faqItems ?? basePage.faqItems,
    relatedTools: localization.relatedTools ?? basePage.relatedTools,
  };
}
