'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download, LogIn, Sparkles, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { WebhookHandler } from './webhook-handler';

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
  const [hasError, setHasError] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  
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

    setUploadedFile(file);

    // 显示原始图片
    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // 开始处理
    await processImage(file);
  };

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
      setIsProcessing(false);
    }
  };

  // 轮询任务状态（仅在开发环境中使用）
  const pollTaskStatus = async (taskId: string) => {
    // 在生产环境中，使用webhook模式，不进行轮询
    const isProduction = typeof window !== 'undefined' && 
      (window.location.hostname === 'www.remove-anything.com' || 
       window.location.hostname === 'remove-anything.com' ||
       window.location.hostname === 'vercel.app');
    
    if (isProduction) {
      console.log("🔗 生产环境：使用webhook模式，不进行轮询");
      console.log("📝 任务已创建，ID:", taskId);
      toast.success(tPage('taskCreated'));
      return;
    }

    // 开发环境：使用轮询模式
    const maxAttempts = 60;
    let attempts = 0;
    
    const poll = async (): Promise<void> => {
      try {
        console.log(`🔍 第 ${attempts + 1} 次查询任务状态: ${taskId}`);
        
        const response = await fetch(`/api/task/${taskId}`);
        
        if (!response.ok) {
          throw new Error('Failed to get task status');
        }
        
        const taskStatus = await response.json();
        console.log("任务状态:", taskStatus);
        
        switch (taskStatus.status) {
          case 'starting':
          case 'processing':
            if (attempts < maxAttempts) {
              attempts++;
              console.log(`⏳ 任务处理中，${attempts}/${maxAttempts}，5秒后再次查询...`);
              setTimeout(() => poll(), 5000);
            } else {
              console.log(`⏰ 任务超时，已轮询 ${maxAttempts} 次`);
              throw new Error('Task timeout');
            }
            break;
            
          case 'succeeded':
            console.log('✅ 任务成功完成!');
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
            throw new Error(taskStatus.error || 'Task failed');
            
          default:
            console.log(`⚠️ 未知状态: ${taskStatus.status}`);
            throw new Error(`Unknown task status: ${taskStatus.status}`);
        }
      } catch (error) {
        console.error('Error polling task status:', error);
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
      // 如果有任务ID，使用API下载（支持统计和权限控制）
      if (currentTaskId) {
        const response = await fetch(`/api/download-background?taskId=${currentTaskId}`, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `background-removed-${currentTaskId}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          toast.success(tPage('downloadSuccess'));
          return;
        } else {
          console.warn('API download failed, falling back to direct download');
        }
      }
      
      // 降级方案：直接下载图片URL
      const link = document.createElement('a');
      link.href = processedImage;
      link.download = 'removed-background.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Image downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      // 降级方案：直接下载图片URL
      const link = document.createElement('a');
      link.href = processedImage;
      link.download = 'removed-background.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Image downloaded successfully!');
    }
  };

  const handleTryAgain = () => {
    if (uploadedFile) {
      processImage(uploadedFile);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">
          {title}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          {description}
        </p>
      </div>

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

      {/* Upload Area */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {tPage('uploadImage')}
          </CardTitle>
          <CardDescription>
            {isAuthenticated 
              ? tPage('uploadImageDesc')
              : tPage('demoModeDesc')
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
              disabled={isProcessing}
            />
            <label
              htmlFor="image-upload"
              className={cn(
                "cursor-pointer inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors",
                isProcessing && "opacity-50 cursor-not-allowed"
              )}
            >
              <Upload className="w-4 h-4" />
              {isProcessing ? tPage('processing') : tPage('chooseImage')}
            </label>
            <p className="text-sm text-muted-foreground mt-2">
              {tPage('dragDropText')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {(originalImage || processedImage) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Original Image */}
          {originalImage && (
            <Card>
              <CardHeader>
                <CardTitle>{tPage('originalImage')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={originalImage}
                    alt={tPage('originalImage')}
                    className="w-full h-full object-contain"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processed Image */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{tPage('processedImage')}</span>
                {processedImage && !isProcessing && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDownload}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {isAuthenticated ? (
                        <>
                          <Download className="w-4 h-4" />
                          {tPage('download')}
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4" />
                          {tPage('loginDownload')}
                        </>
                      )}
                    </Button>
                    {uploadedFile && (
                      <Button
                        onClick={handleTryAgain}
                        variant="outline"
                        size="sm"
                      >
                        {tPage('tryAgain')}
                      </Button>
                    )}
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                {isProcessing ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">
                        {isAuthenticated ? tPage('removingBackground') : tPage('demoProcessing')}
                      </p>
                    </div>
                  </div>
                ) : processedImage ? (
                  <img
                    src={processedImage}
                    alt={tPage('processedImage')}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <p>{tPage('processing')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
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
          }}
          onError={(error) => {
            setIsProcessing(false);
            setCurrentTaskId(null);
            toast.error(tPage('processingFailed'));
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