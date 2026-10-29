import { locales, type Locale } from "@/config";

export type ToolType =
  | "background-removal"
  | "object-removal"
  | "watermark-removal"
  | "background-editing"
  | "batch-image"
  | "format-conversion";

export type ToolLimits = {
  maxFileSizeMb: number;
  maxFiles: number;
  /** Input decoder safety limit, independent of any provider cost approval. */
  maxPixels?: number;
  /** Maximum generated file size that the page and API promise. */
  maxOutputSizeMb: number;
  /** Maximum wall-clock time before the task is marked expired/failed. */
  timeoutSeconds: number;
  /** Automatic provider retries; manual retries remain idempotent. */
  maxAutomaticRetries: number;
  /** Credits consumed by a retry, when retrying is explicitly chargeable. */
  retryCreditCost: number;
};

export type ToolRegistryEntry = {
  slug: string;
  canonicalPath: `/${string}`;
  indexable: boolean;
  primaryKeyword: string;
  availableLocales: readonly Locale[];
  toolType: ToolType;
  inputFormats: readonly string[];
  outputFormats: readonly string[];
  limits: ToolLimits;
  /** A configured baseline is not an approval to consume credits. */
  creditCost: number | null;
  costApproval?: {
    creditCost: number;
    approvedBy: string;
    approvedAt: string;
    evidenceReference: string;
  };
  paidEnabled: boolean;
  primaryCta: string;
  lastModified: string;
  resultExpiryHours: number;
  relatedSlugs: readonly string[];
  sitemapPriority: number;
  sitemapChangeFrequency: "daily" | "weekly" | "monthly";
};

const singleImageLimits = {
  maxFileSizeMb: 10,
  maxFiles: 1,
  maxPixels: 40_000_000,
  maxOutputSizeMb: 10,
  timeoutSeconds: 120,
  maxAutomaticRetries: 1,
  retryCreditCost: 0,
} as const;

const batchImageLimits = {
  maxFileSizeMb: 50,
  maxFiles: 30,
  maxOutputSizeMb: 50,
  timeoutSeconds: 300,
  maxAutomaticRetries: 1,
  retryCreditCost: 0,
} as const;

const imageInputFormats = ["image/jpeg", "image/png", "image/webp"] as const;
const imageOutputFormats = ["image/png", "image/jpeg", "image/webp"] as const;

/**
 * The canonical source for tool identity, capability disclosures, and SEO.
 * Keep page metadata and sitemap decisions derived from this list instead of
 * duplicating indexability decisions in individual routes.
 */
