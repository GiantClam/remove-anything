"use client";

import React, { useState } from "react";
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
import { Copy } from "lucide-react";
import FormUpload from "@/components/upload";

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
    refetchInterval: 3000, // 每3秒轮询一次
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

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <div className="mb-8 text-center">
        <h1 className="mb-4 text-3xl font-bold">Batch Background Removal</h1>
        <p className="text-muted-foreground">
          Remove backgrounds from multiple images at once. Upload up to 100MB of images and get clean results.
        </p>
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
          {isProcessing && (
            <Card>
              <CardHeader>
                <CardTitle>Processing Images</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Progress value={0} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    Processing {uploadedImages.filter(img => img.status === 'uploaded').length} images...
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
                            alt={`Original ${index + 1}`}
                            className="w-full h-32 object-cover rounded"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Processed</p>
                          {result.status === 'succeeded' && result.processedImageUrl ? (
                            <div className="relative">
                              <img 
                                src={result.processedImageUrl} 
                                alt={`Processed ${index + 1}`}
                                className="w-full h-32 object-cover rounded"
                              />
                              <div className="absolute top-2 right-2 flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => copyPrompt(result.processedImageUrl!)}
                                >
                                  <Copy className="h-3 w-3" />
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