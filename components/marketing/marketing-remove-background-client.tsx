'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Download, LogIn, Sparkles, Share2, Copy } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { WebhookHandler } from './webhook-handler';
import { BeforeAfterSlider } from '@/components/ui/before-after-slider';
import { BackgroundSelector } from '@/components/add-background/background-selector';
import { AdjustmentControls } from '@/components/add-background/adjustment-controls';
import dynamic from 'next/dynamic';
import {
  getBackgroundToolCopy,
  getBackgroundToolDefaultBackground,
  shouldAutoOpenBackgroundPanel,
  type BackgroundToolVariant,
} from '@/lib/background-tool-variants';
import { buildLocalizedPath, buildLocalizedUrl } from '@/lib/seo';
const SocialProofBar = dynamic(() => import('./social-proof-bar'), {
  ssr: false,
  loading: () => <div data-social-proof-placeholder></div>,
});
// 移除不再需要的导入，使用原生Canvas API

interface MarketingRemoveBackgroundProps {
  locale: string;
  variant?: BackgroundToolVariant;
}

export default function MarketingRemoveBackground({
  locale,
  variant = "remove-background",
}: MarketingRemoveBackgroundProps) {
  // 所有hooks必须在组件顶层调用，不能在任何条件语句中
  const tPage = useTranslations('RemoveBackgroundPage');
  const { data: session, status } = useSession();
  const toolCopy = useMemo(() => getBackgroundToolCopy(locale, variant), [locale, variant]);
  const defaultSelectedBackground = useMemo(
    () => getBackgroundToolDefaultBackground(variant),
    [variant],
  );
  
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
  const [showAddBackground, setShowAddBackground] = useState(
    shouldAutoOpenBackgroundPanel(variant),
  );
  const defaultBackgroundType =
    (defaultSelectedBackground?.type as "solid" | "gradient" | "image" | "template" | undefined) ||
    "solid";
  
  // 背景相关状态
  const [backgroundType, setBackgroundType] = useState<"solid" | "gradient" | "image" | "template">(
    defaultBackgroundType,
  );
  const [selectedBackground, setSelectedBackground] = useState<any>(defaultSelectedBackground);
  const [compositionParams, setCompositionParams] = useState({
    position: { x: 0, y: 0 },
    scale: 1,
    rotation: 0,
    blendMode: 'normal' as const
  });
  const [composedImage, setComposedImage] = useState<string | null>(null);
  
  // 移除图片合成逻辑，使用CSS层叠实现预览
  
  // 选择背景后自动生成预览 - 使用CSS层叠，不进行图片合成
  useEffect(() => {
    if (selectedBackground && processedImage) {
      // 不需要合成图片，直接设置预览状态
      setComposedImage(processedImage); // 用于显示预览状态
    }
  }, [selectedBackground, compositionParams, processedImage]);

  useEffect(() => {
    setSelectedBackground(defaultSelectedBackground);
    setBackgroundType(defaultBackgroundType);
    setShowAddBackground(shouldAutoOpenBackgroundPanel(variant));
  }, [defaultBackgroundType, defaultSelectedBackground, variant]);
  

  // 下载合成后的图片
  const handleDownloadComposed = async () => {
    if (!processedImage || !selectedBackground) {
      toast.error(tPage('messages.selectBackgroundFirst'));
      return;
    }
    
    console.log('🎯 开始下载合成图片...');
    console.log('📸 处理后的图片:', processedImage);
    console.log('🎨 选定的背景:', selectedBackground);
    console.log('⚙️ 合成参数:', compositionParams);
    
    try {
      // 使用Canvas API在客户端合成图片
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      
      // 设置画布尺寸
      canvas.width = 1024;
      canvas.height = 1024;
      
      // 绘制背景
      console.log('🎨 开始绘制背景，类型:', selectedBackground.type);
      if (selectedBackground.type === 'solid') {
        const color = selectedBackground.data.color || '#ffffff';
        console.log('🎨 绘制纯色背景:', color);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (selectedBackground.type === 'gradient') {
        const gradient = selectedBackground.data.gradient;
        if (gradient.type === 'radial') {
          const radialGradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 2
          );
          gradient.colors.forEach((color: string, index: number) => {
            radialGradient.addColorStop(index / (gradient.colors.length - 1), color);
          });
          ctx.fillStyle = radialGradient;
        } else {
          const linearGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          gradient.colors.forEach((color: string, index: number) => {
            linearGradient.addColorStop(index / (gradient.colors.length - 1), color);
          });
          ctx.fillStyle = linearGradient;
        }
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        console.log('🎨 渐变背景绘制完成');
      } else if (selectedBackground.type === 'image') {
        // 对于图片背景，需要先加载并绘制背景图片
        console.log('🎨 开始绘制图片背景:', selectedBackground.data.imageUrl);
        
        // 先绘制白色背景作为备用
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 加载背景图片
        const backgroundImg = new Image();
        backgroundImg.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          backgroundImg.onload = () => {
            try {
              console.log('🎨 背景图片加载成功，尺寸:', backgroundImg.width, 'x', backgroundImg.height);
              // 绘制背景图片，填充整个画布
              ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
              console.log('🎨 背景图片绘制完成');
              resolve(void 0);
            } catch (error) {
              console.error('❌ 绘制背景图片失败:', error);
              reject(error);
            }
          };
          backgroundImg.onerror = (error) => {
            console.warn('⚠️ 背景图片加载失败，使用白色背景:', error);
            // 如果背景图片加载失败，继续使用白色背景
            resolve(void 0);
          };
          backgroundImg.src = selectedBackground.data.imageUrl;
        });
      }
      
      // 加载并绘制前景图片 - 使用代理避免CORS问题
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // 如果图片URL是外部链接，尝试通过代理加载
      let imageUrl = processedImage;
      if (processedImage.includes('r2.dev') || 
          processedImage.includes('cloudflare') || 
          processedImage.includes('remove-anything.com') ||
          processedImage.startsWith('http')) {
        // 通过我们的API代理加载图片，避免CORS问题
        imageUrl = `/api/proxy-image?url=${encodeURIComponent(processedImage)}`;
        console.log('🔄 使用代理加载图片:', imageUrl);
      }
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            console.log('📸 前景图片加载成功，尺寸:', img.width, 'x', img.height);
            // 应用变换
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(compositionParams.scale, compositionParams.scale);
            ctx.rotate((compositionParams.rotation * Math.PI) / 180);
            ctx.translate(compositionParams.position.x, compositionParams.position.y);
            
            // 绘制图片
            console.log('📸 绘制前景图片，变换参数:', {
              scale: compositionParams.scale,
              rotation: compositionParams.rotation,
              position: compositionParams.position
            });
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            ctx.restore();
            
            console.log('✅ 图片合成完成');
            resolve(void 0);
          } catch (error) {
            console.error('❌ 绘制前景图片失败:', error);
            reject(error);
          }
        };
        img.onerror = (error) => {
          console.error('图片加载失败:', error);
          // 如果代理失败，尝试直接加载原图
          if (imageUrl !== processedImage) {
            console.log('Try loading original image directly...');
            img.src = processedImage;
          } else {
            reject(error);
          }
        };
        img.src = imageUrl;
      });
      
      // 转换为blob并下载
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'composed-image.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success(tPage('messages.downloadSuccess'));
        } else {
          throw new Error('Failed to create blob');
        }
      }, 'image/png');
      
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(tPage('messages.downloadFailed'));
    }
  };
  
  // 使用useMemo来避免重复计算，添加安全检查
  const isAuthenticated = useMemo(() => {
    try {
      // 在开发环境中，如果session不存在，返回true以跳过登录验证
      if (process.env.NODE_ENV === 'development' && !session?.user) {
        console.log('🔧 开发环境：跳过登录验证');
        return true;
      }
      return !!session?.user;
    } catch (error) {
      console.error('Session error:', error);
      return false;
    }
  }, [session?.user]);

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
        if ((data.status === 'succeeded' || data.status === 'SUCCESS') && data.output) {
          setProcessedImage(data.output);
          toast.success(tPage('foundProcessedImage'));
          
          // 保存到localStorage历史记录
          saveTaskToHistory(taskId, data.output);
        }
      }
    } catch (error) {
      console.error('Error fetching task result:', error);
    }
  };

  // localStorage保存最近5次任务历史
  const saveTaskToHistory = (taskId: string, outputUrl: string) => {
    try {
      const historyKey = 'backgroundRemovalHistory';
      const existing = localStorage.getItem(historyKey);
      const history: Array<{ taskId: string; outputUrl: string; timestamp: number }> = existing 
        ? JSON.parse(existing) 
        : [];
      
      // 移除重复项
      const filtered = history.filter(item => item.taskId !== taskId);
      
      // 添加到开头，只保留最近5次
      const updated = [{ taskId, outputUrl, timestamp: Date.now() }, ...filtered].slice(0, 5);
      
      localStorage.setItem(historyKey, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save task to history:', error);
    }
  };

  // 加载localStorage历史记录
  useEffect(() => {
    const originalImage = uploadedFile || null;
    const processedImageLocal = null; // 在加载时还没有处理结果
    
    if (originalImage || processedImageLocal) return; // 已有上传时不需要加载
    
    try {
      const historyKey = 'backgroundRemovalHistory';
      const existing = localStorage.getItem(historyKey);
      if (existing) {
        const history: Array<{ taskId: string; outputUrl: string; timestamp: number }> = JSON.parse(existing);
        // 可以在UI中显示历史记录提示
        if (history.length > 0) {
          console.log('Found history tasks:', history.length);
        }
      }
    } catch (error) {
      console.error('Failed to load task history:', error);
    }
  }, [uploadedFile]);

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
          
          if ((data.status === 'succeeded' || data.status === 'SUCCESS') && data.output) {
            console.log("✅ 任务完成，输出:", data.output);
            setProcessedImage(data.output);
            setIsProcessing(false);
            toast.success(tPage('backgroundRemoved'));
            
            // 保存到localStorage历史记录
            if (taskId) {
              saveTaskToHistory(taskId, data.output);
            }
            
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
          case 'RUNNING':
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
          case 'SUCCESS':
            console.log('✅ 任务成功完成!');
            isPollingStopped = true;
            if (pollTimeout) {
              clearTimeout(pollTimeout);
              pollTimeout = null;
            }
            if (taskStatus.output) {
              setProcessedImage(taskStatus.output);
              toast.success(tPage('backgroundRemoved'));
              
              // 保存到localStorage历史记录
              if (taskId) {
                saveTaskToHistory(taskId, taskStatus.output);
              }
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
    // 在开发环境中跳过登录验证
    if (!isAuthenticated && process.env.NODE_ENV !== 'development') {
      toast.info(tPage('loginToDownload'));
      // 保存当前任务ID到sessionStorage，登录后可以继续下载
      if (currentTaskId) {
        sessionStorage.setItem('pendingDownloadTaskId', currentTaskId);
      }
      window.location.href = buildLocalizedPath(locale, "/signin");
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
        console.log(`🔍 开始API下载: ${currentTaskId}`);
        const response = await fetch(`/api/download-background?taskId=${currentTaskId}`, {
          credentials: 'include',
        });
        
        console.log(`📡 API下载响应: ${response.status} ${response.statusText}`);
        
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
              // iOS：使用 a[download] 直接下载
              const link = document.createElement("a");
              link.href = url;
              link.download = fileName;
              link.style.display = "none";
              document.body.appendChild(link);
              setTimeout(() => link.click(), 50);
              setTimeout(() => document.body.removeChild(link), 200);
              toast.info("图片已开始下载，请检查下载文件夹", { duration: 4000 });
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
            console.log(`💾 PC端下载: ${fileName}`);
            
            // 尝试多种下载方式
            try {
              // 方式1：创建下载链接
              const link = document.createElement("a");
              link.href = url;
              link.download = fileName;
              link.style.display = "none";
              document.body.appendChild(link);
              
              // 立即触发点击
              link.click();
              console.log(`🖱️ 触发下载点击`);
              
              // 清理
              setTimeout(() => {
                if (document.body.contains(link)) {
                  document.body.removeChild(link);
                }
              }, 100);
              
              toast.success("图片已开始下载");
            } catch (downloadError) {
              console.error("Download failed, trying fallback:", downloadError);
              
              // 备用方案：尝试直接下载
              try {
                const link = document.createElement("a");
                link.href = url;
                link.download = fileName;
                link.style.display = "none";
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                  if (document.body.contains(link)) {
                    document.body.removeChild(link);
                  }
                }, 100);
                toast.success("图片已开始下载");
              } catch (fallbackError) {
                console.error("Fallback download also failed:", fallbackError);
                toast.error("Download failed. Please check your browser settings");
              }
            }
          }
          
          // 延迟释放 URL 对象
          setTimeout(() => window.URL.revokeObjectURL(url), 1000);
          return;
        } else {
          console.warn(`❌ API download failed: ${response.status} ${response.statusText}, falling back to direct download`);
          const errorText = await response.text();
          console.warn(`Error details: ${errorText}`);
        }
      }
      
      // 降级方案：直接下载图片URL
      const fileName = 'removed-background.png';
      
      if (isMobile) {
        // 移动端降级方案 - 统一使用直接下载
        try {
          const link = document.createElement("a");
          link.href = processedImage;
          link.download = fileName;
          link.style.display = "none";
          document.body.appendChild(link);
          
          // 立即触发点击
          link.click();
          console.log(`🖱️ 触发移动端降级下载点击`);
          
          // 清理
          setTimeout(() => {
            if (document.body.contains(link)) {
              document.body.removeChild(link);
            }
          }, 100);
          
          if (isIOS) {
            toast.info("图片已开始下载，请检查下载文件夹", { duration: 4000 });
          } else if (isAndroid) {
            toast.info("图片已保存到下载目录，图库会自动扫描导入", { duration: 4000 });
          } else {
            toast.success("图片已开始下载");
          }
        } catch (downloadError) {
          console.error("Mobile fallback download failed:", downloadError);
          toast.error("Download failed. Please check browser settings or refresh and try again");
        }
      } else {
        // PC端降级方案
        console.log(`🔄 PC端降级下载: ${processedImage}`);
        
        try {
          const link = document.createElement("a");
          link.href = processedImage;
          link.download = fileName;
          link.style.display = "none";
          document.body.appendChild(link);
          
          // 立即触发点击
          link.click();
          console.log(`🖱️ 触发降级下载点击`);
          
          // 清理
          setTimeout(() => {
            if (document.body.contains(link)) {
              document.body.removeChild(link);
            }
          }, 100);
          
          toast.success("图片已开始下载");
        } catch (downloadError) {
          console.error("Desktop fallback download failed:", downloadError);
          toast.error("Download failed. Please check browser settings or refresh and try again");
        }
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed. Please try again');
    }
  };

  const handleTryAgain = () => {
    if (uploadedFile) {
      processImage(uploadedFile);
    }
  };

  // 分享功能：生成带UTM与SSR可抓取的OG参数
  const handleShare = async () => {
    if (!processedImage) {
      toast.error('No shareable result');
      return;
    }

    try {
      // 根据系统主题设置OG渲染模式
      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const mode = isDark ? 'dark' : 'light';

      // 生成分享URL：包含 before/after，便于社交爬虫在SSR阶段生成OG卡片
      const params = new URLSearchParams();
      if (currentTaskId) params.set('task', currentTaskId);
      params.set('ref', isAuthenticated ? 'user' : 'guest');
      if (originalImage) params.set('before', originalImage);
      params.set('after', processedImage);
      if (currentTaskId) params.set('id', currentTaskId);
      params.set('mode', mode);

      const shareUrl = `${buildLocalizedUrl(locale, toolCopy.path)}?${params.toString()}`;
      
      // 分享文案
      const shareText = `🎨 AI background removed in seconds — free.\n${shareUrl}`;

      // 尝试使用Web Share API
      if (navigator.share && typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: 'AI Background Removal – Remove Anything',
            text: shareText,
            url: shareUrl,
          });
          toast.success('Shared! You may get 2 extra free uses');
          
          // TODO: 记录分享事件到后端，给予奖励
        } catch (err) {
          // 用户取消分享或分享失败，降级到复制链接
          handleCopyShareLink(shareUrl, shareText);
        }
      } else {
        // 降级：复制链接到剪贴板
        handleCopyShareLink(shareUrl, shareText);
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Share failed. Please try again');
    }
  };

  function openCenteredPopup(url: string, name: string, w = 640, h = 640) {
    const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : (window as any).screenX;
    const dualScreenTop = window.screenTop !== undefined ? window.screenTop : (window as any).screenY;
    const width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth;
    const height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight;
    const left = (width - w) / 2 + dualScreenLeft;
    const top = (height - h) / 2 + dualScreenTop;
    const features = `scrollbars=yes, width=${w}, height=${h}, top=${top}, left=${left}`;
    window.open(url, name, features);
  }

  function buildPlatformShareUrl(platform: string, url: string, text: string) {
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(text);
    switch (platform) {
      case 'twitter':
        return `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
      case 'reddit':
        return `https://www.reddit.com/submit?url=${u}&title=${t}`;
      case 'whatsapp':
        return `https://api.whatsapp.com/send?text=${t}%20${u}`;
      case 'telegram':
        return `https://t.me/share/url?url=${u}&text=${t}`;
      default:
        return url;
    }
  }

  const handleShareVia = async (platform: 'twitter'|'facebook'|'linkedin'|'reddit'|'whatsapp'|'telegram'|'instagram') => {
    if (!processedImage) {
      toast.error('No shareable result');
      return;
    }
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = isDark ? 'dark' : 'light';
    const params = new URLSearchParams();
    if (currentTaskId) params.set('task', currentTaskId);
    params.set('ref', isAuthenticated ? 'user' : 'guest');
    if (originalImage) params.set('before', originalImage);
    params.set('after', processedImage);
    if (currentTaskId) params.set('id', currentTaskId);
    params.set('mode', mode);
    const shareUrl = `${buildLocalizedUrl(locale, toolCopy.path)}?${params.toString()}`;
    const shareText = `AI background removed in seconds — free.`;

    if (platform === 'instagram') {
      // Instagram web 不提供标准的链接分享入口，降级为复制链接
      await handleCopyShareLink(shareUrl, `${shareText}\n${shareUrl}`);
      return;
    }
    const url = buildPlatformShareUrl(platform, shareUrl, shareText);
    openCenteredPopup(url, `share-${platform}`);
  };

  // 复制分享链接
  const handleCopyShareLink = async (url: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Link copied! Share to get 2 more free uses');
    } catch (error) {
      // 降级：使用传统方法
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        toast.success('Link copied! Share to get 2 more free uses');
      } catch (err) {
        toast.error('Copy failed. Please copy manually');
      }
      document.body.removeChild(textarea);
    }
  };


  const hasUpload = !!(originalImage || processedImage);

  // 动态更新页面title和meta标签（当有结果时）
  useEffect(() => {
    if (processedImage && currentTaskId) {
      // 更新title
      const title = locale === 'zh' || locale === 'tw'
        ? `移除完成！前后对比 #${currentTaskId.slice(-4)} | Remove Anything`
        : `Removed! Before & After #${currentTaskId.slice(-4)} | Remove Anything`;
      document.title = title;

      // 更新meta description
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }
      metaDescription.setAttribute('content', 
        locale === 'zh' || locale === 'tw'
          ? `AI成功移除图片背景！查看前后对比效果 #${currentTaskId.slice(-4)}`
          : `AI successfully removed background! See before & after comparison #${currentTaskId.slice(-4)}`
      );

      // 更新og:title
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (!ogTitle) {
        ogTitle = document.createElement('meta');
        ogTitle.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitle);
      }
      ogTitle.setAttribute('content', title);

      // 更新og:description
      let ogDescription = document.querySelector('meta[property="og:description"]');
      if (!ogDescription) {
        ogDescription = document.createElement('meta');
        ogDescription.setAttribute('property', 'og:description');
        document.head.appendChild(ogDescription);
      }
      ogDescription.setAttribute('content', 
        locale === 'zh' || locale === 'tw'
          ? `AI成功移除图片背景！查看前后对比效果 #${currentTaskId.slice(-4)}`
          : `AI successfully removed background! See before & after comparison #${currentTaskId.slice(-4)}`
      );

      // 更新og:image（如果有before和after图片）
      if (originalImage && processedImage) {
        let ogImage = document.querySelector('meta[property="og:image"]');
        if (!ogImage) {
          ogImage = document.createElement('meta');
          ogImage.setAttribute('property', 'og:image');
          document.head.appendChild(ogImage);
        }
        // 生成动态og图片URL
        const ogImageUrl = `${window.location.origin}/api/og?before=${encodeURIComponent(originalImage)}&after=${encodeURIComponent(processedImage)}&id=${currentTaskId}&type=before-after`;
        ogImage.setAttribute('content', ogImageUrl);
      }

      // 更新og:url
      let ogUrl = document.querySelector('meta[property="og:url"]');
      if (!ogUrl) {
        ogUrl = document.createElement('meta');
        ogUrl.setAttribute('property', 'og:url');
        document.head.appendChild(ogUrl);
      }
      ogUrl.setAttribute('content', `${window.location.origin}${window.location.pathname}?task=${currentTaskId}`);

      // 添加结构化数据 BeforeAndAfterGallery
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "ImageGallery",
        "name": `AI Background Removal Result #${currentTaskId.slice(-4)}`,
        "description": "Before and after comparison of AI background removal",
        "image": [
          {
            "@type": "ImageObject",
            "contentUrl": originalImage || '',
            "caption": "Original image before AI background removal",
            "name": "Before"
          },
          {
            "@type": "ImageObject",
            "contentUrl": processedImage,
            "caption": "Processed image after AI background removal",
            "name": "After"
          }
        ]
      };

      // 移除旧的structured data script
      const oldScript = document.getElementById('before-after-structured-data');
      if (oldScript) {
        oldScript.remove();
      }

      // 添加新的structured data
      const script = document.createElement('script');
      script.id = 'before-after-structured-data';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    // 清理函数
    return () => {
      const script = document.getElementById('before-after-structured-data');
      if (script) {
        script.remove();
      }
    };
  }, [processedImage, currentTaskId, originalImage, locale]);

  return (
    <>
      {/* 社交证明动态条：今日已移除物体数 */}
      <div suppressHydrationWarning>
        <SocialProofBar />
      </div>
      
      {/* 主上传区域 - 未上传时显示 */}
      {!hasUpload && (
      <div className="text-center mb-10">
        <div className="mb-4">
          <Badge variant="secondary" className="rounded-full px-4 py-1 text-xs font-medium">
            {toolCopy.heroLabel}
          </Badge>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
          {toolCopy.heroTitle}
        </h1>
        <p className="mx-auto mb-6 max-w-3xl text-base text-muted-foreground md:text-lg">
          {toolCopy.heroDescription}
        </p>
        <div className="mb-6">
          {/* Removed redundant hero CTA button */}
        </div>
        
        {/* 上传区域 */}
        <div
          id="upload"
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
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              document.getElementById('image-upload-main')?.click();
            }
          }}
        >
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && file.size > 10 * 1024 * 1024) {
                toast.error('File too large (>10MB). Please compress and try again');
                e.currentTarget.value = '';
                return;
              }
              handleImageUpload(e);
            }}
            className="hidden"
            id="image-upload-main"
            disabled={isProcessing}
          />
          <label
            htmlFor="image-upload-main"
            className={cn(
              "cursor-pointer inline-flex items-center gap-2 px-8 py-4 rounded-lg transition-all text-lg font-semibold shadow-lg",
              // 优化按钮颜色：使用#FF4F5E高对比度，符合WCAG 3:1
              "bg-[#FF4F5E] text-white hover:bg-[#FF3D4E] hover:shadow-xl",
              // 添加pulse动画，吸引注意力
              "animate-[pulse_2s_ease-in-out_infinite] hover:animate-none",
              isProcessing && "opacity-50 cursor-not-allowed animate-none"
            )}
          >
            <Upload className="size-5" />
            {isProcessing ? tPage('processing') : (
              <span className="relative">
                {/* A/B测试文案：显示更紧迫的文案 */}
                <span className="block">{toolCopy.uploadPrimaryText}</span>
                <span className="absolute -bottom-5 inset-x-0 text-xs font-normal opacity-70 whitespace-nowrap">
                  {toolCopy.uploadSecondaryText}
                </span>
              </span>
            )}
          </label>
          <p className="text-sm text-muted-foreground mt-3">
            or drag and drop your image here
          </p>
          {/* 优化URL输入框：更突出显示 */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">or</span>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowUrlDialog(true)}
              className="border-primary text-primary hover:bg-primary hover:text-white"
            >
              <span>📎 Paste image URL</span>
            </Button>
            <span className="text-xs text-muted-foreground">Supports Instagram public images</span>
          </div>
          
          {/* 优化示例图片：更突出的展示 */}
          <div className="mt-8">
            <p className="text-sm font-medium text-muted-foreground mb-4">
              🎯 Quick demo – click a sample to try instantly
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {[
                { url: 'https://s.remove-anything.com/sample/1.png', label: 'Portrait' },
                { url: 'https://s.remove-anything.com/sample/2.png', label: 'Product' },
                { url: 'https://s.remove-anything.com/sample/3.png', label: 'Object' },
                { url: 'https://s.remove-anything.com/sample/4.png', label: 'Animal' },
              ].map((sample, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={async () => {
                    try {
                      // 先即时显示原图，确保Processed Image card先出现，且对比滑块有beforeSrc
                      setOriginalImage(sample.url);
                      setProcessedImage(null);
                      setHasError(false);
                      setCurrentTaskId(null);
                      setIsProcessing(true);
                      // 记录到最近图片
                      setRecentImages(prev => {
                        const next = [{ url: sample.url, timestamp: Date.now() }, ...prev.filter(img => img.url !== sample.url)];
                        return next.slice(0, 4);
                      });

                      // 通过服务端创建任务，避免浏览器CORS
                      await processImageByUrl(sample.url);
                    } catch (e) {
                      console.error('Sample load error', e);
                    }
                  }}
                  className="group relative h-20 w-20 rounded-xl overflow-hidden ring-2 ring-border hover:ring-[#FF4F5E] hover:scale-110 transition-all duration-300 shadow-md hover:shadow-lg"
                  aria-label={`Try ${sample.label} sample`}
                >
                  <img 
                    src={sample.url} 
                    alt={`AI background removal ${sample.label} sample - click to try this example`} 
                    className="h-full w-full object-cover group-hover:brightness-110 transition-all duration-300"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-1">
                    <span className="text-white text-xs font-medium">{sample.label}</span>
                  </div>
                  <div className="absolute top-1 right-1 bg-[#FF4F5E] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    Try
                  </div>
                </button>
              ))}
            </div>
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
              <span>{toolCopy.resultTitle}</span>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => setShowAddBackground(true)}
                  size="sm" 
                  className="flex items-center gap-2"
                >
                  <Sparkles className="size-4" />
                  {toolCopy.addBackgroundLabel}
                </Button>
                {/* 分享按钮：激励用户分享 */}
                {processedImage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 border-[#FF4F5E] text-[#FF4F5E] hover:bg-[#FF4F5E] hover:text-white"
                      >
                        <Share2 className="size-4" />
                        Share to get 2 more free uses
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-52">
                      <DropdownMenuItem onClick={() => handleShare()}>
                        Native Share (Device)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShareVia('twitter')}>
                        Share to Twitter / X
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShareVia('facebook')}>
                        Share to Facebook
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShareVia('linkedin')}>
                        Share to LinkedIn
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShareVia('reddit')}>
                        Share to Reddit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShareVia('whatsapp')}>
                        Share to WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShareVia('telegram')}>
                        Share to Telegram
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShareVia('instagram')}>
                        Share to Instagram (copy link)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {processedImage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => {
                      try {
                        const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                        const mode = isDark ? 'dark' : 'light';
                        const params = new URLSearchParams();
                        if (originalImage) params.set('before', originalImage);
                        params.set('after', processedImage);
                        if (currentTaskId) params.set('id', currentTaskId);
                        params.set('mode', mode);
                        const shareUrl = `${buildLocalizedUrl(locale, toolCopy.path)}?${params.toString()}`;
                        navigator.clipboard.writeText(shareUrl);
                        toast.success('Share link copied');
                      } catch {
                        toast.error('Copy failed, please try again');
                      }
                    }}
                  >
                    <Copy className="size-4" />
                    Copy share link
                  </Button>
                )}
                <Button 
                  onClick={selectedBackground ? handleDownloadComposed : handleDownload} 
                  size="sm" 
                  className="flex items-center gap-2 bg-[#FF4F5E] hover:bg-[#FF3D4E] text-white"
                >
                  {isAuthenticated ? (<><Download className="size-4" />{tPage('download')}</>) : (<><LogIn className="size-4" />{tPage('loginDownload')}</>)}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-hidden">
              {/* 遮罩层 - 只覆盖背景选择器区域，不覆盖图片区域 */}
              {showAddBackground && (
                <div 
                  className="absolute top-0 right-0 w-80 h-full bg-black/10 z-10 transition-opacity duration-300"
                  onClick={() => setShowAddBackground(false)}
                />
              )}
              
              {/* 图片展示区域 - 支持左滑动效 */}
                <div 
                className={`transition-all duration-700 ease-out ${
                  showAddBackground ? '-translate-x-80' : 'translate-x-0'
                }`}
                style={{
                  willChange: 'transform'
                }}
              >
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
                    alt="AI background removal in progress - processing your image"
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
                  afterLabel={selectedBackground ? toolCopy.afterLabelDefault : toolCopy.afterLabelDefault}
                  showLabels={true}
                  afterOverlay={selectedBackground ? (
                    <div 
                      className="absolute inset-0 w-full h-full"
                      style={{
                        background: selectedBackground.type === 'solid' 
                          ? selectedBackground.data.color
                          : selectedBackground.type === 'gradient'
                          ? selectedBackground.data.gradient.type === 'radial'
                            ? `radial-gradient(circle, ${selectedBackground.data.gradient.colors.join(', ')})`
                            : `linear-gradient(${selectedBackground.data.gradient.direction || 45}deg, ${selectedBackground.data.gradient.colors.join(', ')})`
                          : selectedBackground.type === 'image'
                          ? `url(${selectedBackground.data.imageUrl})`
                          : '#ffffff',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat'
                      }}
                    />
                  ) : undefined}
                  afterTransform={selectedBackground ? {
                    transform: `scale(${compositionParams.scale}) translate(${compositionParams.position.x}px, ${compositionParams.position.y}px) rotate(${compositionParams.rotation}deg)`,
                    transformOrigin: 'center',
                    zIndex: 2
                  } : undefined}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <img
                      src={originalImage || ''}
                      alt="Original image before AI background removal processing"
                      className="max-w-full max-h-full object-contain rounded"
                      loading="lazy"
                      decoding="async"
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
                    alt={`Recent AI background removal result ${index + 1} - processed image`} 
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
              </div>
              
              {/* 背景选择器 - 从右侧渐入动画 */}
              {processedImage && (
                <div
                  className={`absolute top-0 right-0 w-80 h-full bg-background/95 backdrop-blur-sm border-l shadow-lg transition-all duration-700 ease-out z-20 ${
                    showAddBackground
                      ? 'opacity-100 transform translate-x-0'
                      : 'opacity-0 transform translate-x-full pointer-events-none'
                  }`}
                  style={{
                    willChange: 'transform, opacity'
                  }}
                >
                  <div className="p-4 h-full overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold">{tPage('backgroundSelector.title')}</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAddBackground(false)}
                        className="h-8 w-8 p-0"
                      >
                        ×
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      <BackgroundSelector 
                        type={backgroundType}
                        onTypeChange={(type: string) => setBackgroundType(type as "image" | "gradient" | "solid" | "template")}
                        selected={selectedBackground}
                        onSelect={setSelectedBackground}
                      />
                      
                      {selectedBackground && (
                        <AdjustmentControls 
                          params={compositionParams}
                          onChange={setCompositionParams}
                        />
                      )}
                      
                      {selectedBackground && (
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground mb-2">
                            💡 {tPage('messages.backgroundSelected')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
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
    </>
  );
}