export const toolRegistry = [
  {
    slug: "remove-background",
    canonicalPath: "/remove-background",
    indexable: true,
    primaryKeyword: "AI background remover",
    availableLocales: locales,
    toolType: "background-removal",
    inputFormats: imageInputFormats,
    outputFormats: ["image/png"],
    limits: singleImageLimits,
    creditCost: 2,
    costApproval: {
      creditCost: 2,
      approvedBy: "liulanggoukk@gmail.com",
      approvedAt: "2026-10-29",
      evidenceReference:
        "openspec/changes/p0-growth-funnel-foundation/evidence/cost-approval-20261029.md",
    },
    paidEnabled: true,
    primaryCta: "Upload an image",
    lastModified: "2026-10-14",
    resultExpiryHours: 24,
    relatedSlugs: [
      "transparent-png-maker",
      "white-background-maker",
      "change-background-color",
    ],
    sitemapPriority: 1,
    sitemapChangeFrequency: "daily",
  },
  {
    slug: "remove-objects",
    canonicalPath: "/remove-objects",
    indexable: true,
    primaryKeyword: "AI object remover",
    availableLocales: locales,
    toolType: "object-removal",
    inputFormats: imageInputFormats,
    outputFormats: ["image/png", "image/jpeg", "image/webp"],
    limits: singleImageLimits,
    creditCost: null,
    paidEnabled: false,
    primaryCta: "Upload an image",
    lastModified: "2026-10-14",
    resultExpiryHours: 24,
    relatedSlugs: [
      "remove-background",
      "remove-watermark",
      "transparent-png-maker",
    ],
    sitemapPriority: 0.98,
    sitemapChangeFrequency: "daily",
  },
  {
    slug: "transparent-png-maker",
    canonicalPath: "/transparent-png-maker",
    indexable: true,
    primaryKeyword: "transparent PNG maker",
    availableLocales: locales,
    toolType: "background-editing",
    inputFormats: imageInputFormats,
    outputFormats: ["image/png"],
    limits: singleImageLimits,
    creditCost: 2,
    paidEnabled: false,
    primaryCta: "Make a transparent PNG",
    lastModified: "2026-10-14",
    resultExpiryHours: 24,
    relatedSlugs: [
      "remove-background",
      "white-background-maker",
      "change-background-color",
    ],
    sitemapPriority: 0.95,
    sitemapChangeFrequency: "daily",
  },
  {
    slug: "white-background-maker",
    canonicalPath: "/white-background-maker",
    indexable: true,
    primaryKeyword: "white background maker",
    availableLocales: locales,
    toolType: "background-editing",
    inputFormats: imageInputFormats,
    outputFormats: ["image/png"],
    limits: singleImageLimits,
    creditCost: 2,
    paidEnabled: false,
    primaryCta: "Make a white background",
    lastModified: "2026-10-14",
    resultExpiryHours: 24,
    relatedSlugs: [
      "remove-background",
      "transparent-png-maker",
      "change-background-color",
    ],
    sitemapPriority: 0.95,
    sitemapChangeFrequency: "daily",
  },
  {
    slug: "change-background-color",
    canonicalPath: "/change-background-color",
    indexable: true,
    primaryKeyword: "change image background color",
    availableLocales: locales,
    toolType: "background-editing",
    inputFormats: imageInputFormats,
    outputFormats: ["image/png"],
    limits: singleImageLimits,
    creditCost: 2,
    paidEnabled: false,
    primaryCta: "Change the background color",
    lastModified: "2026-10-14",
    resultExpiryHours: 24,
    relatedSlugs: [
      "remove-background",
      "transparent-png-maker",
      "white-background-maker",
    ],
    sitemapPriority: 0.9,
    sitemapChangeFrequency: "daily",
  },
  {
    slug: "remove-watermark",
    canonicalPath: "/remove-watermark",
    indexable: true,
    primaryKeyword: "AI watermark remover",
    availableLocales: locales,
    toolType: "watermark-removal",
    inputFormats: imageInputFormats,
    outputFormats: ["application/zip"],
    limits: singleImageLimits,
    creditCost: 1,
    paidEnabled: false,
    primaryCta: "Upload an image",
    lastModified: "2026-10-14",
    resultExpiryHours: 24,
    relatedSlugs: [
      "remove-objects",
      "remove-background",
      "transparent-png-maker",
    ],
    sitemapPriority: 0.8,
    sitemapChangeFrequency: "weekly",
  },
  {
    slug: "batch-remove-background",
    canonicalPath: "/batch-remove-background",
    indexable: true,
    primaryKeyword: "batch background remover",
    availableLocales: locales,
    toolType: "batch-image",
    inputFormats: imageInputFormats,
    outputFormats: ["image/png"],
    limits: {
      ...batchImageLimits,
      maxFileSizeMb: 100,
      maxFiles: 50,
      maxOutputSizeMb: 100,
    },
    creditCost: 2,
    paidEnabled: false,
    primaryCta: "Upload images",
    lastModified: "2026-10-14",
    resultExpiryHours: 24,
    relatedSlugs: ["remove-background", "transparent-png-maker"],
    sitemapPriority: 0.9,
    sitemapChangeFrequency: "weekly",
  },
  {
    slug: "batch-image-compressor",
    canonicalPath: "/batch-image-compressor",
    indexable: true,
    primaryKeyword: "batch image compressor",
    availableLocales: locales,
    toolType: "batch-image",
    inputFormats: imageInputFormats,
    outputFormats: imageOutputFormats,
    limits: batchImageLimits,
    creditCost: 0,
    paidEnabled: false,
    primaryCta: "Compress images",
    lastModified: "2026-10-14",
    resultExpiryHours: 24,
    relatedSlugs: ["batch-image-resizer", "batch-image-format-converter"],
    sitemapPriority: 0.88,
    sitemapChangeFrequency: "weekly",
  },
  {
    slug: "batch-image-resizer",
    canonicalPath: "/batch-image-resizer",
    indexable: true,
    primaryKeyword: "batch image resizer",
    availableLocales: locales,
    toolType: "batch-image",
    inputFormats: imageInputFormats,
    outputFormats: imageOutputFormats,
    limits: batchImageLimits,
    creditCost: 0,
    paidEnabled: false,
    primaryCta: "Resize images",
    lastModified: "2026-10-14",
    resultExpiryHours: 24,
    relatedSlugs: ["batch-image-compressor", "batch-image-format-converter"],
    sitemapPriority: 0.88,
    sitemapChangeFrequency: "weekly",
  },
  {
    slug: "batch-image-format-converter",
    canonicalPath: "/batch-image-format-converter",
    indexable: true,
    primaryKeyword: "batch image format converter",
    availableLocales: locales,
    toolType: "format-conversion",
    inputFormats: imageInputFormats,
    outputFormats: imageOutputFormats,
    limits: batchImageLimits,
    creditCost: 0,
    paidEnabled: false,
    primaryCta: "Convert images",
    lastModified: "2026-10-14",
    resultExpiryHours: 24,
    relatedSlugs: ["batch-image-compressor", "batch-image-resizer"],
    sitemapPriority: 0.88,
    sitemapChangeFrequency: "weekly",
  },
  {
    slug: "png-to-jpg",
    canonicalPath: "/png-to-jpg",
    indexable: true,
    primaryKeyword: "PNG to JPG converter",
    availableLocales: locales,
    toolType: "format-conversion",
    inputFormats: ["image/png"],
    outputFormats: ["image/jpeg"],
    limits: batchImageLimits,
    creditCost: 0,
    paidEnabled: false,
    primaryCta: "Convert PNG to JPG",
    lastModified: "2026-10-14",
    resultExpiryHours: 24,
    relatedSlugs: ["jpg-to-png", "webp-to-png", "batch-image-format-converter"],
    sitemapPriority: 0.86,
    sitemapChangeFrequency: "weekly",
  },
  {
    slug: "jpg-to-png",
    canonicalPath: "/jpg-to-png",
    indexable: true,
    primaryKeyword: "JPG to PNG converter",
    availableLocales: locales,
    toolType: "format-conversion",
    inputFormats: ["image/jpeg"],
    outputFormats: ["image/png"],
    limits: batchImageLimits,
    creditCost: 0,
    paidEnabled: false,
    primaryCta: "Convert JPG to PNG",
    lastModified: "2026-10-14",
    resultExpiryHours: 24,
    relatedSlugs: ["png-to-jpg", "webp-to-png", "batch-image-format-converter"],
    sitemapPriority: 0.86,
    sitemapChangeFrequency: "weekly",
  },
  {
    slug: "webp-to-png",
    canonicalPath: "/webp-to-png",
    indexable: true,
    primaryKeyword: "WebP to PNG converter",
    availableLocales: locales,
    toolType: "format-conversion",
    inputFormats: ["image/webp"],
    outputFormats: ["image/png"],
    limits: { ...singleImageLimits, maxFiles: 10 },
    creditCost: 0,
    paidEnabled: false,
    primaryCta: "Convert WebP to PNG",
    lastModified: "2026-10-14",
    resultExpiryHours: 24,
    relatedSlugs: ["png-to-jpg", "jpg-to-png", "batch-image-format-converter"],
    sitemapPriority: 0.86,
    sitemapChangeFrequency: "weekly",
  },
  {
    slug: "batch-watermark-removal",
    canonicalPath: "/batch-watermark-removal",
    indexable: true,
    primaryKeyword: "batch watermark remover",
    availableLocales: locales,
    toolType: "batch-image",
    inputFormats: imageInputFormats,
    outputFormats: ["application/zip"],
    limits: { ...singleImageLimits, maxFiles: 10 },
    creditCost: 1,
    paidEnabled: false,
    primaryCta: "Upload images",
    lastModified: "2026-10-14",
    resultExpiryHours: 24,
    relatedSlugs: ["remove-watermark", "remove-objects"],
    sitemapPriority: 0.78,
    sitemapChangeFrequency: "weekly",
  },
  {
    slug: "sora2-video-watermark-removal",
    canonicalPath: "/sora2-video-watermark-removal",
    indexable: true,
    primaryKeyword: "Sora 2 video watermark remover",
    availableLocales: locales,
    toolType: "watermark-removal",
    inputFormats: ["video/mp4", "video/webm"],
    outputFormats: ["video/mp4"],
    limits: {
      maxFileSizeMb: 500,
      maxFiles: 1,
      maxOutputSizeMb: 500,
      timeoutSeconds: 600,
      maxAutomaticRetries: 1,
      retryCreditCost: 0,
    },
    creditCost: null,
    paidEnabled: false,
    primaryCta: "Upload a video",
    lastModified: "2026-10-14",
    resultExpiryHours: 24,
    relatedSlugs: ["remove-watermark", "batch-watermark-removal"],
    sitemapPriority: 0.7,
    sitemapChangeFrequency: "weekly",
  },
] as const satisfies readonly ToolRegistryEntry[];

