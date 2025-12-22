"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import copy from "copy-to-clipboard";
import { debounce } from "lodash-es";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import BlurFade from "@/components/magicui/blur-fade";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { TASK_QUEUE_CONFIG } from "@/config/constants";

function buildUniqueFilename(file?: File): string {
  const originalName = file?.name || "video.mp4";
  const dotIndex = originalName.lastIndexOf(".");
  const base = dotIndex > -1 ? originalName.slice(0, dotIndex) : originalName;
  const ext = dotIndex > -1 ? originalName.slice(dotIndex) : ".mp4";
  const unique = (typeof crypto !== "undefined" && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${base}-${unique}${ext}`;
}

const useCreateSora2VideoWatermarkRemovalMutation = (config?: {
  onSuccess: (result: any) => void;
}) => {
  return useMutation({
    mutationFn: async (values: any) => {
      if (values.url) {
        // 使用URL直接创建任务
        const fd = new FormData();
        fd.append('url', values.url);

        const res = await fetch('/api/sora2-video-watermark-removal-url', {
          method: 'POST',
          body: fd,
          credentials: 'include'
        });

        if (!res.ok && res.status >= 500) {
          throw new Error('Network response error');
        }
        return res.json();
      } else {
        // 使用文件上传
        // 1) 获取 R2 预签名 URL
        const filename = buildUniqueFilename(values.file);
        const contentType = values.file?.type || 'video/mp4';
        const presignedRes = await fetch('/api/r2-presigned-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, contentType })
        });
        if (!presignedRes.ok) {
          const t = await presignedRes.text();
          throw new Error(`PRESIGNED_FAILED ${presignedRes.status} ${t}`);
        }
        const { presignedUrl } = await presignedRes.json();

        // 2) 前端直传到 R2（PUT）
        const uploadRes = await fetch(presignedUrl, {
          method: 'PUT',
          body: values.file,
          headers: { 'Content-Type': contentType }
        });
        if (!uploadRes.ok) {
          throw new Error(`R2_UPLOAD_FAILED ${uploadRes.status} ${uploadRes.statusText}`);
        }

        // 3) 构造公共 URL（与后端一致：uploads/<key>）
        const key = presignedUrl.split('?')[0].split('/').pop() as string;
        const r2Url = `https://s.remove-anything.com/uploads/${key}`;

        // 4) 通知后端创建任务（仅传 r2Url 与 meta，避免大请求体 413）
        const fd = new FormData();
        fd.append('r2Url', r2Url);
        fd.append('filename', filename);

        const res = await fetch('/api/sora2-video-watermark-removal-r2', {
          method: 'POST',
          body: fd,
          credentials: 'include'
        });

        // 后端可能返回 202（异步）或 200（同步）
        if (!res.ok && res.status >= 500) {
          throw new Error('Network response error');
        }
        return res.json();
      }
    },
    onSuccess: async (result) => {
      config?.onSuccess(result);
    },
  });
};

export enum Sora2VideoWatermarkRemovalTaskStatus {
  Processing = "processing",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
  Pending = "pending",
  Starting = "starting",
  Queued = "queued",
}

