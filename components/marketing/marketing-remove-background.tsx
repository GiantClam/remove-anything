'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Download, LogIn, Sparkles, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { WebhookHandler } from './webhook-handler';
import { BeforeAfterSlider } from '@/components/ui/before-after-slider';

interface MarketingRemoveBackgroundProps {
  locale: string;
}

export default function MarketingRemoveBackground({ locale }: MarketingRemoveBackgroundProps) {
  // 所有hooks必须在组件顶层调用，不能在任何条件语句中
  const t = useTranslations('IndexPage');
  const tPage = useTranslations('RemoveBackgroundPage');
  const { data: session, status } = useSession();
  
  // 状态管理
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [hasError, setHasError] = useState<string | false>(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [recentImages, setRecentImages] = useState<Array<{url: string, timestamp: number}>>([]);
  
  // 使用useMemo来避免重复计算，添加安全检查
  const isAuthenticated = useMemo(() => {
    try {
      return !!session?.user;
    } catch (error) {
      console.error('Session error:', error);
      return false;
    }
  }, [session?.user]);

  // 安全地获取翻译文本
  const title = useMemo(() => {
    try {
      return t('title');
    } catch (error) {
      console.error('Translation error:', error);
      return 'Free AI Background Remover';
    }
  }, [t]);

  const description = useMemo(() => {
    try {
      return t('description');
    } catch (error) {
      console.error('Translation error:', error);
      return 'Instantly remove the background from any image with our free AI-powered tool.';
    }
  }, [t]);

  // URL 输入与处理
  const [urlInput, setUrlInput] = useState('');
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const dialogInputWrapperRef = useRef<HTMLDivElement | null>(null);

  async function processImageFromUrl(imageUrl: string) {
    // 基础校验：URL 与扩展名
    try {
      const u = new URL(imageUrl);
      const hasExt = /(jpg|jpeg|png|webp|gif)$/i.test(u.pathname);
      setUrlError(hasExt ? null : 'Please provide a direct image URL (jpg/png/webp).');
    } catch {
      setUrlError('Invalid URL');
      return;
    }
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const ext = (blob.type && blob.type.split('/')[1]) || 'jpg';
      const file = new File([blob], `uploaded-url.${ext}`, { type: blob.type || 'image/jpeg' });
      
      // 添加到最近图片历史
      setRecentImages(prev => {
        const newImages = [{url: imageUrl, timestamp: Date.now()}, ...prev.filter(img => img.url !== imageUrl)];
        return newImages.slice(0, 4); // 只保留最近4张
      });
      
      await processImage(file);
    } catch (e) {
      console.error('Fetch URL image failed:', e);
      toast.error(tPage('uploadFile'));
    }
  }

  // 粘贴交互：支持直接粘贴图片或 URL
  useEffect(() => {
    function handlePaste(e: any) {
      try {
        const items = e.clipboardData?.items || [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              processImage(file);
            }
            return;
          }
        }
        const text = e.clipboardData?.getData('text');
        if (text && /^https?:\/\//.test(text)) processImageFromUrl(text);
      } catch {
        // no-op
      }
    }
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // 添加错误处理和登录后处理逻辑
  useEffect(() => {
    if (status === 'unauthenticated') {
      console.log('User is not authenticated');
    } else if (status === 'authenticated') {
      // 检查是否有待下载的任务
      const pendingTaskId = sessionStorage.getItem('pendingDownloadTaskId');
      if (pendingTaskId) {
        console.log('Found pending download task:', pendingTaskId);
        sessionStorage.removeItem('pendingDownloadTaskId');
        // 设置当前任务ID，这样用户可以下载
        setCurrentTaskId(pendingTaskId);
        // 尝试获取任务状态和图片
        fetchTaskResult(pendingTaskId);
      }
    }
  }, [status]);

  // 获取任务结果的函数
  const fetchTaskResult = async (taskId: string) => {
    try {
      const response = await fetch(`/api/task/${taskId}?dbOnly=true`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'succeeded' && data.output) {
          setProcessedImage(data.output);
          toast.success(tPage('foundProcessedImage'));
        }
      }
    } catch (error) {
      console.error('Error fetching task result:', error);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.error(tPage('uploadFile'));
      return;
    }

    // 验证文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(tPage('fileSizeLimit'));
      return;
    }

    // 重置之前的状态，并进入处理中的不可编辑态
    setProcessedImage(null);
    setHasError(false);
    setCurrentTaskId(null);
    setIsProcessing(true);

    setUploadedFile(file);

    // 显示原始图片
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setOriginalImage(imageUrl);
      
      // 添加到最近图片历史
      setRecentImages(prev => {
        const newImages = [{url: imageUrl, timestamp: Date.now()}, ...prev.filter(img => img.url !== imageUrl)];
        return newImages.slice(0, 4); // 只保留最近4张
      });
    };
    reader.readAsDataURL(file);

    // 开始处理
    await processImage(file);
  };

  function enqueueFiles(files: FileList | File[]) {
    const list = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (list.length === 0) return;
    // 如果当前没有在处理，则立刻处理第一张，其余入队
    if (!isProcessing && !uploadedFile) {
      setUploadedFile(list[0]);
      const reader = new FileReader();
      reader.onload = (e) => setOriginalImage(e.target?.result as string);
      reader.readAsDataURL(list[0]);
      processImage(list[0]);
      if (list.length > 1) setQueuedFiles(prev => [...prev, ...list.slice(1)]);
    } else {
      setQueuedFiles(prev => [...prev, ...list]);
    }
  }

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setProcessedImage(null);

    try {
      // 创建FormData
      const formData = new FormData();
      formData.append('image', file);

      // 调用API创建异步任务
      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to create background removal task');
      }

      const result = await response.json();
      
      if (result.success && result.taskId) {
        console.log("✅ 任务创建成功，任务ID:", result.taskId);
        setCurrentTaskId(result.taskId);
        
        // 开始轮询任务状态
        await pollTaskStatus(result.taskId);
      } else {
        throw new Error('No task ID received');
      }
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error(tPage('processingFailed'));
      
      // 如果API调用失败，显示模拟结果用于演示
      if (uploadedFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setProcessedImage(e.target?.result as string);
        };
        reader.readAsDataURL(uploadedFile);
      }
    } finally {
      // 结束与队列推进逻辑由成功/失败回调统一处理，避免生产环境下提前关闭遮罩
    }
  };

  // 通过URL启动任务（服务器端拉取，避免浏览器CORS）
  const processImageByUrl = async (imageUrl: string) => {
    setIsProcessing(true);
    setProcessedImage(null);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageUrl }),
      });
      if (!response.ok) throw new Error('Failed to create background removal task');
      const result = await response.json();
      if (result.success && result.taskId) {
        setCurrentTaskId(result.taskId);
        await pollTaskStatus(result.taskId);
      } else {
        throw new Error('No task ID received');
      }
    } catch (error) {
      console.error('Error processing image by URL:', error);
      toast.error(tPage('processingFailed'));
    }
  };

  // 统一推进队列函数：在任务真正完成/失败时调用
  function advanceQueue() {
    setQueuedFiles(prev => {
      if (prev.length === 0) return prev;
      const [next, ...rest] = prev;
      setUploadedFile(next);
      const reader = new FileReader();
      reader.onload = (e) => setOriginalImage(e.target?.result as string);
      reader.readAsDataURL(next);
      // 触发下一张处理（异步）
      setTimeout(() => { processImage(next); }, 0);
      return rest;
    });
  }

  // 使用 SSE 监听任务状态（生产环境）或轮询（开发环境）
  const pollTaskStatus = async (taskId: string) => {
    const isProduction = typeof window !== 'undefined' && 
      (window.location.hostname === 'www.remove-anything.com' || 
       window.location.hostname === 'remove-anything.com' ||
       window.location.hostname === 'vercel.app');
    
    if (isProduction) {
      console.log("🔗 生产环境：使用 SSE 实时监听");
      console.log("📝 任务已创建，ID:", taskId);
      toast.success(tPage('taskCreated'));
      
      // 使用 Server-Sent Events 实时监听
      const eventSource = new EventSource(`/api/task-status-stream/${taskId}`);
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📡 SSE 收到状态更新:", data);
          
          if (data.status === 'succeeded' && data.output) {
            console.log("✅ 任务完成，输出:", data.output);
            setProcessedImage(data.output);
            setIsProcessing(false);
            toast.success(tPage('backgroundRemoved'));
            eventSource.close();
          } else if (data.status === 'failed') {
            console.log("❌ 任务失败:", data.error);
            setHasError(data.error || 'Task failed');
            setIsProcessing(false);
            toast.error(data.error || 'Task failed');
            eventSource.close();
          } else if (data.status === 'timeout') {
            console.log("⏰ 任务超时");
            setHasError('Task timeout');
            setIsProcessing(false);
            toast.error('Task timeout');
            eventSource.close();
          } else if (data.error) {
            console.log("❌ SSE 错误:", data.error);
            setHasError(data.error);
            setIsProcessing(false);
            toast.error(data.error);
            eventSource.close();
          }
        } catch (error) {
          console.error("❌ 解析 SSE 数据失败:", error);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error("❌ SSE 连接错误:", error);
        eventSource.close();
        // 降级到轮询
        fallbackToPolling(taskId);
      };
      
      return;
    }

    // 开发环境：使用轮询模式
    fallbackToPolling(taskId);
  };

  // 降级轮询函数
  const fallbackToPolling = async (taskId: string) => {
    console.log("🔍 开发环境：使用轮询模式");
    const maxAttempts = 40; // 减少轮询次数（约2分钟）
    let attempts = 0;
    let pollTimeout: NodeJS.Timeout | null = null;
    let isPollingStopped = false;
    
    const poll = async (): Promise<void> => {
      if (isPollingStopped) {
        console.log("🛑 轮询已停止，跳过查询");
        return;
      }
      try {
        console.log(`🔍 第 ${attempts + 1} 次查询任务状态: ${taskId}`);
        
        const response = await fetch(`/api/task/${taskId}`);
        
        if (!response.ok) {
          throw new Error('Failed to get task status');
        }
        
        const taskStatus = await response.json();
        console.log("任务状态:", taskStatus);
        
        switch (taskStatus.status) {
          case 'pending':
          case 'starting':
          case 'processing':
            if (attempts < maxAttempts) {
              attempts++;
              console.log(`⏳ 任务处理中，${attempts}/${maxAttempts}，3秒后再次查询...`);
              pollTimeout = setTimeout(() => poll(), 3000);
            } else {
              console.log(`⏰ 任务超时，已轮询 ${maxAttempts} 次`);
              throw new Error('Task timeout');
            }
            break;
            
          case 'succeeded':
            console.log('✅ 任务成功完成!');
            isPollingStopped = true;
            if (pollTimeout) {
              clearTimeout(pollTimeout);
              pollTimeout = null;
            }
            if (taskStatus.output) {
              setProcessedImage(taskStatus.output);
              toast.success(tPage('backgroundRemoved'));
            } else {
              throw new Error('No output received');
            }
            break;
            
          case 'failed':
          case 'canceled':
            console.log(`❌ 任务失败: ${taskStatus.error || 'Task failed'}`);
            isPollingStopped = true;
            if (pollTimeout) {
              clearTimeout(pollTimeout);
              pollTimeout = null;
            }
            throw new Error(taskStatus.error || 'Task failed');
            
          default:
            console.log(`⚠️ 未知状态: ${taskStatus.status}`);
            throw new Error(`Unknown task status: ${taskStatus.status}`);
        }
      } catch (error) {
        console.error('Error polling task status:', error);
        isPollingStopped = true;
        if (pollTimeout) {
          clearTimeout(pollTimeout);
          pollTimeout = null;
        }
        toast.error(tPage('getStatusFailed'));
      }
    };
    
    await poll();
  };

  const handleDownload = async () => {
    if (!isAuthenticated) {
      toast.info(tPage('loginToDownload'));
      // 保存当前任务ID到sessionStorage，登录后可以继续下载
      if (currentTaskId) {
        sessionStorage.setItem('pendingDownloadTaskId', currentTaskId);
      }
      window.location.href = `/${locale}/signin`;
      return;
    }

    if (!processedImage) {
      toast.error(tPage('noImageToDownload'));
      return;
    }

    try {
      // 平台检测
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      const isIOS = /iP(hone|od|ad)/.test(ua);
      const isAndroid = /Android/.test(ua);
      const isMobile = isIOS || isAndroid;

      // 如果有任务ID，使用API下载（支持统计和权限控制）
      if (currentTaskId) {
        const response = await fetch(`/api/download-background?taskId=${currentTaskId}`, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const fileName = `background-removed-${currentTaskId}.png`;
          
          if (isMobile) {
            // 移动端：优先尝试 Web Share API
            try {
              // @ts-ignore
              if (navigator.share && typeof navigator.share === 'function') {
                // 将 blob 转换为 File 对象
                const file = new File([blob], fileName, { type: blob.type });
                // @ts-ignore
                await navigator.share({ 
                  files: [file], 
                  title: fileName,
                  text: '去背景图片'
                });
                console.log("✅ 使用 Web Share API 分享文件成功");
                window.URL.revokeObjectURL(url);
                toast.success('图片已保存到相册');
                return;
              }
            } catch (e) {
              console.log("ℹ️ Web Share API 不可用或被拒绝，使用其他方案", e);
            }

            if (isIOS) {
              // iOS：新开标签展示，由用户通过分享保存到相册
              window.open(url, '_blank');
              toast.info("长按图片→保存到相册", { duration: 4000 });
            } else if (isAndroid) {
              // Android：使用 a[download] 触发保存到下载目录
              const link = document.createElement("a");
              link.href = url;
              link.download = fileName;
              link.style.display = "none";
              document.body.appendChild(link);
              setTimeout(() => link.click(), 50);
              setTimeout(() => document.body.removeChild(link), 200);
              toast.info("图片已保存到下载目录，图库会自动扫描导入", { duration: 4000 });
            }
          } else {
            // PC端：直接下载到本地
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            link.style.display = "none";
            document.body.appendChild(link);
            setTimeout(() => link.click(), 50);
            setTimeout(() => document.body.removeChild(link), 200);
            toast.success("图片已开始下载");
          }
          
          // 延迟释放 URL 对象
          setTimeout(() => window.URL.revokeObjectURL(url), 1000);
          return;
        } else {
          console.warn('API download failed, falling back to direct download');
        }
      }
      
      // 降级方案：直接下载图片URL
      const fileName = 'removed-background.png';
      
      if (isMobile) {
        // 移动端降级方案
        if (isIOS) {
          // iOS：新开标签展示
          window.open(processedImage, '_blank');
          toast.info("长按图片→保存到相册", { duration: 4000 });
        } else if (isAndroid) {
          // Android：使用 a[download]
          const link = document.createElement("a");
          link.href = processedImage;
          link.download = fileName;
          link.style.display = "none";
          document.body.appendChild(link);
          setTimeout(() => link.click(), 50);
          setTimeout(() => document.body.removeChild(link), 200);
          toast.info("图片已保存到下载目录，图库会自动扫描导入", { duration: 4000 });
        }
      } else {
        // PC端降级方案
        const link = document.createElement("a");
        link.href = processedImage;
        link.download = fileName;
        link.style.display = "none";
        document.body.appendChild(link);
        setTimeout(() => link.click(), 50);
        setTimeout(() => document.body.removeChild(link), 200);
        toast.success("图片已开始下载");
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('下载失败，请重试');
    }
  };

  const handleTryAgain = () => {
    if (uploadedFile) {
      processImage(uploadedFile);
    }
  };


  const hasUpload = !!(originalImage || processedImage);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* 主上传区域 - 未上传时显示 */}
      {!hasUpload && (
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
          Upload an image to remove the background
        </h1>
        
        {/* 上传区域 */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors mx-auto max-w-2xl",
            isDragging ? "border-primary bg-primary/5" : "border-gray-300"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const files = e.dataTransfer.files;
            if (files && files.length) enqueueFiles(files);
          }}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
            id="image-upload-main"
            disabled={isProcessing}
          />
          <label
            htmlFor="image-upload-main"
            className={cn(
              "cursor-pointer inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-lg",
              isProcessing && "opacity-50 cursor-not-allowed"
            )}
          >
            <Upload className="w-5 h-5" />
            {isProcessing ? tPage('processing') : 'Upload Image'}
          </label>
          <p className="text-sm text-muted-foreground mt-3">
            or drag and drop your image here
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            paste image or 
            <button
              type="button"
              onClick={() => setShowUrlDialog(true)}
              className="underline underline-offset-2 ml-1"
            >URL</button>
          </p>
          
          {/* 示例缩略图 */}
          <div className="mt-6 flex items-center justify-center gap-4">
            {[
              'https://s.remove-anything.com/sample/1.png',
              'https://s.remove-anything.com/sample/2.png',
              'https://s.remove-anything.com/sample/3.png',
              'https://s.remove-anything.com/sample/4.png',
            ].map((u, i) => (
              <button
                key={i}
                type="button"
                onClick={async () => {
                  try {
                    // 先即时显示原图，确保Processed Image card先出现，且对比滑块有beforeSrc
                    setOriginalImage(u);
                    setProcessedImage(null);
                    setHasError(false);
                    setCurrentTaskId(null);
                    setIsProcessing(true);
                    // 记录到最近图片
                    setRecentImages(prev => {
                      const next = [{ url: u, timestamp: Date.now() }, ...prev.filter(img => img.url !== u)];
                      return next.slice(0, 4);
                    });

                    // 通过服务端创建任务，避免浏览器CORS
                    await processImageByUrl(u);
                  } catch (e) {
                    console.error('Sample load error', e);
                  }
                }}
                className="h-16 w-16 rounded-xl overflow-hidden ring-1 ring-border hover:ring-primary transition"
                aria-label="Try a sample"
              >
                <img src={u} alt="sample" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          
          <div className="mt-4 grid gap-1 text-xs text-muted-foreground">
            <p>• PNG, JPG, WEBP up to 15&nbsp;MB</p>
            <p>• Drag multiple files to auto-queue them</p>
            {queuedFiles.length > 0 && (
              <p>• In queue: {queuedFiles.length} image(s)</p>
            )}
          </div>
          
          {isProcessing && (
            <div className="mt-4 h-1 w-full bg-muted overflow-hidden rounded">
              <div className="h-full w-1/3 bg-primary animate-[progress_1.2s_ease-in-out_infinite]" />
            </div>
          )}
        </div>
        
        {/* 条款说明 */}
        <p className="mt-6 text-xs text-muted-foreground max-w-2xl mx-auto">
          By uploading an image or URL you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
      )}

      {/* 结果/编辑视图：上传后替换首屏 */}
      {hasUpload && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{tPage('processedImage')}</span>
              <Button onClick={handleDownload} size="sm" className="flex items-center gap-2">
                {isAuthenticated ? (<><Download className="w-4 h-4" />{tPage('download')}</>) : (<><LogIn className="w-4 h-4" />{tPage('loginDownload')}</>)}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* 轻量工具栏 - 暂时隐藏，后续补充功能 */}
            {/* <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 p-2 text-sm max-w-[520px] mx-auto">
              <Button variant="ghost" size="sm" className="rounded-full">Cutout</Button>
              <Button variant="ghost" size="sm" className="rounded-full">Background</Button>
              <Button variant="ghost" size="sm" className="rounded-full">Effects</Button>
              <div className="ml-auto flex gap-1">
                <Button variant="ghost" size="sm">↶</Button>
                <Button variant="ghost" size="sm">↷</Button>
              </div>
            </div> */}
            <div
              className="bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center p-2 h-[520px] w-[520px] mx-auto"
              onDoubleClick={() => {
                // 双击在 Before/After 与单张 After 之间切换：若只有一张则忽略
                if (processedImage && originalImage) {
                  setProcessedImage(prev => prev ? prev : processedImage);
                  // 通过切换一个哨兵状态：若 processed 存在且 slider 显示中，则改为仅 after 图
                  // 简化处理：切换一个本地布尔 via data-attr
                  const el = document.getElementById('ba-toggle');
                  if (el) {
                    const v = el.getAttribute('data-on') === '1' ? '0' : '1';
                    el.setAttribute('data-on', v);
                  }
                }
              }}
            >
            {isProcessing ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* 半透明禁用的原图（非灰度） */}
                  <img
                    src={originalImage || ''}
                    alt="Processing"
                    className="max-w-full max-h-full object-contain rounded opacity-60 pointer-events-none select-none"
                    decoding="async"
                  />
                  {/* 明显的等待遮罩与呼吸灯 */}
                  <div className="absolute inset-0 z-10 rounded bg-background/40 backdrop-blur-sm grid place-items-center">
                    <div
                      role="status"
                      aria-live="polite"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-background/80 shadow-sm animate-[pulse_1.8s_ease-in-out_infinite]"
                    >
                      <span className="h-4 w-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                      <span className="text-xs font-medium text-foreground/80">{tPage('removingBackground')}</span>
                    </div>
                  </div>
                </div>
              ) : processedImage ? (
                <BeforeAfterSlider
                  beforeSrc={originalImage || ''}
                  afterSrc={processedImage}
                  beforeLabel="Original"
                  afterLabel="Result"
                  showLabels={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <img
                      src={originalImage || ''}
                      alt="Original"
                      className="max-w-full max-h-full object-contain rounded"
                    />
                  </div>
                </div>
              )}
            </div>
            {hasError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{hasError}</p>
              </div>
            )}
            
            {/* 底部控制区域：+按钮和最近图片 */}
            <div className="mt-6 flex items-center justify-center gap-3">
              {/* + 按钮 */}
              <button
                onClick={() => {
                  const el = document.getElementById('image-upload-hidden') as HTMLInputElement | null;
                  const fallback = document.getElementById('image-upload-main') as HTMLInputElement | null;
                  (el || fallback)?.click();
                }}
                className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 transition-colors flex items-center justify-center"
                aria-label="Upload new image"
              >
                <span className="text-2xl text-gray-400 hover:text-primary">+</span>
              </button>
              
              {/* 最近图片缩略图 */}
              {recentImages.map((img, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setOriginalImage(img.url);
                    setProcessedImage(null);
                    setCurrentTaskId(null);
                    setHasError(false);
                    setIsProcessing(false);
                  }}
                  className="w-16 h-16 rounded-xl overflow-hidden ring-2 ring-transparent hover:ring-primary transition-all"
                  aria-label="Select recent image"
                >
                  <img 
                    src={img.url} 
                    alt={`Recent image ${index + 1}`} 
                    className="h-full w-full object-cover" 
                  />
                </button>
              ))}
            </div>

            {/* 始终挂载的隐藏文件输入，用于 + 按钮触发 */}
            <input
              id="image-upload-hidden"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={isProcessing}
            />
          </CardContent>
        </Card>
      )}

      {/* URL 对话框 */}
      <Dialog open={showUrlDialog} onOpenChange={setShowUrlDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Paste image URL</DialogTitle>
          </DialogHeader>
          <div ref={dialogInputWrapperRef} className="flex items-center gap-3">
            <input
              ref={urlInputRef}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              type="url"
              placeholder="https://example.com/image.jpg"
              className="flex-1 h-11 rounded-md border px-3 text-sm bg-background"
              autoFocus
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && urlInput && !isProcessing) {
                  await processImageFromUrl(urlInput);
                  setShowUrlDialog(false);
                }
                if (e.key === 'Escape') setShowUrlDialog(false);
              }}
            />
            <Button
              size="lg"
              className="h-11"
              disabled={!urlInput || isProcessing}
              onClick={async () => { if (urlInput) { await processImageFromUrl(urlInput); setShowUrlDialog(false); } }}
            >
              Start
            </Button>
          </div>
          {urlError && (
            <p className="mt-2 text-xs text-red-600">{urlError}</p>
          )}
          <DialogFooter />
        </DialogContent>
      </Dialog>


      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="text-center">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-primary" />
            <CardTitle className="text-lg">{tPage('aiPowered')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <CardDescription>
              {tPage('aiPoweredDesc')}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-primary" />
            <CardTitle className="text-lg">{tPage('hairLevelPrecision')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <CardDescription>
              {tPage('hairLevelPrecisionDesc')}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-primary" />
            <CardTitle className="text-lg">{tPage('freeTrial')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <CardDescription>
              {tPage('freeTrialDesc')}
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* BiRefNet vs rembg Algorithm Comparison */}
      <Card className="mb-8">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl mb-2">{tPage('birefnetAdvantage')}</CardTitle>
          <CardDescription className="text-lg">
            {tPage('birefnetAdvantageDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h4 className="font-semibold">{tPage('hairLevelPrecision')}</h4>
                  <p className="text-sm text-muted-foreground">{tPage('hairLevelPrecisionDesc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h4 className="font-semibold">{tPage('professionalQuality')}</h4>
                  <p className="text-sm text-muted-foreground">{tPage('professionalQualityDesc')}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h4 className="font-semibold">{tPage('fastProcessing')}</h4>
                  <p className="text-sm text-muted-foreground">{tPage('fastProcessingDesc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h4 className="font-semibold">{tPage('multiScenario')}</h4>
                  <p className="text-sm text-muted-foreground">{tPage('multiScenarioDesc')}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Algorithm Technology Comparison */}
      <Card className="mb-8">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl mb-2">{tPage('algorithmComparison')}</CardTitle>
          <CardDescription className="text-lg">
            {tPage('algorithmComparisonDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* BiRefNet Features */}
            <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-blue-100">
              <h3 className="text-xl font-bold text-blue-800 mb-4 text-center">{tPage('birefnetFeatures')}</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm">Hair-level precision matting</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm">Automatic background detection</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm">Complex edge handling</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm">Professional quality output</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm">High-resolution support</span>
                </div>
              </div>
            </div>
            
            {/* rembg Features */}
            <div className="border rounded-lg p-4 bg-gradient-to-br from-gray-50 to-gray-100">
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">{tPage('rembgFeatures')}</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm">Basic background removal</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm">Fast processing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm">Simple backgrounds</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm">Limited complex edges</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm">Basic quality output</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* No Background Selection Required */}
      <Card className="mb-8 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl mb-2 text-green-800">{tPage('noBackgroundSelection')}</CardTitle>
          <CardDescription className="text-lg text-green-700">
            {tPage('noBackgroundSelectionDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Sparkles className="w-16 h-16 text-green-600" />
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-green-800">{tPage('automaticMatting')}</h4>
              <p className="text-sm text-green-700">{tPage('automaticMattingDesc')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-green-600 font-bold">1</span>
                </div>
                <p className="text-sm font-medium">Upload Image</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-blue-600 font-bold">2</span>
                </div>
                <p className="text-sm font-medium">AI Auto-Detection</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-purple-600 font-bold">3</span>
                </div>
                <p className="text-sm font-medium">Download Result</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 原位置上传区已上移至顶部，删除重复 */}

      {/* 结果/编辑视图：上传后替换首屏 */}
      {hasUpload && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{tPage('processedImage')}</span>
              <Button onClick={handleDownload} size="sm" className="flex items-center gap-2">
                {isAuthenticated ? (<><Download className="w-4 h-4" />{tPage('download')}</>) : (<><LogIn className="w-4 h-4" />{tPage('loginDownload')}</>)}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* 轻量工具栏 - 暂时隐藏，后续补充功能 */}
            {/* <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 p-2 text-sm max-w-[520px] mx-auto">
              <Button variant="ghost" size="sm" className="rounded-full">Cutout</Button>
              <Button variant="ghost" size="sm" className="rounded-full">Background</Button>
              <Button variant="ghost" size="sm" className="rounded-full">Effects</Button>
              <div className="ml-auto flex gap-1">
                <Button variant="ghost" size="sm">↶</Button>
                <Button variant="ghost" size="sm">↷</Button>
              </div>
            </div> */}
            <div
              className="bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center p-2 max-h-[500px] max-w-[500px] mx-auto"
              onDoubleClick={() => {
                // 双击在 Before/After 与单张 After 之间切换：若只有一张则忽略
                if (processedImage && originalImage) {
                  setProcessedImage(prev => prev ? prev : processedImage);
                  // 通过切换一个哨兵状态：若 processed 存在且 slider 显示中，则改为仅 after 图
                  // 简化处理：切换一个本地布尔 via data-attr
                  const el = document.getElementById('ba-toggle');
                  if (el) {
                    const v = el.getAttribute('data-on') === '1' ? '0' : '1';
                    el.setAttribute('data-on', v);
                  }
                }
              }}
            >
              {isProcessing ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">{tPage('removingBackground')}</p>
                  </div>
                </div>
              ) : (
                processedImage && originalImage ? (
                  <div id="ba-toggle" data-on="1" className="w-full h-full flex items-center justify-center">
                    {/* data-on=1 显示 Slider；=0 显示 After 单图 */}
                    {true ? (
                      <BeforeAfterSlider
                        beforeSrc={originalImage}
                        afterSrc={processedImage}
                        beforeLabel="Original"
                        afterLabel="Background removed"
                        className="w-full"
                      />
                    ) : null}
                  </div>
                ) : (
                  <img src={processedImage || originalImage || ''} alt="preview" className="w-full h-full object-contain" />
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhook Handler */}
      {currentTaskId && (
        <WebhookHandler
          taskId={currentTaskId}
          onComplete={(imageUrl) => {
            setProcessedImage(imageUrl);
            setIsProcessing(false);
            setCurrentTaskId(null);
            toast.success(tPage('backgroundRemoved'));
            advanceQueue();
          }}
          onError={(error) => {
            setIsProcessing(false);
            setCurrentTaskId(null);
            toast.error(tPage('processingFailed'));
            advanceQueue();
          }}
        />
      )}

      {/* CTA Section */}
      <Card className="text-center">
        <CardHeader>
          <CardTitle>{tPage('readyToGetStarted')}</CardTitle>
          <CardDescription>
            {tPage('signUpFreeDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => window.location.href = `/${locale}/signin`}
              size="lg"
              className="flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              {tPage('getStartedFree')}
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => window.location.href = `/${locale}/pricing`}
            >
              {tPage('viewPricing')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
