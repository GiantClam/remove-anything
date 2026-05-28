"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import copy from "copy-to-clipboard";
import { debounce } from "lodash-es";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import BlurFade from "@/components/magicui/blur-fade";
import { PrivateSwitch } from "@/components/playground/private-switch";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Locale } from "@/config";
import { Credits, model, ModelName } from "@/config/constants";
import {
  ChargeProductSelectDto,
  TaskSelectDto,
  TaskStatus,
  UserCreditSelectDto,
} from "@/db/type";
import { cn } from "@/lib/utils";

import { DownloadAction } from "../history/download-action";
import { PricingCardDialog } from "../pricing-cards";
import { EmptyPlaceholder } from "../shared/empty-placeholder";
import { Icons } from "../shared/icons";
import Upload from "../upload";
import { WebhookHandler } from "../marketing/webhook-handler";
import ComfortingMessages from "./comforting";
import Loading from "./loading/index";

const useCreateWatermarkRemovalMutation = (config?: {
  onSuccess: (result: any) => void;
}) => {
  return useMutation({
    mutationFn: async (values: any) => {
      const res = await fetch("/api/watermark-removal", {
        body: JSON.stringify(values),
        method: "POST",
        credentials: 'include',
      });

      if (!res.ok && res.status >= 500) {
        throw new Error("Network response error");
      }

      return res.json();
    },
    onSuccess: async (result) => {
      config?.onSuccess(result);
    },
  });
};

export enum WatermarkRemovalTaskStatus {
  Processing = "processing",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
  Pending = "pending",
  Starting = "starting",
}

// 轻量 SVG shimmer 作为 blurDataURL
const shimmer = (w: number, h: number) => `
  <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
    <defs>
      <linearGradient id="g">
        <stop stop-color="#f3f4f6" offset="20%" />
        <stop stop-color="#e5e7eb" offset="50%" />
        <stop stop-color="#f3f4f6" offset="70%" />
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="#f3f4f6" />
    <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
    <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1.2s" repeatCount="indefinite"  />
  </svg>`;

const toBase64 = (str: string) =>
  (typeof window === 'undefined'
    ? Buffer.from(str).toString('base64')
    : window.btoa(str));

