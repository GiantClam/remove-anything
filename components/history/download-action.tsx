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
  taskType?: "flux" | "background-removal" | "watermark-removal";
}) {
  const t = useTranslations("History");
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
            } else {
              apiUrl = `/api/download?fluxId=${id}`;
              fileExtension = "jpg";
              fileName = `flux-${id}.${fileExtension}`;
            }
            
            console.log("🔍 开始下载:", { apiUrl, fileName, taskType });
            
            const response = await fetch(apiUrl, {
              credentials: 'include',
            });
            
            if (!response.ok) {
              throw new Error(`下载失败: ${response.status} ${response.statusText}`);
            }
            
            // 检查Content-Type和Content-Disposition
            const contentType = response.headers.get("content-type");
            const contentDisposition = response.headers.get("content-disposition");
            console.log("🔍 响应头:", { 
              contentType, 
              contentDisposition,
              status: response.status,
              statusText: response.statusText
            });
            
            // 获取文件数据
            const blob = await response.blob();
            console.log("🔍 获取到blob:", { 
              size: blob.size, 
              type: blob.type,
              fileName: fileName
            });
            
            // 验证blob大小
            if (blob.size === 0) {
              throw new Error("下载的文件大小为0，可能下载失败");
            }
            
            // 创建下载链接
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            
            // 设置下载属性
            link.style.display = "none";
            link.setAttribute("download", fileName);
            
            // 添加到DOM并触发下载
            document.body.appendChild(link);
            
            // 延迟一下再点击，确保DOM已更新
            setTimeout(() => {
              link.click();
              console.log("🔍 触发下载点击");
            }, 100);
            
            // 清理
            setTimeout(() => {
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
              console.log("🔍 清理完成");
            }, 200);
            
            console.log("✅ 下载完成:", fileName);
            
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
