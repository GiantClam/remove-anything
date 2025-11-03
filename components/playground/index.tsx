"use client";

import React, { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import copy from "copy-to-clipboard";
import { debounce } from "lodash-es";
import { Copy, Share2 } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Locale } from "@/config";
import { Credits, model, ModelName } from "@/config/constants";
import {
  ChargeProductSelectDto,
  FluxSelectDto,
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
import Loading from "./loading";

const useCreateTaskMutation = (config?: {
  onSuccess: (result: any) => void;
}) => {
  return useMutation({
    mutationFn: async (values: any) => {
      const res = await fetch("/api/generate", {
        body: JSON.stringify(values),
        method: "POST",
        credentials: 'include', // 使用 cookie 认证而不是 Bearer token
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

export enum FluxTaskStatus {
  Processing = "processing",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
}

export default function Playground({
  locale,
  chargeProduct,
}: {
  locale: string;
  chargeProduct?: ChargeProductSelectDto[];
}) {
  const [isPublic, setIsPublic] = React.useState(true);
  const [loading, setLoading] = useState(false);
  const [fluxId, setFluxId] = useState("");
  const [fluxData, setFluxData] = useState<FluxSelectDto>();
  const useCreateTask = useCreateTaskMutation();
  const [uploadInputImage, setUploadInputImage] = useState<any[]>([]);
  const [inputImageUrl, setInputImageUrl] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const t = useTranslations("Playground");
  const queryClient = useQueryClient();
  const [pricingCardOpen, setPricingCardOpen] = useState(false);
  const [originalForShare, setOriginalForShare] = useState<string>("");

  // 检查是否是生产环境
  const isProduction = typeof window !== 'undefined' && 
    (window.location.hostname === 'www.remove-anything.com' || 
     window.location.hostname === 'remove-anything.com' ||
     window.location.hostname.includes('vercel.app'));

  const queryTask = useQuery({
    queryKey: ["queryFluxTask", fluxId],
    enabled: !!fluxId,
    refetchInterval: (query) => {
      // 在生产环境中，减少轮询频率，主要依赖WebhookHandler
      if (isProduction) {
        const data = query.state.data as FluxSelectDto;
        // 只在任务还在处理时进行较少的轮询作为后备机制
        if (data?.taskStatus === FluxTaskStatus.Processing || 
            data?.taskStatus === "pending" || 
            data?.taskStatus === "starting") {
          return 10000; // 10秒轮询一次作为后备
        }
        return false;
      }
      
      // 开发环境：使用轮询模式
      const data = query.state.data as FluxSelectDto;
      if (data?.taskStatus === FluxTaskStatus.Processing) {
        return 1000;
      }
      return false;
    },
    queryFn: async () => {
      const res = await fetch(`/api/task/${fluxId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error("Failed to fetch task");
      }
      return res.json();
    },
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
      setFluxData(queryTask.data);
      if (queryTask.data.taskStatus === FluxTaskStatus.Succeeded) {
        setLoading(false);
        toast.success("Background removal completed!");
      } else if (queryTask.data.taskStatus === FluxTaskStatus.Failed) {
        setLoading(false);
        toast.error("Background removal failed. Please try again.");
      }
    }
  }, [queryTask.data]);

  const onBeforeunload = () => {
    if (loading) {
      return "Are you sure you want to leave? Your background removal is still processing.";
    }
  };

  useEffect(() => {
    window.addEventListener("beforeunload", onBeforeunload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeunload);
    };
  }, [loading]);

  const handleSubmit = async () => {
    // 获取图片：优先使用上传的文件，其次使用手动输入的URL
    const uploadedFile = uploadedFiles.length > 0 ? uploadedFiles[0] : null;
    const imageUrl = inputImageUrl.trim();
    
    if (!uploadedFile && !imageUrl) {
      toast.error("Please upload an image or provide an image URL");
      return;
    }

    setLoading(true);
    setFluxData(undefined);

    try {
      let result;
      
      // 如果有上传的文件且包含originFile（本地文件），发送FormData
      if (uploadedFile?.originFile) {
        console.log("🔧 使用本地文件模式发送FormData");
        
        const formData = new FormData();
        formData.append('image', uploadedFile.originFile);
        formData.append('model', model.backgroundRemoval);
        formData.append('isPrivate', isPublic ? '0' : '1');
        formData.append('locale', locale);
        
        const res = await fetch("/api/generate", {
          method: "POST",
          body: formData,
          credentials: 'include',
        });

        if (!res.ok && res.status >= 500) {
          throw new Error("Network response error");
        }

        result = await res.json();
        try {
          const localUrl = URL.createObjectURL(uploadedFile.originFile);
          setOriginalForShare(localUrl);
        } catch {}
      } else {
        // 使用URL模式（R2上传或手动输入的URL）
        const finalImageUrl = uploadedFile?.url || imageUrl;
        console.log("🔧 使用URL模式:", finalImageUrl);
        
        result = await useCreateTask.mutateAsync({
          model: model.backgroundRemoval,
          inputImageUrl: finalImageUrl,
          isPrivate: isPublic ? 0 : 1,
          locale,
        });
        setOriginalForShare(finalImageUrl);
      }

      if (result.error) {
        toast.error(result.error);
        setLoading(false);
        return;
      }

      setFluxId(result.taskId || result.id);
      toast.success("Background removal started!");
    } catch (error) {
      console.error("Background removal error:", error);
      toast.error("Failed to start background removal. Please try again.");
      setLoading(false);
    }
  };

  const copyPrompt = (prompt: string) => {
    copy(prompt);
    toast.success("Copied to clipboard!");
  };

  const needCredit = Credits[model.backgroundRemoval];
  const hasEnoughCredit = userCredit && userCredit.credit >= needCredit;

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-8 text-center">
        <h1 className="mb-4 text-3xl font-bold">Background Removal</h1>
        <p className="text-muted-foreground">
          Remove backgrounds from your images using AI. Simply upload an image and get a clean result.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左侧：输入区域 */}
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4">
              <Label className="text-base font-semibold">
                Upload Image
              </Label>
              <p className="text-sm text-muted-foreground">
                Drag and drop an image or click to select a file from your computer.
              </p>
            </div>
            
            <div className="space-y-4">
              <Upload
                value={uploadedFiles}
                onChange={setUploadedFiles}
                accept={{ "image/*": [".jpg", ".jpeg", ".png", ".webp"] }}
                maxSize={10 * 1024 * 1024} // 10MB
                maxFiles={1}
                multiple={false}
                placeholder={
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <Icons.media className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">Drop your image here</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      or click to browse your files
                    </p>
                    <Button variant="outline" size="sm">
                      Select Image
                    </Button>
                  </div>
                }
                className="min-h-[200px]"
              />
              
              <div className="text-sm text-muted-foreground">
                <p>Supported formats: JPG, PNG, WebP</p>
                <p>Maximum file size: 10MB</p>
              </div>
              
              {/* 可选：保留URL输入作为备选方案 */}
              <div className="border-t pt-4">
                <Label htmlFor="image-url" className="text-sm font-medium">
                  Or enter image URL (optional)
                </Label>
                <Input
                  id="image-url"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={inputImageUrl}
                  onChange={(e) => setInputImageUrl(e.target.value)}
                  className="w-full mt-2"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4">
              <Label className="text-base font-semibold">Settings</Label>
            </div>
            
            <div className="space-y-4">
              <PrivateSwitch
                isPublic={isPublic}
                onChange={setIsPublic}
              />
              
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">Cost</p>
                  <p className="text-sm text-muted-foreground">
                    {needCredit} credits per image
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">Your Credits</p>
                  <p className="text-sm text-muted-foreground">
                    {userCredit?.credit || 0} credits
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading || (uploadedFiles.length === 0 && !inputImageUrl.trim()) || !hasEnoughCredit}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Icons.eraser className="mr-2 h-4 w-4" />
                Remove Background
              </>
            )}
          </Button>

          {!hasEnoughCredit && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950">
              <div className="flex items-center gap-2">
                <Icons.warning className="h-4 w-4 text-orange-600" />
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Insufficient credits
                </p>
              </div>
              <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">
                You need {needCredit} credits to remove background. 
                <button
                  onClick={() => setPricingCardOpen(true)}
                  className="ml-1 underline hover:no-underline"
                >
                  Buy credits
                </button>
              </p>
            </div>
          )}
        </div>

        {/* 右侧：结果区域 */}
        <div className="space-y-6">
          {loading && <Loading />}
          
          {fluxData && (
            <div className="rounded-lg border bg-card p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Result</h3>
                <p className="text-sm text-muted-foreground">
                  {fluxData.taskStatus === FluxTaskStatus.Succeeded
                    ? t("backgroundRemoval.success")
                    : fluxData.taskStatus === FluxTaskStatus.Failed
                    ? t("backgroundRemoval.failed")
                    : t("backgroundRemoval.processing")}
                </p>
              </div>

              {fluxData.taskStatus === FluxTaskStatus.Succeeded && fluxData.imageUrl && (
                <div className="space-y-4">
                  <div className="relative w-full overflow-hidden rounded-lg border bg-muted max-h-[500px] max-w-[500px] mx-auto">
                    <img
                      src={fluxData.imageUrl}
                      alt="AI background removal result - processed image with transparent background"
                      className="h-full w-full object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <DownloadAction
                      id={fluxData.id}
                      showText={true}
                      taskType="background-removal"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyPrompt(fluxData.imageUrl || "")}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy URL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        try {
                          const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                          const mode = isDark ? 'dark' : 'light';
                          const params = new URLSearchParams();
                          if (originalForShare) params.set('before', originalForShare);
                          params.set('after', fluxData.imageUrl || '');
                          params.set('id', fluxId || fluxData.id || '');
                          params.set('mode', mode);
                          const shareUrl = `${window.location.origin}/${locale}/remove-background?${params.toString()}`;
                          navigator.clipboard.writeText(shareUrl);
                          toast.success('Share link copied');
                        } catch {
                          toast.error('Failed to copy share link');
                        }
                      }}
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </Button>
                  </div>
                </div>
              )}

              {fluxData.taskStatus === FluxTaskStatus.Failed && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
                  <div className="flex items-center gap-2">
                    <Icons.close className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      Background removal failed
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                    {fluxData.errorMsg || "Please try again with a different image."}
                  </p>
                </div>
              )}
            </div>
          )}

          {!loading && !fluxData && (
            <EmptyPlaceholder>
                            <EmptyPlaceholder.Icon name="eraser">
                <Icons.eraser className="h-8 w-8" />
              </EmptyPlaceholder.Icon>
              <EmptyPlaceholder.Title>{t("backgroundRemoval.noResultTitle")}</EmptyPlaceholder.Title>
              <EmptyPlaceholder.Description>
                {t("backgroundRemoval.getStartedText")}
              </EmptyPlaceholder.Description>
            </EmptyPlaceholder>
          )}
        </div>
      </div>

      {/* 定价卡片对话框 */}
      <PricingCardDialog
        isOpen={pricingCardOpen}
        onClose={setPricingCardOpen}
        chargeProduct={chargeProduct}
      />

      {/* 生产环境Webhook处理器 */}
      {isProduction && fluxId && loading && (
        <WebhookHandler
          taskId={fluxId}
          onComplete={(imageUrl) => {
            console.log("🎉 WebhookHandler: 任务完成", imageUrl);
            // 刷新查询以获取最新数据
            queryClient.invalidateQueries({ queryKey: ["queryFluxTask", fluxId] });
            setLoading(false);
            toast.success("Background removal completed!");
          }}
          onError={(error) => {
            console.error("❌ WebhookHandler: 任务失败", error);
            setLoading(false);
            toast.error("Background removal failed. Please try again.");
          }}
        />
      )}
    </div>
  );
}