export default function WatermarkRemoval({
  locale,
  chargeProduct,
}: {
  locale: string;
  chargeProduct?: ChargeProductSelectDto[];
}) {
  // 轻量懒加载图片组件，避免白屏闪烁
  function LazyImage({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
    const [isLoaded, setIsLoaded] = React.useState(false);
    const [isInView, setIsInView] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const io = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setIsInView(true);
            io.disconnect();
          }
        },
        { rootMargin: "200px" }
      );
      io.observe(el);
      return () => io.disconnect();
    }, []);

    return (
      <div ref={containerRef} className="relative w-full h-full">
        {!isLoaded && (
          <div className="absolute inset-0 animate-pulse rounded-lg bg-muted" />
        )}
        {isInView && (
          <Image
            src={src}
            alt={alt || "AI watermark removal - processed image result"}
            fill
            sizes="(max-width: 640px) 100vw, 500px"
            priority={priority}
            fetchPriority={priority ? "high" : "auto"}
            onLoadingComplete={() => setIsLoaded(true)}
            className={cn(
              "object-cover transition-opacity duration-300",
              isLoaded ? "opacity-100" : "opacity-0"
            )}
            placeholder="blur"
            blurDataURL={`data:image/svg+xml;base64,${toBase64(shimmer(32, 32))}`}
          />
        )}
      </div>
    );
  }
  const [isPublic, setIsPublic] = React.useState(true);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [taskData, setTaskData] = useState<any>();
  const useCreateTask = useCreateWatermarkRemovalMutation();
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [inputImageUrl, setInputImageUrl] = useState<string>("");
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  
  // 处理文件上传状态变化
  const handleFileChange = useCallback((files: any[]) => {
    console.log("📁 handleFileChange 被调用:", files);
    setUploadedFiles(files);
  }, []);
  // const t = useTranslations("WatermarkRemoval"); // 暂时注释掉，因为组件中没有使用国际化
  const queryClient = useQueryClient();
  const [pricingCardOpen, setPricingCardOpen] = useState(false);

  // 暂时禁用生产环境检测，因为去水印使用不同的webhook
  const isProduction = false;

  const queryTask = useQuery({
    queryKey: ["queryWatermarkRemovalTask", taskId],
    enabled: !!taskId,
    refetchInterval: (query) => {
      // 统一使用轮询模式，因为去水印使用不同的webhook
      const data = query.state.data as any;
      if (data?.taskStatus === WatermarkRemovalTaskStatus.Processing || 
          data?.taskStatus === "pending" || 
          data?.taskStatus === "starting") {
        return 3000; // 3秒轮询一次
      }
      return false;
    },
    queryFn: async () => {
      console.log("🔍 开始查询任务状态，taskId:", taskId);
      const res = await fetch(`/api/watermark-removal/${taskId}`, {
        credentials: 'include',
      });
      console.log("📡 API响应状态:", res.status, res.statusText);
      
      if (!res.ok) {
        console.error("❌ API请求失败:", res.status, res.statusText);
        const errorText = await res.text();
        console.error("❌ 错误详情:", errorText);
        throw new Error(`Failed to fetch task: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("✅ 获取到任务数据:", data);
      return data;
    }
  });

  const { data: userCredit } = useQuery<UserCreditSelectDto>({
    queryKey: ["userCredit"],
    queryFn: async () => {
      const res = await fetch("/api/account", {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error("Failed to fetch user credit");
      }
      return res.json();
    },
  });

  useEffect(() => {
    if (queryTask.data) {
      setTaskData(queryTask.data);
      if (queryTask.data.taskStatus === WatermarkRemovalTaskStatus.Succeeded) {
        setLoading(false);
        toast.success("Watermark removal completed!");
      } else if (queryTask.data.taskStatus === WatermarkRemovalTaskStatus.Failed) {
        setLoading(false);
        toast.error("Watermark removal failed. Please try again.");
      } else if (['pending', 'starting', 'processing'].includes(queryTask.data.taskStatus)) {
        setLoading(true);
      }
    }
  }, [queryTask.data]);

  // 监听查询错误
  useEffect(() => {
    if (queryTask.error) {
      console.error("❌ 查询任务失败:", queryTask.error);
      toast.error("Failed to fetch task status. Please try again.");
    }
  }, [queryTask.error]);

  const onBeforeunload = () => {
    if (loading) {
      return "Are you sure you want to leave? Your watermark removal is still processing.";
    }
  };

  useEffect(() => {
    window.addEventListener("beforeunload", onBeforeunload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeunload);
    };
  }, [loading]);

  // 监控 uploadedFiles 状态变化
  useEffect(() => {
    console.log("🔄 uploadedFiles 状态变化:", uploadedFiles);
  }, [uploadedFiles]);

  const handleSubmit = async () => {
    console.log("🚀 handleSubmit 开始执行");
    console.log("📁 uploadedFiles:", uploadedFiles);
    console.log("🔗 inputImageUrl:", inputImageUrl);
    
    // 获取图片：优先使用上传的文件，其次使用手动输入的URL
    const hasUploadedFiles = uploadedFiles.length > 0;
    const imageUrl = inputImageUrl.trim();
    
    console.log("🔍 检查结果:", { hasUploadedFiles, imageUrl, hasImageUrl: !!imageUrl });
    
    if (!hasUploadedFiles && !imageUrl) {
      toast.error("Please upload images or provide an image URL");
      return;
    }

    setLoading(true);
    setTaskData(undefined);

    try {
      let result;
      
      // 如果有上传的文件且包含originFile（本地文件），发送FormData
      if (hasUploadedFiles && uploadedFiles[0]?.originFile) {
        console.log("🔧 使用本地文件模式发送FormData");
        
        const formData = new FormData();
        uploadedFiles.forEach((file) => {
          if (file.originFile) {
            formData.append('images', file.originFile);
          }
        });
        formData.append('isPrivate', isPublic ? '0' : '1');
        formData.append('locale', locale);
        
        const res = await fetch("/api/watermark-removal", {
          method: "POST",
          body: formData,
          credentials: 'include',
        });

        if (!res.ok && res.status >= 500) {
          throw new Error("Network response error");
        }

        result = await res.json();
      } else {
        // 使用URL模式（R2上传或手动输入的URL）
        const finalImageUrl = hasUploadedFiles ? uploadedFiles[0].url : imageUrl;
        console.log("🔧 使用URL模式:", finalImageUrl);
        
        // 对于URL模式，我们需要先上传到R2，然后调用去水印API
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageUrl: finalImageUrl,
          }),
          credentials: 'include',
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload image");
        }

        const uploadResult = await uploadRes.json();
        
        result = await useCreateTask.mutateAsync({
          imageUrls: [uploadResult.url],
          isPrivate: isPublic ? 0 : 1,
          locale,
        });
      }

      if (result.error) {
        toast.error(result.error);
        setLoading(false);
        return;
      }

      setTaskId(result.taskId || result.id);
      toast.success("Watermark removal started!");
    } catch (error) {
      console.error("Watermark removal error:", error);
      toast.error("Failed to start watermark removal. Please try again.");
      setLoading(false);
    }
  };

  const handleStartWithUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    try {
      new URL(url);
      setUrlError(null);
    } catch {
      setUrlError("Invalid URL");
      return;
    }
    setInputImageUrl(url);
    setShowUrlDialog(false);
    await handleSubmit();
  };

  const copyPrompt = (prompt: string) => {
    copy(prompt);
    toast.success("Copied to clipboard!");
  };

  const needCredit = Credits[model.watermarkRemoval] || 1; // 默认1积分
  const hasEnoughCredit = userCredit && userCredit.credit >= needCredit;
  
  // 调试信息
  console.log("🔍 WatermarkRemoval 组件状态:", {
    uploadedFiles: uploadedFiles.length,
    inputImageUrl: inputImageUrl,
    loading,
    hasEnoughCredit,
    userCredit: userCredit?.credit,
    buttonDisabled: loading || (!hasEnoughCredit) || (uploadedFiles.length === 0 && !inputImageUrl.trim())
  });

  return (
    <div className="container mx-auto max-w-4xl p-6">
      {/* 顶部：极简标题与说明 */}
      <div className="mb-6 text-center">
        <h1 className="mb-3 text-3xl font-bold">Upload an image to remove the watermark</h1>
        <p className="text-sm text-muted-foreground">or paste an image URL</p>
      </div>

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        Use this tool only for images you own or are authorized to edit. Please make sure watermark or overlay removal complies with the original asset license and platform rules.
      </div>

      {/* 上传优先：置顶上传区 + URL + 主按钮 */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <div className="space-y-4">
          <Upload
            value={uploadedFiles}
            onChange={handleFileChange}
            accept={{ "image/*": [".jpg", ".jpeg", ".png", ".webp"] }}
            maxSize={10 * 1024 * 1024}
            maxFiles={10}
            multiple={true}
            placeholder={
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <Icons.media className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Upload Image</p>
                <p className="text-sm text-muted-foreground mb-4">or drop a file, paste image or URL</p>
                    <Button size="sm">Choose Image</Button>
                    <button className="mt-2 text-xs underline" onClick={() => setShowUrlDialog(true)}>Use URL</button>
              </div>
            }
            className="min-h-[220px]"
          />

          <div className="flex items-center gap-3">
            <Input
              id="image-url"
              type="url"
              placeholder="https://example.com/image.jpg"
              value={inputImageUrl}
              onChange={(e) => setInputImageUrl(e.target.value)}
              className="w-full"
            />
            <Button
              onClick={handleSubmit}
              disabled={loading || !hasEnoughCredit || (uploadedFiles.length === 0 && !inputImageUrl.trim())}
              className="shrink-0"
              size="lg"
            >
              {loading ? (
                <>
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  Processing
                </>
              ) : (
                <>
                  <Icons.eraser className="mr-2 h-4 w-4" />
                  Remove Watermark
                </>
              )}
            </Button>
          </div>

          {!hasEnoughCredit && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950">
              <div className="flex items-center gap-2">
                <Icons.warning className="h-4 w-4 text-orange-600" />
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Insufficient credits</p>
              </div>
              <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">
                You need {needCredit} credits. <button onClick={() => setPricingCardOpen(true)} className="ml-1 underline hover:no-underline">Buy credits</button>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 结果区域：上传后展示，保持简洁 */}
      <div className="space-y-6">
        {loading && <Loading />}

        {taskData && (
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Result</h3>
              <div className="text-xs text-muted-foreground">{taskData.taskStatus}</div>
            </div>

            {taskData.taskStatus === WatermarkRemovalTaskStatus.Succeeded && taskData.outputImageUrls?.length > 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {taskData.outputImageUrls.map((url: string, idx: number) => (
                    <div key={idx} className="relative w-full overflow-hidden rounded-lg border bg-muted max-h-[500px] max-w-[500px] mx-auto">
                      <LazyImage src={url} alt={`AI watermark removal result ${idx + 1} - processed image`} priority={idx === 0} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <DownloadAction id={taskData.runninghubTaskId} showText={true} taskType="watermark-removal" />
                </div>
              </div>
            )}

            {taskData.taskStatus === WatermarkRemovalTaskStatus.Succeeded && !taskData.outputImageUrls?.length && taskData.outputZipUrl && (
              <div className="space-y-4">
                <div className="relative w-full overflow-hidden rounded-lg border bg-muted max-h-[500px] max-w-[500px] mx-auto">
                  <div className="absolute inset-0 animate-pulse rounded-lg bg-muted" />
                  <div className="relative flex h-full w-full items-center justify-center">
                    <div className="text-center">
                      <Icons.check className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Watermark removal completed!</p>
                      <p className="text-xs text-muted-foreground">Download the ZIP file to get your processed images</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <DownloadAction id={taskData.runninghubTaskId} showText={true} taskType="watermark-removal" />
                  <Button variant="outline" size="sm" onClick={() => copyPrompt(taskData.outputZipUrl || "")}> 
                    <Copy className="mr-2 h-4 w-4" />
                    Copy URL
                  </Button>
                </div>
              </div>
            )}

            {taskData.taskStatus === WatermarkRemovalTaskStatus.Failed && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
                <div className="flex items-center gap-2">
                  <Icons.close className="h-4 w-4 text-red-600" />
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">Watermark removal failed</p>
                </div>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">{taskData.errorMsg || "Please try again with a different image."}</p>
              </div>
            )}
          </div>
        )}

        {!loading && !taskData && (
          <>
            <EmptyPlaceholder>
              <EmptyPlaceholder.Icon name="eraser">
                <Icons.eraser className="h-8 w-8" />
              </EmptyPlaceholder.Icon>
              <EmptyPlaceholder.Title>No result yet</EmptyPlaceholder.Title>
              <EmptyPlaceholder.Description>
                Upload an image and click "Remove Watermark" to get started.
              </EmptyPlaceholder.Description>
            </EmptyPlaceholder>
            <ComfortingMessages />
          </>
        )}
      </div>

      {/* 定价卡片对话框 */}
      <PricingCardDialog isOpen={pricingCardOpen} onClose={setPricingCardOpen} chargeProduct={chargeProduct} />

      {/* URL 输入对话框 */}
      <Dialog open={showUrlDialog} onOpenChange={setShowUrlDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Paste image URL</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <Input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter") await handleStartWithUrl();
                if (e.key === "Escape") setShowUrlDialog(false);
              }}
              className="w-full"
              autoFocus
            />
            <Button onClick={handleStartWithUrl} disabled={!urlInput.trim() || loading} className="shrink-0">Start</Button>
          </div>
          {urlError && <p className="mt-2 text-xs text-red-600">{urlError}</p>}
          <DialogFooter />
        </DialogContent>
      </Dialog>
    </div>
  );
}
