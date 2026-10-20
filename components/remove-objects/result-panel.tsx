"use client";

import {
  Download,
  Eraser,
  Paintbrush,
  Sparkles,
  Square,
  Undo2,
  Wand2,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type RemoveObjectsResultPanelProps = {
  state:
    | "idle"
    | "editing"
    | "detecting"
    | "ready"
    | "processing"
    | "succeeded"
    | "failed";
  outputImageUrl?: string;
  authorizationConfirmed: boolean;
  errorMessage?: string;
  hasBoxSelection: boolean;
  hasMask: boolean;
  mode: "brush" | "erase" | "box";
  brushSize: number;
  canPaintMask: boolean;
  canRemove: boolean;
  isBusy?: boolean;
  onModeChange: (mode: "brush" | "erase" | "box") => void;
  onBrushSizeChange: (value: number) => void;
  onUndo: () => void;
  onRefineSelection: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onEditAgain: () => void;
  onDownload: () => void;
  onAuthorizationChange: (confirmed: boolean) => void;
};

function toDisplaySafeUrl(url?: string) {
  if (!url) {
    return "";
  }

  if (url.startsWith("/api/proxy-image?url=") || url.startsWith("blob:")) {
    return url;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }

  return url;
}

function downloadFile(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function RemoveObjectsResultPanel({
  state,
  outputImageUrl,
  authorizationConfirmed,
  errorMessage,
  hasBoxSelection,
  hasMask,
  mode,
  brushSize,
  canPaintMask,
  canRemove,
  isBusy,
  onModeChange,
  onBrushSizeChange,
  onUndo,
  onRefineSelection,
  onRemove,
  onRetry,
  onEditAgain,
  onDownload,
  onAuthorizationChange,
}: RemoveObjectsResultPanelProps) {
  const t = useTranslations("RemoveObjectsPage");

  return (
    <div className="space-y-4">
      {state === "detecting" || state === "processing" ? (
        <div className="rounded-full border border-primary/30 bg-primary/5 px-3 py-2 text-center text-xs font-medium text-foreground">
          {state === "detecting"
            ? "正在生成遮罩，接著會自動移除物體"
            : "正在生成最終圖片，通常約 40 秒，偶爾會再久一點"}
        </div>
      ) : null}

      {state === "succeeded" ? (
        <div className="space-y-2">
          <div className="rounded-full border border-primary/30 bg-primary/5 px-3 py-2 text-center text-xs font-medium text-foreground">
            已完成，最終圖片已生成
          </div>
          <Button
            type="button"
            onClick={onDownload}
            disabled={!outputImageUrl}
            className="w-full gap-2"
          >
            <Download className="size-4" />
            {t("result.download")}
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2 text-xs">
        {[
          { label: "1. 框選", active: hasBoxSelection },
          { label: "2. 遮罩", active: hasMask },
          { label: "3. 移除", active: hasMask && canRemove },
        ].map((step) => (
          <div
            key={step.label}
            className={cn(
              "rounded-full border px-3 py-2 text-center font-medium",
              step.active
                ? "border-primary/30 bg-primary/5 text-foreground"
                : "border-dashed text-muted-foreground/80",
            )}
          >
            {step.label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            選擇工具
          </p>
          {!hasMask ? (
            <div className="grid grid-cols-1 gap-2">
              <Button
                type="button"
                variant={mode === "box" ? "default" : "outline"}
                onClick={() => onModeChange("box")}
                disabled={isBusy}
                className="gap-2"
              >
                <Square className="size-4" />
                Box
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={mode === "box" ? "default" : "outline"}
                onClick={() => onModeChange("box")}
                disabled={isBusy}
                className="gap-2"
              >
                <Square className="size-4" />
                Box
              </Button>
              <Button
                type="button"
                variant={mode === "brush" ? "default" : "outline"}
                onClick={() => onModeChange("brush")}
                disabled={isBusy || !canPaintMask}
                className="gap-2"
              >
                <Paintbrush className="size-4" />
                Brush
              </Button>
              <Button
                type="button"
                variant={mode === "erase" ? "default" : "outline"}
                onClick={() => onModeChange("erase")}
                disabled={isBusy || !canPaintMask}
                className="gap-2"
              >
                <Eraser className="size-4" />
                Erase
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            筆刷大小
          </p>
          <div className="rounded-xl border p-3">
            <div className="mb-2 text-right text-xs text-muted-foreground">
              {brushSize}px
            </div>
            <Slider
              value={[brushSize]}
              min={8}
              max={96}
              step={2}
              onValueChange={(value) =>
                onBrushSizeChange(value[0] ?? brushSize)
              }
              disabled={isBusy || mode === "box" || !canPaintMask}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          onClick={onRefineSelection}
          disabled={!hasBoxSelection || isBusy}
          className="gap-2"
        >
          <Wand2 className="size-4" />
          Refine
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onUndo}
          disabled={isBusy || !canPaintMask}
          className="gap-2"
        >
          <Undo2 className="size-4" />
          {t("toolbar.undo")}
        </Button>
      </div>

      <label className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Checkbox
          checked={authorizationConfirmed}
          onCheckedChange={(checked) => onAuthorizationChange(checked === true)}
          disabled={isBusy}
          aria-label="Confirm image authorization"
        />
        <span>I confirm that I own or am authorized to edit this image.</span>
      </label>

      <Button
        type="button"
        onClick={onRemove}
        disabled={
          !canRemove ||
          isBusy ||
          state === "succeeded" ||
          !authorizationConfirmed
        }
        className="w-full gap-2"
      >
        <Sparkles className="size-4" />
        {t("result.submit")}
      </Button>

      {state === "failed" ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">
            {errorMessage ||
              "Object removal failed. Adjust the mask and try again."}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button type="button" onClick={onRetry}>
              {t("result.retry")}
            </Button>
            <Button type="button" variant="outline" onClick={onEditAgain}>
              {t("result.editAgain")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