export const TOOL_REGISTRY = toolRegistry;

export type ToolSlug = (typeof toolRegistry)[number]["slug"];

export function getToolRegistryEntry(
  identifier: string,
): ToolRegistryEntry | undefined {
  const normalized = identifier.startsWith("/") ? identifier : `/${identifier}`;
  return toolRegistry.find(
    (entry) => entry.slug === identifier || entry.canonicalPath === normalized,
  );
}

export function getIndexableTools() {
  return toolRegistry.filter((entry) => entry.indexable);
}

export function getRelatedToolRegistryEntries(identifier: string) {
  const entry = getToolRegistryEntry(identifier);
  if (!entry) {
    return [];
  }

  return entry.relatedSlugs
    .map((slug) => getToolRegistryEntry(slug))
    .filter((related): related is ToolRegistryEntry =>
      Boolean(related && related.indexable),
    );
}

/**
 * Paid output is deliberately opt-in. A null, non-finite, or otherwise
 * incomplete cost decision can never turn on a credit charge accidentally.
 */
export function hasApprovedCreditCost(entry: ToolRegistryEntry) {
  const approval = entry.costApproval;
  return (
    Boolean(
      approval &&
        approval.creditCost === entry.creditCost &&
        approval.approvedBy.trim() &&
        /^\d{4}-\d{2}-\d{2}$/.test(approval.approvedAt) &&
        Number.isFinite(Date.parse(approval.approvedAt)) &&
        approval.evidenceReference.trim(),
    ) &&
    Number.isFinite(entry.creditCost) &&
    (entry.creditCost ?? 0) > 0 &&
    Number.isFinite(entry.limits.retryCreditCost) &&
    entry.limits.retryCreditCost >= 0 &&
    Number.isFinite(entry.limits.timeoutSeconds) &&
    entry.limits.timeoutSeconds > 0 &&
    Number.isFinite(entry.limits.maxOutputSizeMb) &&
    entry.limits.maxOutputSizeMb > 0
  );
}

export function isPaidToolEnabled(identifier: string | ToolRegistryEntry) {
  const entry =
    typeof identifier === "string"
      ? getToolRegistryEntry(identifier)
      : identifier;
  return Boolean(entry && entry.paidEnabled && hasApprovedCreditCost(entry));
}

export function assertPaidToolEnabled(identifier: string | ToolRegistryEntry) {
  const entry =
    typeof identifier === "string"
      ? getToolRegistryEntry(identifier)
      : identifier;
  if (!entry || !isPaidToolEnabled(entry)) {
    throw new Error(
      "Paid output is not enabled until this tool has an approved credit cost",
    );
  }
  return entry;
}