export default function Sora2VideoWatermarkRemoval({
  locale,
  chargeProduct,
}: {
  locale: string;
  chargeProduct?: ChargeProductSelectDto[];
}) {
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [pollMode, setPollMode] = useState<'runninghub' | 'record'>('runninghub');
  const [queueBusy, setQueueBusy] = useState(false);
  const [taskData, setTaskData] = useState<any>();
  const useCreateTask = useCreateSora2VideoWatermarkRemovalMutation({
    onSuccess: (result: any) => {
      // 后端可能返回立即创建的 RunningHub 任务ID，或 202 模式仅返回 recordId
      const rid = result?.recordId || result?.id;
      const rhId = result?.taskId;
      if (rhId) {
        setPollMode('runninghub');
        setTaskId(rhId);
      } else if (rid) {
        setPollMode('record');
        setTaskId(String(rid));
      }
    }
  });
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  // orientation removed: model auto-detects
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [estimatedProgress, setEstimatedProgress] = useState<number>(0);
  const [videoSrcTs, setVideoSrcTs] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  const [pricingCardOpen, setPricingCardOpen] = useState(false);

  // 处理文件上传状态变化
  const handleFileChange = useCallback((files: any[]) => {
    console.log("📁 handleFileChange 被调用:", files);
    setUploadedFiles(files);
    // 重置任务相关状态，避免复用上一次结果
    setTaskId("");
    setTaskData(undefined);
    setEstimatedProgress(0);
    setProcessingStartTime(null);
    setPollMode('runninghub');
    setVideoSrcTs(null);
    try {
      // 清理上一次查询缓存
      queryClient.removeQueries({ queryKey: ["querySora2VideoWatermarkRemovalTask"] });
    } catch {}
  }, [queryClient]);

  // 处理URL输入变化
  const handleUrlChange = useCallback((url: string) => {
    setVideoUrl(url);
    // 重置任务相关状态
    setTaskId("");
    setTaskData(undefined);
    setEstimatedProgress(0);
    setProcessingStartTime(null);
    setPollMode('runninghub');
    setVideoSrcTs(null);
    try {
      queryClient.removeQueries({ queryKey: ["querySora2VideoWatermarkRemovalTask"] });
    } catch {}
  }, [queryClient]);

  const queryTask = useQuery({
    queryKey: ["querySora2VideoWatermarkRemovalTask", pollMode, taskId],
    enabled: !!taskId,
    refetchInterval: (query) => {
      const data = query.state.data as any;
      if (data?.taskStatus === Sora2VideoWatermarkRemovalTaskStatus.Processing || 
          data?.taskStatus === "pending" || 
          data?.taskStatus === "starting" ||
          data?.taskStatus === "Processing") {
        return 2000; // 2秒轮询一次
      }
      return false;
    },
    queryFn: async () => {
      console.log("🔍 开始查询Sora2视频去水印任务状态，taskId:", taskId);
      let url = pollMode === 'record'
        ? `/api/sora2-video-watermark-removal-by-id/${taskId}`
        : `/api/sora2-video-watermark-removal/${taskId}`;
      // 追加时间戳避免缓存
      url += (url.includes('?') ? '&' : '?') + `_t=${Date.now()}`;
      const res = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
      });
      console.log("📡 API响应状态:", res.status, res.statusText);
      
      if (!res.ok) {
        console.error("❌ API请求失败:", res.status, res.statusText);
        const errorText = await res.text();
        console.error("❌ 错误详情:", errorText);
        throw new Error(`Failed to fetch task: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      // 容错：成功但未带 imageUrl，尝试切换 record 模式再拉一次
      if (pollMode === 'runninghub' && data?.taskStatus === 'succeeded' && !data?.imageUrl && data?.id) {
        try {
          const r2 = await fetch(`/api/sora2-video-watermark-removal-by-id/${data.id}`, { credentials: 'include' });
          if (r2.ok) return await r2.json();
        } catch {}
      }
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
      if (queryTask.data.taskStatus === Sora2VideoWatermarkRemovalTaskStatus.Succeeded) {
        setLoading(false);
        setProcessingStartTime(null);
        setEstimatedProgress(100);
        // 设置一次时间戳用于避免视频播放器缓存
        setVideoSrcTs(Date.now());
        toast.success("Sora2 video watermark removal completed!");
      } else if (queryTask.data.taskStatus === Sora2VideoWatermarkRemovalTaskStatus.Failed) {
        setLoading(false);
        setProcessingStartTime(null);
        setEstimatedProgress(0);
        toast.error("Sora2 video watermark removal failed. Please try again.");
      } else if (['pending', 'starting', 'processing', 'Processing'].includes(queryTask.data.taskStatus)) {
        setLoading(true);
        if (!processingStartTime) {
          setProcessingStartTime(Date.now());
        }
      }
    }
  }, [queryTask.data, processingStartTime]);

  // 监听查询错误
  useEffect(() => {
    if (queryTask.error) {
      console.error("❌ 查询任务失败:", queryTask.error);
      toast.error("Failed to fetch task status. Please try again.");
    }
  }, [queryTask.error]);

  const onBeforeunload = () => {
    if (loading) {
      return "Are you sure you want to leave? Your video watermark removal is still processing.";
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

  // 计算处理进度
  useEffect(() => {
    if (processingStartTime && loading) {
      const interval = setInterval(() => {
        const elapsed = Date.now() - processingStartTime;
        const totalEstimated = 4 * 60 * 1000; // 4分钟
        const progress = Math.min((elapsed / totalEstimated) * 100, 95); // 最多95%，避免100%但任务未完成
        setEstimatedProgress(progress);
      }, 1000); // 每秒更新一次

      return () => clearInterval(interval);
    }
  }, [processingStartTime, loading]);

  const handleSubmit = async () => {
    console.log("🚀 handleSubmit 开始执行");
    console.log("📁 uploadedFiles:", uploadedFiles);
    console.log("🔗 videoUrl:", videoUrl);
    
    // 检查是否有文件上传或URL输入
    if (uploadedFiles.length === 0 && !videoUrl.trim()) {
      toast.error("Please upload a video file or enter a video URL");
      return;
    }

    // 如果同时有文件和URL，优先使用文件
    if (uploadedFiles.length > 0) {
      const videoFile = uploadedFiles[0]?.originFile;
      if (!videoFile) {
        toast.error("Please upload a valid video file");
        return;
      }
    } else if (videoUrl.trim()) {
      // 验证URL格式
      try {
        new URL(videoUrl.trim());
      } catch {
        toast.error("Please enter a valid video URL");
        return;
      }
    }

    // 如果有文件上传，进行文件验证
    if (uploadedFiles.length > 0) {
      const videoFile = uploadedFiles[0]?.originFile;
      
      // 检查文件类型
      if (!videoFile.type.startsWith('video/')) {
        toast.error('Please select a video file');
        return;
      }
      
      // 检查文件大小 (50MB 限制，考虑到 Vercel 的限制)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (videoFile.size > maxSize) {
        toast.error('视频文件大小不能超过 50MB。请压缩视频后重试。');
        return;
      }
      
      // 检查最小文件大小 (1MB)
      const minSize = 1024 * 1024; // 1MB
      if (videoFile.size < minSize) {
        toast.error('Video file size must be at least 1MB');
        return;
      }
      
      // 检查文件扩展名
      const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
      const fileExtension = videoFile.name.toLowerCase().substring(videoFile.name.lastIndexOf('.'));
      if (!allowedExtensions.includes(fileExtension)) {
        toast.error('Supported video formats: MP4, MOV, AVI, MKV, WEBM');
        return;
      }
      
      // 检查 MIME 类型
      const allowedMimeTypes = [
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo',
        'video/x-matroska',
        'video/webm'
      ];
      if (!allowedMimeTypes.includes(videoFile.type)) {
        toast.error(`Unsupported video format: ${videoFile.type}. Please use MP4, MOV, AVI, MKV, or WEBM format.`);
        return;
      }
    }

    setLoading(true);
    setTaskData(undefined);

    // 添加调试信息
    if (uploadedFiles.length > 0) {
      const videoFile = uploadedFiles[0]?.originFile;
      console.log("🔍 视频文件信息:", {
        name: videoFile.name,
        size: videoFile.size,
        type: videoFile.type,
        lastModified: videoFile.lastModified
      });

      // 检查视频文件是否为空或损坏
      if (videoFile.size === 0) {
        toast.error('Video file is empty. Please select a valid video file.');
        return;
      }

      // 检查文件是否真的是视频文件
      if (!videoFile.type.startsWith('video/')) {
        toast.error('Please select a valid video file.');
        return;
      }
    } else {
      console.log("🔍 使用视频URL:", videoUrl);
    }

    try {
      setLoading(true);
      setProcessingStartTime(Date.now());
      
      let result;
      if (uploadedFiles.length > 0) {
        // 使用文件上传
        const videoFile = uploadedFiles[0]?.originFile;
        result = await useCreateTask.mutateAsync({
          file: videoFile,
        });
      } else {
        // 使用URL
        result = await useCreateTask.mutateAsync({
          url: videoUrl.trim(),
        });
      }

      if (result.error) {
        toast.error(result.error);
        setLoading(false);
        return;
      }
      // onSuccess 回调中已经设置了 poll 模式与 taskId
      toast.success("Sora2 video watermark removal started!");
    } catch (error: any) {
      console.error("Sora2 video watermark removal error:", error);
      if (typeof error?.message === 'string' && error.message.includes('TASK_QUEUE_MAXED')) {
        setLoading(false);
        setProcessingStartTime(null);
        setQueueBusy(true);
        toast.error("当前任务队列已满，请稍后重试或稍等片刻再开始。", { duration: 6000 });
        return;
      }
      
      // 处理特定的错误类型
      if (error instanceof Error) {
        try {
          const errorData = JSON.parse(error.message);
          if (errorData.code === "INVALID_VIDEO_FILE") {
            // 显示详细的错误信息和建议
            const errorMessage = errorData.details || "Invalid video file format. Please try a different video.";
            toast.error(errorMessage, {
              duration: 8000, // 显示更长时间
            });
            
            // 如果有建议，也显示
            if (errorData.suggestions && Array.isArray(errorData.suggestions)) {
              console.log("💡 建议解决方案:", errorData.suggestions);
            }
          } else if (errorData.code === "INSUFFICIENT_CREDITS") {
            toast.error("Insufficient credits. Please purchase more credits to continue.");
          } else if (errorData.code === "FILE_TOO_LARGE") {
            toast.error(`文件过大：${errorData.error}。建议使用视频压缩工具减小文件大小。`, {
              duration: 10000,
            });
          } else if (errorData.code === "FILE_TOO_SMALL") {
            toast.error(`文件过小：${errorData.error}`);
          } else {
            toast.error(errorData.details || errorData.error || "Failed to start video watermark removal. Please try again.");
          }
        } catch {
          // 如果不是 JSON 格式的错误，检查是否是 413 错误
          if (error.message.includes("413") || error.message.includes("Content Too Large")) {
            toast.error("文件过大，请压缩视频后重试。建议文件大小不超过 50MB。", {
              duration: 10000,
            });
          } else {
            // 显示通用错误信息
            toast.error("Failed to start video watermark removal. Please try again.");
          }
        }
      } else {
        toast.error("Failed to start video watermark removal. Please try again.");
      }
      
      setLoading(false);
    }
  };

  // URL 弹窗：Enter 提交 / Esc 关闭
  const handleStartWithUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    try {
      new URL(url);
      setUrlError(null);
    } catch {
      setUrlError('Invalid URL');
      return;
    }
    handleUrlChange(url);
    setShowUrlDialog(false);
    await handleSubmit();
  };

  const copyPrompt = (prompt: string) => {
    copy(prompt);
    toast.success("Copied to clipboard!");
  };

  const needCredit = Credits[model.sora2VideoWatermarkRemoval] || 7; // 默认7积分
  const hasEnoughCredit = userCredit && userCredit.credit >= needCredit;
  
  // 调试信息
  console.log("🔍 Sora2VideoWatermarkRemoval 组件状态:", {
    uploadedFiles: uploadedFiles.length,
    videoUrl: videoUrl,
    // orientation removed
    loading,
    hasEnoughCredit,
    userCredit: userCredit?.credit,
    buttonDisabled: loading || (!hasEnoughCredit) || (uploadedFiles.length === 0 && !videoUrl.trim())
  });

  const isProcessing = useMemo(() => {
    if (loading) return true;
    const s = (taskData?.taskStatus as string) || '';
    return ['pending', 'starting', 'processing', 'Processing'].includes(s);
  }, [loading, taskData?.taskStatus]);

  return (
    <div className="container mx-auto max-w-4xl p-6">
      {/* 并发提示条（仅在队列繁忙时展示） */}
      {queueBusy && (
        <div className="mb-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                当前系统最大并发任务数：{TASK_QUEUE_CONFIG.MAX_CONCURRENT_TASKS}。
                当队列已满时，新任务会被拒绝，请稍后重试。
              </div>
              <div className="ml-4 text-amber-900/80">系统繁忙，已拒绝新任务</div>
            </div>
          </div>
        </div>
      )}
      <div className="mb-8 text-center">
        <h1 className="mb-4 text-3xl font-bold">Sora2 Video Watermark Removal</h1>
        <p className="text-muted-foreground">
          Remove watermarks from your videos using AI. Simply upload a video and get a clean result.
        </p>
      </div>

      {/* 网格容器始终渲染；仅左侧上传区在处理或有结果时隐藏 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左侧：输入区域（仅在非加载且无结果时显示） */}
        <div className={`space-y-6 ${isProcessing ? 'pointer-events-none opacity-60' : ''}`} aria-disabled={isProcessing}>
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4">
              <Label className="text-base font-semibold">
                Upload Video
              </Label>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <Upload
                  value={uploadedFiles}
                  onChange={handleFileChange}
                  accept={{ "video/*": [".mp4", ".mov", ".avi", ".mkv", ".webm"] }}
                  maxSize={100 * 1024 * 1024} // 100MB
                  maxFiles={1}
                  multiple={false}
                  placeholder={
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                      <Icons.Video className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium mb-2">Drop your video here</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        or click to browse your files
                      </p>
                      <Button variant="outline" size="sm" disabled={isProcessing}>
                        Select Video
                      </Button>
                      <button className="mt-2 text-xs underline disabled:no-underline disabled:opacity-70" onClick={() => setShowUrlDialog(true)} disabled={isProcessing}>Use URL (YouTube supported)</button>
                    </div>
                  }
                  className="min-h-[200px]"
                />
                {isProcessing && (
                  <div className="absolute inset-0 rounded-lg" />
                )}
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>Supported formats: MP4, MOV, AVI, MKV, WEBM</p>
                <p>File size: 1MB - 50MB (recommended for mobile devices)</p>
              </div>
            </div>
            
            {/* 改为弹窗触发，简化首屏 */}
            <div className="text-sm text-muted-foreground">
              Or <button className="underline underline-offset-2" onClick={() => setShowUrlDialog(true)}>enter video URL</button>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4">
              <Label className="text-base font-semibold">Settings</Label>
            </div>
            
            <div className="space-y-4">
              {/* Orientation settings removed: model auto-detects */}
              
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">Cost</p>
                  <p className="text-sm text-muted-foreground">
                    {needCredit} credits per video
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
            disabled={isProcessing || !hasEnoughCredit || (uploadedFiles.length === 0 && !videoUrl.trim())}
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
                <Icons.Video className="mr-2 h-4 w-4" />
                Remove Watermark
              </>
            )}
          </Button>

          {/* 处理时长提示 */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
            <div className="flex items-center gap-2">
              <Icons.clock className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Processing Time
              </p>
            </div>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              Video watermark removal typically takes about 6 minutes. Please be patient while our AI processes your video.
            </p>
          </div>

          {!hasEnoughCredit && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950">
              <div className="flex items-center gap-2">
                <Icons.warning className="h-4 w-4 text-orange-600" />
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Insufficient credits
                </p>
              </div>
              <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">
                You need {needCredit} credits to remove watermarks. 
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

        {/* 右侧：结果区域（始终显示容器，根据状态渲染内容） */}
        <div className="space-y-6">
          {loading && <Loading progress={estimatedProgress} processingStartTime={processingStartTime} />}

          {taskData && (
            <div className="rounded-lg border bg-card p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Result</h3>
                <p className="text-sm text-muted-foreground">
                  {taskData.taskStatus === Sora2VideoWatermarkRemovalTaskStatus.Succeeded
                    ? "Video watermark removal completed successfully"
                    : taskData.taskStatus === Sora2VideoWatermarkRemovalTaskStatus.Failed
                    ? "Video watermark removal failed"
                    : taskData.taskStatus === "pending"
                    ? "Task is queued and waiting to start"
                    : taskData.taskStatus === "starting"
                    ? "Task is starting up"
                    : taskData.taskStatus === "processing" || taskData.taskStatus === "Processing"
                    ? "AI is removing watermarks from your video"
                    : "Video watermark removal in progress"}
                </p>
              </div>

              {taskData.taskStatus === Sora2VideoWatermarkRemovalTaskStatus.Succeeded && taskData.imageUrl && (
                <div className="space-y-4">
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                    <video
                      src={(function () {
                        const base = taskData.imageUrl as string;
                        const sep = base.includes('?') ? '&' : '?';
                        const ts = videoSrcTs ?? Date.now();
                        return `${base}${sep}_t=${ts}`;
                      })()}
                      controls
                      className="h-full w-full object-cover"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>

                  <div className="flex gap-2">
                    <DownloadAction
                      id={taskData.runninghubTaskId}
                      showText={true}
                      taskType="sora2-video-watermark-removal"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyPrompt(taskData.imageUrl || "")}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy URL
                    </Button>
                  </div>
                </div>
              )}

              {taskData.taskStatus === Sora2VideoWatermarkRemovalTaskStatus.Failed && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
                  <div className="flex items-center gap-2">
                    <Icons.close className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      Video watermark removal failed
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                    {taskData.errorMsg || "Please try again with a different video."}
                  </p>
                </div>
              )}
            </div>
          )}

          {!loading && !taskData && (
            <>
              <EmptyPlaceholder>
                <EmptyPlaceholder.Icon name="Video">
                  <Icons.Video className="h-8 w-8" />
                </EmptyPlaceholder.Icon>
                <EmptyPlaceholder.Title>No result yet</EmptyPlaceholder.Title>
                <EmptyPlaceholder.Description>
                  Upload a video and click "Remove Watermark" to get started.
                </EmptyPlaceholder.Description>
              </EmptyPlaceholder>
              <ComfortingMessages />
            </>
          )}
        </div>
      </div>

      {/* 定价卡片对话框 */}
      <PricingCardDialog
        isOpen={pricingCardOpen}
        onClose={setPricingCardOpen}
        chargeProduct={chargeProduct}
      />

      {/* URL 输入对话框（支持 YouTube 链接，将由后端按非 R2 URL 入队处理）*/}
      <Dialog open={showUrlDialog} onOpenChange={setShowUrlDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Paste video URL</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <Input
              type="url"
              placeholder="https://youtu.be/... or https://example.com/video.mp4"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') await handleStartWithUrl();
                if (e.key === 'Escape') setShowUrlDialog(false);
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