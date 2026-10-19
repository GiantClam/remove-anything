import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Locale } from "@/config";
import { Link } from "@/lib/navigation";
import { buildBreadcrumbListSchema, buildLocalizedUrl } from "@/lib/seo";
import {
  getRelatedToolRegistryEntries,
  getToolRegistryEntry,
} from "@/lib/tool-registry";

type ToolContractDetailsProps = {
  locale: Locale;
  toolSlug: string;
  /** Background variants already render their own FAQ and related-tool sections. */
  includeSeoSections?: boolean;
};

function formatList(values: readonly string[]) {
  return values
    .map((value) =>
      value.replace(/^(?:image|application|video)\//, "").toUpperCase(),
    )
    .join(", ");
}

function copy(locale: string) {
  return locale === "zh-tw"
    ? {
        contract: "限制與輸出說明",
        input: "輸入",
        output: "輸出",
        expiry: "結果保存",
        credits: "點數",
        faq: "常見問題",
        related: "相關工具",
        maxFile: (value: number) => `單檔上限 ${value} MB`,
        maxFiles: (value: number) => `最多 ${value} 個檔案`,
        maxPixels: (value: number) => `輸入安全限制：${value / 1_000_000} MP`,
        outputLimit: (value: number) => `輸出檔案上限 ${value} MB`,
        expiryText: (value: number) =>
          `結果存取權在 ${value} 小時後到期。您也可以聯絡我們要求提前刪除。`,
        creditText: (value: number | null) =>
          value === null
            ? "此工具尚未啟用付費點數。"
            : `付費處理基準為 ${value} 點；免費額度由伺服器判定，付費完整輸出尚未開放。`,
        faqItems: [
          [
            "支援哪些檔案？",
            "請使用頁面列出的輸入格式與大小上限；超出上限會在上傳時被拒絕。",
          ],
          [
            "輸出會保存多久？",
            "結果存取權在頁面標示的時間後到期。請及時下載；您也可以聯絡我們要求提前刪除。",
          ],
          [
            "失敗時會重複扣點嗎？",
            "可從錯誤狀態按重試。伺服器使用任務冪等鍵避免同一次操作重複計費。",
          ],
        ],
      }
    : {
        contract: "Limits and output",
        input: "Input",
        output: "Output",
        expiry: "Result retention",
        credits: "Credits",
        faq: "FAQs",
        related: "Related tools",
        maxFile: (value: number) => `${value} MB per file`,
        maxFiles: (value: number) =>
          `Up to ${value} file${value === 1 ? "" : "s"}`,
        maxPixels: (value: number) =>
          `${value / 1_000_000} MP input safety limit`,
        outputLimit: (value: number) => `${value} MB maximum output`,
        expiryText: (value: number) =>
          `Result access expires after ${value} hours. Contact us to request earlier deletion.`,
        creditText: (value: number | null) =>
          value === null
            ? "Paid credits are not enabled for this tool yet."
            : `${value} credit${value === 1 ? "" : "s"} is the paid processing baseline. Free allowance is checked by the server; paid full output is not available yet.`,
        faqItems: [
          [
            "Which files are supported?",
            "Use the input formats and size limits listed here. Files outside those limits are rejected before processing.",
          ],
          [
            "How long is my result kept?",
            "Result access expires after the period shown here. Download promptly or contact us to request earlier deletion.",
          ],
          [
            "Will a failed retry charge me twice?",
            "Use the retry action shown after a failure. The server reuses the task idempotency contract so one action is not charged twice.",
          ],
        ],
      };
}

export function ToolContractCard({
  locale,
  toolSlug,
}: Omit<ToolContractDetailsProps, "includeSeoSections">) {
  const entry = getToolRegistryEntry(toolSlug);
  if (!entry) return null;
  const t = copy(locale);

  return (
    <Card className="mb-8" data-tool-contract={entry.slug}>
      <CardHeader>
        <CardTitle>{t.contract}</CardTitle>
        <CardDescription>{entry.primaryKeyword}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm md:grid-cols-3">
        <div>
          <p className="font-medium">{t.input}</p>
          <p className="text-muted-foreground">
            {formatList(entry.inputFormats)}
          </p>
          <p className="text-muted-foreground">
            {t.maxFile(entry.limits.maxFileSizeMb)} ·{" "}
            {t.maxFiles(entry.limits.maxFiles)}
          </p>
          {entry.limits.maxPixels ? (
            <p className="text-muted-foreground">
              {t.maxPixels(entry.limits.maxPixels)}
            </p>
          ) : null}
        </div>
        <div>
          <p className="font-medium">{t.output}</p>
          <p className="text-muted-foreground">
            {formatList(entry.outputFormats)}
          </p>
          <p className="text-muted-foreground">
            {t.outputLimit(entry.limits.maxOutputSizeMb)}
          </p>
        </div>
        <div>
          <p className="font-medium">{t.expiry}</p>
          <p className="text-muted-foreground">
            {t.expiryText(entry.resultExpiryHours)}
          </p>
          <p className="text-muted-foreground">
            {t.credits}: {t.creditText(entry.creditCost)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ToolContractDetails({
  locale,
  toolSlug,
  includeSeoSections = true,
}: ToolContractDetailsProps) {
  const entry = getToolRegistryEntry(toolSlug);
  if (!entry) return null;
  const t = copy(locale);
  const pageUrl = buildLocalizedUrl(locale, entry.canonicalPath);
  const related = getRelatedToolRegistryEntries(entry.slug);
  const faqItems = t.faqItems;

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: entry.primaryKeyword,
    description: `${entry.primaryKeyword} supporting ${formatList(entry.inputFormats)} input and ${formatList(entry.outputFormats)} output.`,
    applicationCategory: "PhotoEditingApplication",
    operatingSystem: "Web",
    url: pageUrl,
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
  const breadcrumbSchema = buildBreadcrumbListSchema(locale, [
    { name: locale === "zh-tw" ? "首頁" : "Home", path: "/" },
    { name: entry.primaryKeyword, path: entry.canonicalPath },
  ]);

  return (
    <>
      <ToolContractCard locale={locale} toolSlug={toolSlug} />
      {includeSeoSections ? (
        <>
          <script
            id={`${entry.slug}-software-schema`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
          />
          <script
            id={`${entry.slug}-faq-schema`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
          />
          <script
            id={`${entry.slug}-breadcrumb-schema`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(breadcrumbSchema),
            }}
          />

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{t.faq}</CardTitle>
              <CardDescription>
                {t.expiryText(entry.resultExpiryHours)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqItems.map(([question, answer], index) => (
                  <AccordionItem
                    key={question}
                    value={`${entry.slug}-faq-${index}`}
                  >
                    <AccordionTrigger className="text-left">
                      {question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-6 text-muted-foreground">
                      {answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{t.related}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((tool) => (
                <Link
                  key={tool.slug}
                  href={tool.canonicalPath}
                  locale={locale}
                  className="rounded-xl border p-4 transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <span className="font-medium">{tool.primaryKeyword}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {tool.canonicalPath}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </>
  );
}
