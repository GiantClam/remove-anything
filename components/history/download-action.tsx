"use client";

import React, { useState, useTransition } from "react";

import { useAuth } from "@/hooks/use-auth";
import { ArrowDownToLine, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import SignBox from "@/components/sign-box";

import { getErrorMessage } from "@/lib/handle-error";

export function DownloadAction({
  id,
  disabled,
  showText,
  taskType = "flux",
}: {
  id: string;
  disabled?: boolean;
  showText?: boolean;
  taskType?: "flux" | "background-removal" | "watermark-removal" | "sora2-video-watermark-removal";
}) {
  // 根据任务类型选择不同的国际化命名空间
  const namespace = taskType === "sora2-video-watermark-removal" ? "Sora2VideoWatermarkRemovalPage" : "History";
  const t = useTranslations(namespace);
  const [isDownloading, startDownloadTransition] = useTransition();
  const [isPending, setIsPending] = useState(false);
  const { userId } = useAuth();

  const download = async (id: string) => {
    if (isDownloading || isPending) {
      return;
    }
    startDownloadTransition(() => {
      toast.promise(
        async () => {
          setIsPending(true);
          
          try {
            // 根据任务类型选择不同的API端点和文件名
            let apiUrl: string;
            let fileName: string;
            let fileExtension: string;
            
            if (taskType === "background-removal") {
              apiUrl = `/api/download-background?taskId=${id}`;
              fileExtension = "png";
              fileName = `background-removed-${id}.${fileExtension}`;
            } else if (taskType === "watermark-removal") {
              apiUrl = `/api/download?taskId=${id}&type=watermark-removal`;
              fileExtension = "zip";
              fileName = `watermark-removed-${id}.${fileExtension}`;
            } else if (taskType === "sora2-video-watermark-removal") {
              apiUrl = `/api/download?taskId=${id}&type=sora2-video-watermark-removal`;
              fileExtension = "mp4";
              fileName = `sora2-video-watermark-removed-${id}.${fileExtension}`;
            } else {
              apiUrl = `/api/download?fluxId=${id}`;
              fileExtension = "jpg";
              fileName = `flux-${id}.${fileExtension}`;
            }
            
            console.log("🔍 开始下载:", { apiUrl, fileName, taskType });
            
            // 直接下载：不再创建 blob，交给浏览器/系统下载器处理
            const absUrl = apiUrl.startsWith('http') ? apiUrl : `${window.location.origin}${apiUrl}`;

            // 优先尝试 Web Share API 分享链接（部分移动端可直接保存到相册/文件）
            try {
              // @ts-ignore
              if (navigator.share && typeof navigator.share === 'function') {
                // @ts-ignore
                await navigator.share({ url: absUrl, title: fileName, text: fileName });
                console.log("✅ 使用 Web Share API 分享链接成功");
                return;
              }
            } catch (e) {
              console.log("ℹ️ Web Share API（url）不可用或被拒绝，使用直接下载回退", e);
            }

            // 平台检测
            const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
            const isIOS = /iP(hone|od|ad)/.test(ua);
            const isAndroid = /Android/.test(ua);
            const isMobile = isIOS || isAndroid;

            if (isMobile) {
              // 移动端：优先尝试直接下载到相册/文件管理器
              if (isIOS) {
                // iOS：新开标签展示，由用户通过分享保存到相册
                window.open(absUrl, '_blank');
                toast.info("点分享→保存到相册", { duration: 4000 });
              } else if (isAndroid) {
                // Android：使用 a[download] 触发保存到下载目录
                const link = document.createElement("a");
                link.href = absUrl;
                link.download = fileName;
                link.style.display = "none";
                document.body.appendChild(link);
                setTimeout(() => link.click(), 50);
                setTimeout(() => document.body.removeChild(link), 200);
                toast.info("文件已保存到下载目录，图库会自动扫描导入", { duration: 4000 });
              }
            } else {
              // PC端：直接下载到本地
              const link = document.createElement("a");
              link.href = absUrl;
              link.download = fileName;
              link.style.display = "none";
              document.body.appendChild(link);
              setTimeout(() => link.click(), 50);
              setTimeout(() => document.body.removeChild(link), 200);
              toast.success("文件已开始下载", { duration: 2000 });
            }
            
          } catch (error) {
            console.error("❌ 下载失败:", error);
            throw error;
          } finally {
            setIsPending(false);
          }
        },
        {
          loading: t("action.downloadLoading"),
          success: () => {
            setIsPending(false);
            return t("action.downloadSuccess");
          },
          error: (error) => {
            setIsPending(false);
            return getErrorMessage(error);
          },
        },
      );
    });
  };

  return (
    <SignBox>
      <button
        aria-label={t("action.download")}
        disabled={disabled}
        className="focus-ring text-content-strong border-stroke-strong hover:border-stroke-stronger data-[state=open]:bg-surface-alpha-light inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg border bg-transparent px-2.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
        onClick={() => download(id!)}
      >
        {isDownloading || isPending ? (
          <Loader2 className="icon-xs animate-spin" />
        ) : (
          <ArrowDownToLine className="icon-xs" />
        )}
        {showText && <span className="ml-2">{t("action.download")}</span>}
      </button>
    </SignBox>
  );
}
