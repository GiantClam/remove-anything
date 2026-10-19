"use client";

import React, { useState } from "react";

import { ArrowDownToLine, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import SignBox from "@/components/sign-box";
import { getErrorMessage } from "@/lib/handle-error";

export function DownloadAction({
  id,
  disabled,
  showText,
  taskType = "image",
}: {
  id: string;
  disabled?: boolean;
  showText?: boolean;
  taskType?:
    | "image"
    | "background-removal"
    | "watermark-removal"
    | "sora2-video-watermark-removal";
}) {
  const namespace =
    taskType === "sora2-video-watermark-removal"
      ? "Sora2VideoWatermarkRemovalPage"
      : "History";
  const t = useTranslations(namespace);
  const [isDownloading, setIsDownloading] = useState(false);

  const download = async () => {
    if (isDownloading || disabled) return;
    setIsDownloading(true);
    try {
      const taskId = encodeURIComponent(id);
      const apiUrl =
        taskType === "background-removal"
          ? `/api/download-background?taskId=${taskId}`
          : `/api/download?taskId=${taskId}${taskType === "image" ? "" : `&type=${taskType}`}`;
      const response = await fetch(apiUrl, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        const message = response.headers
          .get("content-type")
          ?.includes("application/json")
          ? (await response.json()).error
          : await response.text();
        throw new Error(message || `Download failed (${response.status})`);
      }

      const blob = await response.blob();
      const extension =
        taskType === "watermark-removal"
          ? "zip"
          : taskType === "sora2-video-watermark-removal"
            ? "mp4"
            : taskType === "background-removal"
              ? "png"
              : "jpg";
      const filename =
        response.headers
          .get("content-disposition")
          ?.match(/filename="([^"]+)"/i)?.[1] ||
        `result-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}.${extension}`;
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
          toast.success(t("action.downloadSuccess"));
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError")
            return;
          // A declined or unavailable share can still use the fetched file.
        }
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast.success(t("action.downloadSuccess"));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDownloading(false);
    }
  };

  const button = (
    <button
      type="button"
      aria-label={t("action.download")}
      disabled={disabled || isDownloading}
      className="focus-ring text-content-strong border-stroke-strong hover:border-stroke-stronger data-[state=open]:bg-surface-alpha-light inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg border bg-transparent px-2.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
      onClick={() => void download()}
    >
      {isDownloading ? (
        <Loader2 className="icon-xs animate-spin" />
      ) : (
        <ArrowDownToLine className="icon-xs" />
      )}
      {showText && <span className="ml-2">{t("action.download")}</span>}
    </button>
  );

  // These task routes authorize the signed anonymous cookie server-side.
  return taskType === "background-removal" ||
    taskType === "watermark-removal" ? (
    button
  ) : (
    <SignBox>{button}</SignBox>
  );
}
