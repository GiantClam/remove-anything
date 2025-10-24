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

interface BatchWatermarkRemovalProps {
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

export default function BatchWatermarkRemoval({
  locale,
  chargeProduct,
}: BatchWatermarkRemovalProps) {
  const { userId } = useAuth();
  const t = useTranslations('BatchWatermarkRemoval');
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
    queryKey: ["batch-watermark-task-status", processingTasks],
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
      
      return hasProcessingTasks ? 3000 : false; // 如果有处理中的任务则每3秒轮询，否则停止
    },
    refetchIntervalInBackground: false,
  });

  // 处理文件上传
  const handleFileChange = (files: UploadValue[]) => {
    setUploadedImages(files);
  };

  // 开始批量处理
  const startBatchProcessing = async () => {
    if (!uploadedImages.length) {
      toast.error(t("noImagesSelected"));
      return;
    }

    if (!userCredit || userCredit < uploadedImages.length) {
      setPricingCardOpen(true);
      return;
    }

    setIsProcessing(true);
    const newProcessingTasks: string[] = [];

    try {
      // 为每个图片创建去水印任务
      const taskPromises = uploadedImages.map(async (image, index) => {
        const response = await fetch("/api/watermark-removal", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageUrl: image.url,
            isPublic,
            locale,
          }),
          credentials: 'include',
        });

        if (response.ok) {
          const result = await response.json();
          newProcessingTasks.push(result.taskId);
          
          // 添加到结果列表
          setBatchResults(prev => [...prev, {
            id: result.taskId,
            index,
            success: true,
            originalImageUrl: image.url,
            status: 'pending',
          }]);
          
          return result;
        } else {
          throw new Error(`Failed to create task for image ${index + 1}`);
        }
      });

      await Promise.all(taskPromises);
      setProcessingTasks(newProcessingTasks);
      toast.success(t("batchProcessingStarted"));
      
    } catch (error) {
      console.error("Batch processing error:", error);
      toast.error(t("batchProcessingError"));
    } finally {
      setIsProcessing(false);
    }
  };

  // 计算总进度
  const totalProgress = batchResults.length > 0 
    ? (batchResults.filter(r => r.status === 'succeeded').length / batchResults.length) * 100 
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex items-center space-x-2">
          <PrivateSwitch
            isPublic={isPublic}
            onChange={setIsPublic}
          />
          <Button
            onClick={() => setPricingCardOpen(true)}
            variant="outline"
          >
            <Icons.billing className="mr-2 h-4 w-4" />
            {userCredit || 0} {t("credits")}
          </Button>
        </div>
      </div>

      {/* 上传区域 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("uploadImages")}</CardTitle>
        </CardHeader>
        <CardContent>
          <FormUpload
            value={uploadedImages}
            onChange={handleFileChange}
            multiple={true}
            maxFiles={10}
            maxSize={10 * 1024 * 1024} // 10MB
            accept={"image/*" as any}
          />
        </CardContent>
      </Card>

      {/* 批量处理控制 */}
      {uploadedImages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("batchProcessing")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>{t("selectedImages")}: {uploadedImages.length}</span>
              <span>{t("requiredCredits")}: {uploadedImages.length}</span>
            </div>
            
            {isProcessing && (
              <div className="space-y-2">
                <Progress value={totalProgress} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {t("processingProgress")}: {Math.round(totalProgress)}%
                </p>
              </div>
            )}
            
            <Button
              onClick={startBatchProcessing}
              disabled={isProcessing || !uploadedImages.length}
              className="w-full"
            >
              {isProcessing ? t("processing") : t("startProcessing")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 处理结果 */}
      {batchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("processingResults")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {batchResults.map((result, index) => (
                <div key={result.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {t("image")} {result.index + 1}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      result.status === 'succeeded' ? 'bg-green-100 text-green-800' :
                      result.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {t(result.status || 'pending')}
                    </span>
                  </div>
                  
                  <div className="aspect-square bg-gray-100 rounded overflow-hidden">
                    <img 
                      src={result.originalImageUrl} 
                      alt={`Original image ${index + 1} before AI watermark removal`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {result.status === 'succeeded' && result.processedImageUrl && (
                    <div className="space-y-2">
                      <div className="aspect-square bg-gray-100 rounded overflow-hidden">
                        <img 
                          src={result.processedImageUrl} 
                          alt={`AI watermark removal result ${index + 1} - processed image`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <DownloadAction
                        id={result.id}
                        taskType="watermark-removal"
                      />
                    </div>
                  )}
                  
                  {result.status === 'failed' && result.error && (
                    <p className="text-xs text-red-600">{result.error}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 定价卡片对话框 */}
      <PricingCardDialog
        isOpen={pricingCardOpen}
        onClose={setPricingCardOpen}
        chargeProduct={chargeProduct}
      />
    </div>
  );
}
