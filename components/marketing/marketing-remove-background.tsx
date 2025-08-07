'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download, LogIn, Sparkles, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MarketingRemoveBackgroundProps {
  locale: string;
}

export default function MarketingRemoveBackground({ locale }: MarketingRemoveBackgroundProps) {
  const t = useTranslations('IndexPage');
  const { data: session, status } = useSession();
  const isAuthenticated = !!session?.user;
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // 验证文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
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

      // 调用API
      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process image');
      }

      const result = await response.json();
      
      if (result.success && result.data?.url) {
        setProcessedImage(result.data.url);
        toast.success('Background removed successfully!');
      } else {
        throw new Error('No processed image received');
      }
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to remove background. Please try again.');
      
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

  const handleDownload = () => {
    if (!isAuthenticated) {
      toast.info('Please sign in to download the processed image');
      window.location.href = '/sign-in';
      return;
    }

    if (!processedImage) {
      toast.error('No processed image to download');
      return;
    }

    // 创建下载链接
    const link = document.createElement('a');
    link.href = processedImage;
    link.download = 'removed-background.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Image downloaded successfully!');
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
          {t('title')}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          {t('description')}
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="text-center">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-primary" />
            <CardTitle className="text-lg">AI Powered</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <CardDescription>
              Advanced AI technology for precise background removal
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-primary" />
            <CardTitle className="text-lg">High Quality</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <CardDescription>
              Maintains image quality while removing backgrounds
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-primary" />
            <CardTitle className="text-lg">Free Trial</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <CardDescription>
              Try our service for free, no credit card required
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Upload Area */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Image
          </CardTitle>
          <CardDescription>
            Upload an image to remove its background. Supports JPG, PNG, and WebP formats up to 5MB.
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
              {isProcessing ? 'Processing...' : 'Choose Image'}
            </label>
            <p className="text-sm text-muted-foreground mt-2">
              Drag and drop or click to upload
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
                <CardTitle>Original Image</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={originalImage}
                    alt="Original"
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
                <span>Processed Image</span>
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
                          Download
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4" />
                          Sign In to Download
                        </>
                      )}
                    </Button>
                    {uploadedFile && (
                      <Button
                        onClick={handleTryAgain}
                        variant="outline"
                        size="sm"
                      >
                        Try Again
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
                      <p className="text-sm text-muted-foreground">Removing background...</p>
                    </div>
                  </div>
                ) : processedImage ? (
                  <img
                    src={processedImage}
                    alt="Processed"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <p>Processing...</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CTA Section */}
      <Card className="text-center">
        <CardHeader>
          <CardTitle>Ready to get started?</CardTitle>
          <CardDescription>
            Sign up for free and start removing backgrounds from your images today!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => window.location.href = '/sign-in'}
              size="lg"
              className="flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => window.location.href = `/${locale}/pricing`}
            >
              View Pricing
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 