"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  ImageIcon,
  Package,
  ScanSearch,
  Sparkles,
  Zap,
} from "lucide-react";

import FormUpload, { formatSize } from "@/components/upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { trackEvent } from "@/lib/gtag";
import {
  BrowserImageOutputFormat,
  compressImageInBrowser,
  convertImageInBrowser,
  resizeImageInBrowser,
} from "@/lib/browser-image-processing";
import {
  BatchImageToolCopy,
  BatchImageToolVariant,
} from "@/lib/batch-image-tool-variants";

type UploadValue = {
  id?: string;
  url: string;
  completedUrl: string;
  key?: string;
  originFile?: File;
  md5?: string;
  fileType?: string;
  status?: "uploading" | "uploaded" | "processing" | "completed" | "error";
  error?: string;
};

type ProcessedImage = {
  id: string;
  fileName: string;
  processedUrl: string;
  blob: Blob;
  originalBytes: number;
  outputBytes: number;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
};

interface BatchImageToolClientProps {
  locale: string;
  variant: BatchImageToolVariant;
  copy: BatchImageToolCopy;
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getReductionPercent(originalBytes: number, outputBytes: number) {
  if (!originalBytes) {
    return 0;
  }

  return Math.round(((originalBytes - outputBytes) / originalBytes) * 100);
}

function isFormatConverterVariant(variant: BatchImageToolVariant) {
  return (
    variant === "batch-image-format-converter" ||
    variant === "png-to-jpg" ||
    variant === "jpg-to-png" ||
    variant === "webp-to-png"
  );
}

export default function BatchImageToolClient({
  locale,
  variant,
  copy,
}: BatchImageToolClientProps) {
  const [uploadedImages, setUploadedImages] = useState<UploadValue[]>([]);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [quality, setQuality] = useState(82);
  const [compressFormat, setCompressFormat] = useState<"jpeg" | "webp">("webp");
  const [convertFormat, setConvertFormat] =
    useState<Exclude<BrowserImageOutputFormat, "same">>("webp");
  const [resizeFormat, setResizeFormat] =
    useState<BrowserImageOutputFormat>("same");
  const [maxWidth, setMaxWidth] = useState("1600");
  const [maxHeight, setMaxHeight] = useState("1600");
  const processedImagesRef = useRef<ProcessedImage[]>([]);

  useEffect(() => {
    if (copy.defaultOutputFormat) {
      setConvertFormat(copy.defaultOutputFormat);
    }
  }, [copy.defaultOutputFormat]);

  useEffect(() => {
    processedImagesRef.current = processedImages;
  }, [processedImages]);

  useEffect(() => {
    return () => {
      processedImagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.processedUrl),
      );
    };
  }, []);

  const uploadedCount = uploadedImages.filter((image) => image.status === "uploaded").length;

  const summary = useMemo(() => {
    const totalOriginal = processedImages.reduce(
      (sum, image) => sum + image.originalBytes,
      0,
    );
    const totalOutput = processedImages.reduce(
      (sum, image) => sum + image.outputBytes,
      0,
    );
    const totalSaved = Math.max(0, totalOriginal - totalOutput);

    return {
      count: processedImages.length,
      totalOriginal,
      totalOutput,
      totalSaved,
      averageReduction: totalOriginal
        ? Math.round((totalSaved / totalOriginal) * 100)
        : 0,
    };
  }, [processedImages]);

  const processImages = async () => {
    const imagesToProcess = uploadedImages.filter(
      (image): image is UploadValue & { originFile: File } =>
        image.status === "uploaded" && !!image.originFile,
    );

    if (!imagesToProcess.length) {
      toast.error(
        locale === "tw"
          ? "请先上传至少一张图片"
          : "Please upload at least one image first",
      );
      return;
    }

    const nextMaxWidth = Number.parseInt(maxWidth, 10);
    const nextMaxHeight = Number.parseInt(maxHeight, 10);

    if (
      variant === "batch-image-resizer" &&
      (!Number.isFinite(nextMaxWidth) ||
        !Number.isFinite(nextMaxHeight) ||
        nextMaxWidth <= 0 ||
        nextMaxHeight <= 0)
    ) {
      toast.error(
        locale === "tw"
          ? "请输入有效的宽度和高度"
          : "Please enter valid width and height values",
      );
      return;
    }

    processedImages.forEach((image) => URL.revokeObjectURL(image.processedUrl));
    setProcessedImages([]);
    setIsProcessing(true);
    setProgress(0);
    trackEvent("batch_tool_process_started", {
      tool_variant: variant,
      image_count: imagesToProcess.length,
      output_format:
        variant === "batch-image-compressor"
          ? compressFormat
          : isFormatConverterVariant(variant)
            ? convertFormat
            : resizeFormat,
    });

    try {
      const nextResults: ProcessedImage[] = [];

      for (let index = 0; index < imagesToProcess.length; index += 1) {
        const current = imagesToProcess[index];
        const result =
          variant === "batch-image-compressor"
            ? await compressImageInBrowser(current.originFile, {
                format: compressFormat,
                quality: quality / 100,
              })
            : isFormatConverterVariant(variant)
              ? await convertImageInBrowser(current.originFile, {
                  format: convertFormat,
                  quality: quality / 100,
                })
              : await resizeImageInBrowser(current.originFile, {
                  format: resizeFormat,
                  quality: quality / 100,
                  maxWidth: nextMaxWidth,
                  maxHeight: nextMaxHeight,
                });

        nextResults.push({
          id: current.id ?? `${current.originFile.name}-${index}`,
          fileName: result.fileName,
          processedUrl: URL.createObjectURL(result.blob),
          blob: result.blob,
          originalBytes: result.originalBytes,
          outputBytes: result.outputBytes,
          originalWidth: result.originalWidth,
          originalHeight: result.originalHeight,
          outputWidth: result.outputWidth,
          outputHeight: result.outputHeight,
        });

        setProcessedImages([...nextResults]);
        setProgress(Math.round(((index + 1) / imagesToProcess.length) * 100));
      }

      toast.success(
        locale === "tw"
          ? `已处理 ${nextResults.length} 张图片`
          : `Processed ${nextResults.length} image${nextResults.length > 1 ? "s" : ""}`,
      );
      trackEvent("batch_tool_process_completed", {
        tool_variant: variant,
        image_count: nextResults.length,
        total_saved_bytes: nextResults.reduce(
          (sum, image) => sum + Math.max(0, image.originalBytes - image.outputBytes),
          0,
        ),
      });
    } catch (error) {
      console.error(error);
      trackEvent("batch_tool_process_failed", {
        tool_variant: variant,
      });
      toast.error(
        locale === "tw"
          ? "处理图片时发生错误，请重试"
          : "Something went wrong while processing images",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!processedImages.length) {
      return;
    }

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      processedImages.forEach((image) => {
        zip.file(image.fileName, image.blob);
      });

      const blob = await zip.generateAsync({ type: "blob" });
      trackEvent("batch_tool_zip_downloaded", {
        tool_variant: variant,
        image_count: processedImages.length,
      });
      triggerBlobDownload(blob, `${variant}.zip`);
    } catch (error) {
      console.error(error);
      toast.error(
        locale === "tw" ? "打包下载失败，请重试" : "Failed to build ZIP download",
      );
    }
  };

  return (
    <>
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>{copy.uploadTitle}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {copy.uploadDescription}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormUpload
              multiple
              maxFiles={30}
              value={uploadedImages}
              onChange={setUploadedImages}
              placeholder={
                <div className="text-center">
                  <p className="text-base font-medium">{copy.primaryCta}</p>
                  <p className="text-sm text-muted-foreground">{copy.secondaryCta}</p>
                </div>
              }
            />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                <span>
                  {copy.processedCountLabel}: {uploadedCount}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                <span>{locale === "tw" ? "最多 30 张" : "Up to 30 images per run"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.controlsTitle}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {copy.controlsDescription}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {variant === "batch-image-compressor" ? (
              <>
                <div className="space-y-2">
                  <Label>{copy.formatLabel}</Label>
                  <Select
                    value={compressFormat}
                    onValueChange={(value) =>
                      setCompressFormat(value as "jpeg" | "webp")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="webp">{copy.formatOptions.webp}</SelectItem>
                      <SelectItem value="jpeg">{copy.formatOptions.jpeg}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{copy.qualityLabel}</Label>
                    <span className="text-sm text-muted-foreground">{quality}%</span>
                  </div>
                  <Slider
                    min={45}
                    max={95}
                    step={1}
                    value={[quality]}
                    onValueChange={(value) => setQuality(value[0] ?? 82)}
                  />
                </div>
              </>
            ) : isFormatConverterVariant(variant) ? (
              <>
                <div className="space-y-2">
                  <Label>{copy.formatLabel}</Label>
                  {copy.lockedOutputFormat ? (
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      {copy.formatOptions[copy.defaultOutputFormat ?? convertFormat]}
                    </div>
                  ) : (
                    <Select
                      value={convertFormat}
                      onValueChange={(value) =>
                        setConvertFormat(
                          value as Exclude<BrowserImageOutputFormat, "same">,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="webp">{copy.formatOptions.webp}</SelectItem>
                        <SelectItem value="jpeg">{copy.formatOptions.jpeg}</SelectItem>
                        <SelectItem value="png">{copy.formatOptions.png}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{copy.qualityLabel}</Label>
                    <span className="text-sm text-muted-foreground">{quality}%</span>
                  </div>
                  <Slider
                    min={45}
                    max={100}
                    step={1}
                    value={[quality]}
                    onValueChange={(value) => setQuality(value[0] ?? 82)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="max-width">{copy.widthLabel}</Label>
                    <Input
                      id="max-width"
                      inputMode="numeric"
                      value={maxWidth}
                      onChange={(event) => setMaxWidth(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-height">{copy.heightLabel}</Label>
                    <Input
                      id="max-height"
                      inputMode="numeric"
                      value={maxHeight}
                      onChange={(event) => setMaxHeight(event.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{copy.formatLabel}</Label>
                  <Select
                    value={resizeFormat}
                    onValueChange={(value) =>
                      setResizeFormat(value as BrowserImageOutputFormat)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="same">{copy.formatOptions.same}</SelectItem>
                      <SelectItem value="webp">{copy.formatOptions.webp}</SelectItem>
                      <SelectItem value="jpeg">{copy.formatOptions.jpeg}</SelectItem>
                      <SelectItem value="png">{copy.formatOptions.png}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{copy.qualityLabel}</Label>
                    <span className="text-sm text-muted-foreground">{quality}%</span>
                  </div>
                  <Slider
                    min={45}
                    max={100}
                    step={1}
                    value={[quality]}
                    onValueChange={(value) => setQuality(value[0] ?? 82)}
                  />
                </div>
              </>
            )}

            <Button className="w-full" size="lg" onClick={processImages} disabled={isProcessing}>
              {isProcessing ? copy.processingLabel : copy.processLabel}
            </Button>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>{copy.processedCountLabel}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold">{summary.count}</p>
              </div>
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4" />
                  <span>{copy.savedLabel}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold">
                  {formatSize(summary.totalSaved)}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ScanSearch className="h-4 w-4" />
                  <span>{locale === "tw" ? "平均压缩率" : "Avg. reduction"}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold">
                  {summary.averageReduction}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>{copy.resultTitle}</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              {copy.resultDescription}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleDownloadZip}
            disabled={!processedImages.length || isProcessing}
          >
            <Download className="mr-2 h-4 w-4" />
            {copy.downloadZipLabel}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {isProcessing ? <Progress value={progress} /> : null}

          {processedImages.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {processedImages.map((image) => {
                const reduction = getReductionPercent(
                  image.originalBytes,
                  image.outputBytes,
                );

                return (
                  <Card key={image.id} className="overflow-hidden">
                    <div className="aspect-[4/3] bg-muted">
                      <img
                        src={image.processedUrl}
                        alt={image.fileName}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="line-clamp-2 text-sm font-medium">
                            {image.fileName}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatSize(image.originalBytes)} →{" "}
                            {formatSize(image.outputBytes)}
                          </p>
                        </div>
                        <div className="rounded-md border px-2 py-1 text-xs font-medium">
                          {reduction >= 0 ? "-" : "+"}
                          {Math.abs(reduction)}%
                        </div>
                      </div>

                      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                        <p>
                          {image.originalWidth}×{image.originalHeight} →{" "}
                          {image.outputWidth}×{image.outputHeight}
                        </p>
                      </div>

                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => {
                          trackEvent("batch_tool_single_downloaded", {
                            tool_variant: variant,
                            file_name: image.fileName,
                          });
                          triggerBlobDownload(image.blob, image.fileName);
                        }}
                      >
                        {copy.downloadSingleLabel}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <p className="text-lg font-medium">{copy.emptyStateTitle}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {copy.emptyStateDescription}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
