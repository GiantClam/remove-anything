"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Icons } from "@/components/shared/icons";
import { Credits, model } from "@/config/constants";
import { FluxTaskStatus } from "@/db/type";
import Upload from "../upload";

interface Sora2VideoWatermarkRemovalR2Props {
  locale?: string;
}

export default function Sora2VideoWatermarkRemovalR2({ 
  locale = "en" 
}: Sora2VideoWatermarkRemovalR2Props) {
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: userCredit } = useQuery({
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

  const handleFileChange = (files: any[]) => {
    setUploadedFiles(files);
  };

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

  // 直接上传到 R2 的 mutation
  const uploadToR2Mutation = useMutation({
    mutationFn: async (file: File) => {
      const uniqueFilename = buildUniqueFilename(file);
      // 步骤1: 获取预签名 URL
      const presignedResponse = await fetch('/api/r2-presigned-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: uniqueFilename,
          contentType: file.type
        }),
      });

      if (!presignedResponse.ok) {
        throw new Error('Failed to get presigned URL');
      }

      const { presignedUrl } = await presignedResponse.json();

      // 步骤2: 直接上传到 R2
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload to R2');
      }

      // 步骤3: 从响应头或 URL 中提取 R2 URL
      const r2Url = presignedUrl.split('?')[0]; // 移除查询参数
      
      // 步骤4: 构建公共访问 URL
      const key = r2Url.split('/').pop(); // 提取文件名作为 key
      const publicUrl = `https://s.remove-anything.com/uploads/${key}`;
      
      return { publicUrl, uniqueFilename } as { publicUrl: string; uniqueFilename: string };
    },
    onSuccess: (res) => {
      console.log("✅ 文件上传到 R2 成功:", res?.publicUrl);
      toast.success("文件上传成功！");
    },
    onError: (error) => {
      console.error("❌ 文件上传失败:", error);
      toast.error("文件上传失败，请重试");
    }
  });

  // 创建任务的 mutation
  const createTaskMutation = useMutation({
    mutationFn: async (values: { r2Url: string; orientation: string; filename: string }) => {
      const formData = new FormData();
      formData.append("r2Url", values.r2Url);
      formData.append("orientation", values.orientation);
      formData.append("filename", values.filename);
      
      const res = await fetch("/api/sora2-video-watermark-removal-r2", {
        method: "POST",
        body: formData,
        credentials: 'include',
      });

      if (!res.ok && res.status >= 500) {
        throw new Error("Network response error");
      }

      const result = await res.json();
      if (!res.ok) {
        throw new Error(JSON.stringify(result));
      }

      return result;
    },
    onSuccess: (result) => {
      setTaskId(result.taskId || result.id);
      toast.success("Sora2 video watermark removal started!");
    },
    onError: (error) => {
      console.error("Sora2 video watermark removal error:", error);
      
      if (error instanceof Error) {
        try {
          const errorData = JSON.parse(error.message);
          if (errorData.code === "FILE_TOO_LARGE") {
            toast.error(`文件过大：${errorData.error}。建议使用视频压缩工具减小文件大小。`, {
              duration: 10000,
            });
          } else if (errorData.code === "INSUFFICIENT_CREDITS") {
            toast.error("积分不足，请购买更多积分");
          } else {
            toast.error(errorData.details || errorData.error || "任务创建失败，请重试");
          }
        } catch {
          if (error.message.includes("413") || error.message.includes("Content Too Large")) {
            toast.error("文件过大，请压缩视频后重试。建议文件大小不超过 50MB。", {
              duration: 10000,
            });
          } else {
            toast.error("任务创建失败，请重试");
          }
        }
      } else {
        toast.error("任务创建失败，请重试");
      }
      
      setLoading(false);
    }
  });

  const handleFileSelect = useCallback((files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      
      // 检查文件类型
      if (!file.type.startsWith('video/')) {
        toast.error('请选择视频文件');
        return;
      }
      
      // 检查文件大小 (50MB 限制)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        toast.error('视频文件大小不能超过 50MB。请压缩视频后重试。');
        return;
      }
      
      // 检查最小文件大小 (1MB)
      const minSize = 1024 * 1024; // 1MB
      if (file.size < minSize) {
        toast.error('视频文件大小至少需要 1MB');
        return;
      }
      
      setUploadedFiles([file]);
    }
  }, []);

  const handleSubmit = async () => {
    if (uploadedFiles.length === 0) {
      toast.error("请先选择视频文件");
      return;
    }

    const videoFile = uploadedFiles[0];
    setLoading(true);

    try {
      // 步骤1: 上传文件到 R2
      console.log("📤 开始上传文件到 R2...");
      const { publicUrl, uniqueFilename } = await uploadToR2Mutation.mutateAsync(videoFile) as unknown as { publicUrl: string; uniqueFilename: string };
      
      // 步骤2: 创建任务
      console.log("🚀 开始创建任务...");
      await createTaskMutation.mutateAsync({
        r2Url: publicUrl,
        orientation,
        filename: uniqueFilename
      });
      
    } catch (error) {
      console.error("处理失败:", error);
      setLoading(false);
    }
  };

  const needCredit = Credits[model.sora2VideoWatermarkRemoval] || 7;
  const hasEnoughCredit = userCredit && userCredit.credit >= needCredit;
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Sora2 Video Watermark Removal</h1>
          <p className="text-muted-foreground">
            Remove watermarks from Sora2 generated videos using advanced AI technology
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4">
              <Label className="text-base font-semibold">Upload Video</Label>
            </div>
            
            <Upload
              value={uploadedFiles}
              onChange={handleFileChange}
              accept={{ "video/*": [".mp4", ".mov", ".avi", ".mkv", ".webm"] }}
              maxSize={50 * 1024 * 1024} // 50MB
              maxFiles={1}
              multiple={false}
              placeholder={
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <Icons.Video className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Drop your video here</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    or click to browse your files
                  </p>
                  <Button variant="outline" size="sm">
                    Select Video
                  </Button>
                </div>
              }
              className="min-h-[200px]"
            />
            
            <div className="text-sm text-muted-foreground mt-4">
              <p>Supported formats: MP4, MOV, AVI, MKV, WEBM</p>
              <p>File size: 1MB - 50MB (direct upload to R2)</p>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4">
              <Label className="text-base font-semibold">Settings</Label>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Video Orientation</Label>
                <RadioGroup value={orientation} onValueChange={(value) => setOrientation(value as 'landscape' | 'portrait')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="landscape" id="landscape" />
                    <Label htmlFor="landscape">Landscape (16:9)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="portrait" id="portrait" />
                    <Label htmlFor="portrait">Portrait (9:16)</Label>
                  </div>
                </RadioGroup>
              </div>
              
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
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading || !hasEnoughCredit || (uploadedFiles.length === 0)}
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
                onClick={() => window.open('/pricing', '_blank')}
                className="ml-1 text-orange-600 underline hover:text-orange-700"
              >
                Buy credits
              </button>
            </p>
          </div>
        )}

        {taskId && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
            <div className="flex items-center gap-2">
              <Icons.check className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Task Created Successfully
              </p>
            </div>
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              Task ID: {taskId}. You can check the progress in your history.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
