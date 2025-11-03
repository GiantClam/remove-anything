"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Icons } from "@/components/shared/icons";
import { EmptyPlaceholder } from "@/components/shared/empty-placeholder";
import { PricingCardDialog } from "@/components/pricing-cards";
import { PrivateSwitch } from "@/components/playground/private-switch";
import { DownloadAction } from "@/components/history/download-action";
import { useAuth } from "@/hooks/use-auth";
import { Credits, model } from "@/config/constants";
import type { ChargeProductSelectDto } from "@/db/type";
import { Copy, Share2 } from "lucide-react";
import FormUpload from "@/components/upload";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface BatchRemoveBackgroundProps {
  locale: string;
  chargeProduct?: ChargeProductSelectDto[];
}

interface UploadValue {
  id?: string;
  url: string;
  completedUrl: string;
  key?: string;
  originFile?: File;
  md5?: string;
  fileType?: string;
  status?: 'uploading' | 'uploaded' | 'processing' | 'completed' | 'error';
  error?: string;
}

interface BatchResult {
  id: string;
  index: number;
  success: boolean;
  originalImageUrl: string;
  replicateId?: string;
  taskRecordId?: number;
  processedImageUrl?: string;
  error?: string;
  status?: string; // 任务状态：pending, processing, succeeded, failed
}

