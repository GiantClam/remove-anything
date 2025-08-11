"use client";

import React, { useEffect, useMemo, useState } from "react";

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

  const queryTask = useQuery({
    queryKey: ["queryFluxTask", fluxId],
    enabled: !!fluxId,
    refetchInterval: (query) => {
      // 在生产环境中，使用webhook模式，不进行轮询
      const isProduction = typeof window !== 'undefined' && 
        (window.location.hostname === 'www.remove-anything.com' || 
         window.location.hostname === 'remove-anything.com' ||
         window.location.hostname === 'vercel.app');
      
      if (isProduction) {
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
    // 获取图片URL：优先使用上传的文件，其次使用手动输入的URL
    const imageUrl = uploadedFiles.length > 0 ? uploadedFiles[0].url : inputImageUrl.trim();
    
    if (!imageUrl) {
      toast.error("Please upload an image or provide an image URL");
      return;
    }

    setLoading(true);
    setFluxData(undefined);

    try {
      const result = await useCreateTask.mutateAsync({
        model: model.backgroundRemoval,
        inputImageUrl: imageUrl,
        isPrivate: isPublic ? 0 : 1,
        locale,
      });

      if (result.error) {
        toast.error(result.error);
        setLoading(false);
        return;
      }

      setFluxId(result.id);
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
                    ? "Background removed successfully!"
                    : fluxData.taskStatus === FluxTaskStatus.Failed
                    ? "Background removal failed"
                    : "Processing..."}
                </p>
              </div>

              {fluxData.taskStatus === FluxTaskStatus.Succeeded && fluxData.imageUrl && (
                <div className="space-y-4">
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted">
                    <img
                      src={fluxData.imageUrl}
                      alt="Background removed"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <DownloadAction
                      id={fluxData.id}
                      showText={true}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyPrompt(fluxData.imageUrl || "")}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy URL
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
              <EmptyPlaceholder.Title>No result yet</EmptyPlaceholder.Title>
              <EmptyPlaceholder.Description>
                Upload an image and click "Remove Background" to get started.
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
    </div>
  );
}