export default function BatchRemoveBackground({
  locale,
  chargeProduct,
}: BatchRemoveBackgroundProps) {
  const { userId } = useAuth();
  const t = useTranslations('BatchRemoveBackground');
  const [uploadedImages, setUploadedImages] = useState<UploadValue[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [pricingCardOpen, setPricingCardOpen] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTasks, setProcessingTasks] = useState<string[]>([]); // 正在处理的任务ID

  // 获取用户积分
  const { data: userCreditData } = useQuery({
    queryKey: ["user-credit", userId],
    queryFn: async () => {
      const response = await fetch("/api/user/credit");
      if (!response.ok) {
        throw new Error("Failed to fetch user credit");
      }
      return response.json();
    },
    enabled: !!userId,
  });
  const userCredit = userCreditData?.credit;

  // 轮询任务状态
  const { data: taskStatusData } = useQuery({
    queryKey: ["batch-task-status", processingTasks],
    queryFn: async () => {
      if (!processingTasks.length) return [];
      
      const statusPromises = processingTasks.map(async (taskId) => {
        try {
          const response = await fetch(`/api/task/${taskId}`);
          if (response.ok) {
            return await response.json();
          }
          return null;
        } catch (error) {
          console.error(`Failed to fetch status for task ${taskId}:`, error);
          return null;
        }
      });
      
      return Promise.all(statusPromises);
    },
    enabled: processingTasks.length > 0,
    refetchInterval: (query) => {
      // 检查是否还有正在处理的任务
      const data = query.state.data as any[];
      if (!data || data.length === 0) return false;
      
      const hasProcessingTasks = data.some(task => 
        task && (task.status === 'pending' || task.status === 'processing' || task.status === 'starting')
      );
      
      return hasProcessingTasks ? 3000 : false; // 如果有处理中的任务则轮询，否则停止
    },
    refetchIntervalInBackground: false,
  });

  // 更新批量结果状态
  React.useEffect(() => {
    if (taskStatusData && taskStatusData.length > 0) {
      setBatchResults(prev => prev.map(result => {
        if (!result.replicateId) return result;
        
        const taskStatus = taskStatusData.find(status => 
          status && status.replicateId === result.replicateId
        );
        
        if (taskStatus) {
          const newResult = {
            ...result,
            status: taskStatus.taskStatus,
            processedImageUrl: taskStatus.imageUrl
          };
          
          // 如果任务完成，从轮询列表中移除
          if (taskStatus.taskStatus === 'succeeded' || taskStatus.taskStatus === 'failed') {
            setProcessingTasks(prev => prev.filter(id => id !== result.replicateId));
          }
          
          return newResult;
        }
        
        return result;
      }));
    }
  }, [taskStatusData]);

  // 批量背景去除
  const batchRemoveBackground = useMutation({
    mutationFn: async (data: {
      imageUrls: string[];
      isPrivate: number;
      locale: string;
    }) => {
      const response = await fetch("/api/batch-remove-background", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process images");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setBatchResults(data.results.map((result: any) => ({
        ...result,
        status: result.success ? 'pending' : 'failed'
      })));
      setIsProcessing(false);
      
      // 收集成功的任务ID用于轮询
      const successfulTasks = data.results
        .filter((result: any) => result.success && result.replicateId)
        .map((result: any) => result.replicateId);
      
      setProcessingTasks(successfulTasks);
      
      toast.success(`Successfully started processing ${data.completedImages} images`);
    },
    onError: (error) => {
      setIsProcessing(false);
      toast.error(getErrorMessage(error));
    },
  });

  const handleSubmit = async () => {
    if (!uploadedImages.length) {
      toast.error(t('uploadAtLeastOne'));
      return;
    }

    const imageUrls = uploadedImages
      .filter(img => img.status === 'uploaded')
      .map(img => img.url);

    if (!imageUrls.length) {
      toast.error(t('waitForUpload'));
      return;
    }

    const needCredit = Credits[model.backgroundRemoval] * imageUrls.length;
    if (!userCredit || userCredit.credit < needCredit) {
      setPricingCardOpen(true);
      return;
    }

    setIsProcessing(true);
    setBatchResults([]);

    try {
      await batchRemoveBackground.mutateAsync({
        imageUrls,
        isPrivate: isPublic ? 0 : 1,
        locale,
      });
    } catch (error) {
      console.error("Batch processing error:", error);
    }
  };

  const copyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("URL copied to clipboard");
  };

  const needCredit = Credits[model.backgroundRemoval] * uploadedImages.filter(img => img.status === 'uploaded').length;
  const hasEnoughCredit = userCredit && userCredit.credit >= needCredit;

  const queueStats = useMemo(() => {
    const total = batchResults.length;
    const completed = batchResults.filter(result => result.status === "succeeded").length;
    const failed = batchResults.filter(result => result.status === "failed").length;
    const active = batchResults.filter(result => result.status === "processing" || result.status === "pending").length;
    return { total, completed, failed, active };
  }, [batchResults]);

  const queueProgress = queueStats.total
    ? Math.round(((queueStats.completed + queueStats.failed) / queueStats.total) * 100)
    : 0;

  const hasActiveTasks = queueStats.active > 0;

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <div className="mb-8 flex flex-col items-center gap-4 text-center md:flex-row md:items-end md:justify-between md:text-left">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Batch Background Removal</h1>
          <p className="text-muted-foreground">
            Queue up to 50 images and monitor progress without leaving the page.
          </p>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2" disabled={!batchResults.length}>
              Queue
              {hasActiveTasks && (
                <Badge variant="default" className="bg-primary text-primary-foreground">
                  {queueStats.active} active
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Processing Queue</SheetTitle>
              <p className="text-sm text-muted-foreground">
                {queueStats.total > 0
                  ? `${queueStats.completed} done · ${queueStats.active} in progress · ${queueStats.failed} failed`
                  : "Upload images to start a queue."}
              </p>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {batchResults.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No items yet. Start a batch to see live updates here.
                </div>
              )}
              {batchResults.map((result) => (
                <div key={result.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">#{result.index + 1}</p>
                      <p className="text-xs text-muted-foreground">
                        {result.status === "succeeded"
                          ? "Completed"
                          : result.status === "failed"
                          ? "Failed"
                          : result.status === "processing"
                          ? "Processing"
                          : "Pending"}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "capitalize",
                        result.status === "succeeded" && "bg-emerald-100 text-emerald-800",
                        result.status === "failed" && "bg-red-100 text-red-800",
                        result.status === "processing" && "bg-blue-100 text-blue-800",
                      )}
                    >
                      {result.status || "pending"}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                    <p className="truncate">Source: {result.originalImageUrl}</p>
                    {result.processedImageUrl && (
                      <p className="truncate">Output: {result.processedImageUrl}</p>
                    )}
                    {result.error && (
                      <p className="text-red-600">Error: {result.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Upload Area */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <FormUpload
                  accept={{ "image/*": [] }}
                  maxSize={100 * 1024 * 1024} // 总大小限制100MB
                  maxFiles={50} // 增加文件数量限制到50
                  multiple={true}
                  value={uploadedImages}
                  onChange={setUploadedImages}
                  className="min-h-[200px]"
                />
                <div className="text-sm text-muted-foreground">
                  <p>Supported formats: JPG, PNG, WebP</p>
                  <p>Maximum total size: 100MB</p>
                  <p>Maximum files: 50 images</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <PrivateSwitch
                  isPublic={isPublic}
                  onChange={setIsPublic}
                />
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">Cost</p>
                    <p className="text-sm text-muted-foreground">
                      {Credits[model.backgroundRemoval]} credits per image
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
            </CardContent>
          </Card>

          <Button
            onClick={handleSubmit}
            disabled={isProcessing || !uploadedImages.length || !hasEnoughCredit}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Icons.eraser className="mr-2 h-4 w-4" />
                Remove Backgrounds ({uploadedImages.filter(img => img.status === 'uploaded').length} images)
              </>
            )}
          </Button>

          {!hasEnoughCredit && uploadedImages.length > 0 && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950">
              <div className="flex items-center gap-2">
                <Icons.warning className="h-4 w-4 text-orange-600" />
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Insufficient credits
                </p>
              </div>
              <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">
                You need {needCredit} credits to remove backgrounds from {uploadedImages.filter(img => img.status === 'uploaded').length} images. 
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

        {/* Right: Results Area */}
        <div className="space-y-6">
          {(isProcessing || hasActiveTasks) && (
            <Card>
              <CardHeader>
                <CardTitle>Processing Images</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Progress value={hasActiveTasks ? queueProgress : 15} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {hasActiveTasks
                      ? `Completed ${queueStats.completed + queueStats.failed} of ${queueStats.total}`
                      : "Preparing upload..."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {batchResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {batchResults.map((result, index) => (
                    <div key={result.id} className="rounded-lg border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-medium">Image {result.index + 1}</h4>
                        <span className={`text-sm px-2 py-1 rounded ${
                          result.status === 'succeeded' 
                            ? 'bg-green-100 text-green-800' 
                            : result.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : result.status === 'processing'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {result.status === 'succeeded' ? 'Completed' :
                           result.status === 'failed' ? 'Failed' :
                           result.status === 'processing' ? 'Processing' :
                           result.status === 'pending' ? 'Pending' :
                           'Unknown'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Original</p>
                          <img 
                            src={result.originalImageUrl} 
                            alt={`Original image ${index + 1} before AI background removal`}
                            className="w-full h-32 object-cover rounded"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Processed</p>
                          {result.status === 'succeeded' && result.processedImageUrl ? (
                            <div className="relative">
                              <img 
                                src={result.processedImageUrl} 
                                alt={`AI background removal result ${index + 1} - processed image`}
                                className="w-full h-32 object-cover rounded"
                                loading="lazy"
                                decoding="async"
                              />
                              <div className="absolute top-2 right-2 flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => copyPrompt(result.processedImageUrl!)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    try {
                                      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                                      const mode = isDark ? 'dark' : 'light';
                                      const params = new URLSearchParams();
                                      params.set('after', result.processedImageUrl!);
                                      params.set('id', result.replicateId || result.id);
                                      params.set('mode', mode);
                                      if (result.originalImageUrl) params.set('before', result.originalImageUrl);
                                      const url = `${window.location.origin}/${locale}/batch-remove-background?${params.toString()}`;
                                      navigator.clipboard.writeText(url);
                                      toast.success('Share link copied');
                                    } catch {
                                      toast.error('Failed to copy share link');
                                    }
                                  }}
                                >
                                  <Share2 className="h-3 w-3" />
                                </Button>
                                <DownloadAction
                                  id={result.replicateId!}
                                  showText={false}
                                  taskType="background-removal"
                                />
                              </div>
                            </div>
                          ) : result.status === 'processing' || result.status === 'pending' ? (
                            <div className="w-full h-32 bg-gray-100 rounded flex items-center justify-center">
                              <div className="flex items-center gap-2">
                                <Icons.spinner className="h-4 w-4 animate-spin" />
                                <p className="text-sm text-gray-500">
                                  {result.status === 'pending' ? 'Starting...' : 'Processing...'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-32 bg-gray-100 rounded flex items-center justify-center">
                              <p className="text-sm text-gray-500">
                                {result.error || 'Processing failed'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!isProcessing && !batchResults.length && (
            <EmptyPlaceholder>
              <EmptyPlaceholder.Icon name="eraser">
                <Icons.eraser className="h-8 w-8" />
              </EmptyPlaceholder.Icon>
              <EmptyPlaceholder.Title>No results yet</EmptyPlaceholder.Title>
              <EmptyPlaceholder.Description>
                {t('getStartedText')}
              </EmptyPlaceholder.Description>
            </EmptyPlaceholder>
          )}
        </div>
      </div>

      <PricingCardDialog
        isOpen={pricingCardOpen}
        onClose={setPricingCardOpen}
        chargeProduct={chargeProduct}
      />
    </div>
  );
}

function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return 'An unexpected error occurred';
} 
