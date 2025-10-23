'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Download, 
  Plus, 
  RotateCcw, 
  RotateCw, 
  Move, 
  ZoomIn, 
  Palette,
  Image as ImageIcon,
  Sparkles,
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageComposer, BackgroundData, CompositionParams } from '@/lib/image-composer';
import { ClientImageDownloader } from '@/lib/client-download';
import { toast } from 'sonner';

interface LayoutWithBackgroundSelectorProps {
  foregroundImageUrl: string;
  onResult: (resultUrl: string) => void;
  onClose: () => void;
}

export function LayoutWithBackgroundSelector({ 
  foregroundImageUrl, 
  onResult, 
  onClose 
}: LayoutWithBackgroundSelectorProps) {
  const [backgroundType, setBackgroundType] = useState<'solid' | 'gradient' | 'image' | 'template'>('solid');
  const [selectedBackground, setSelectedBackground] = useState<BackgroundData | null>(null);
  const [composition, setComposition] = useState<CompositionParams>({
    position: { x: 0, y: 0 },
    scale: 1,
    rotation: 0,
    blendMode: 'normal'
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  
  const composerRef = useRef<ImageComposer>();
  const downloaderRef = useRef<ClientImageDownloader>();
  
  // 初始化
  useEffect(() => {
    composerRef.current = new ImageComposer(1024, 1024);
    downloaderRef.current = new ClientImageDownloader();
  }, []);
  
  // 实时预览
  useEffect(() => {
    if (composerRef.current && selectedBackground) {
      updatePreview();
    }
  }, [selectedBackground, composition]);
  
  const updatePreview = async () => {
    if (!composerRef.current || !selectedBackground) return;
    
    try {
      const result = await composerRef.current.composeImages({
        foreground: foregroundImageUrl,
        background: selectedBackground,
        composition
      });
      setPreviewUrl(result);
    } catch (error) {
      console.error('Preview update failed:', error);
    }
  };
  
  const handleAddBackground = async () => {
    if (!composerRef.current || !selectedBackground) return;
    
    setIsProcessing(true);
    setProcessingProgress(0);
    
    try {
      // 显示处理进度
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => Math.min(prev + 10, 90));
      }, 100);
      
      const result = await composerRef.current.composeImages({
        foreground: foregroundImageUrl,
        background: selectedBackground,
        composition
      });
      
      clearInterval(progressInterval);
      setProcessingProgress(100);
      
      setResultImage(result);
      onResult?.(result);
      
      toast.success('背景添加成功！');
    } catch (error) {
      console.error('Background composition failed:', error);
      toast.error('处理失败，请重试');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };
  
  const handleDownload = async () => {
    if (!resultImage || !downloaderRef.current) return;
    
    try {
      await downloaderRef.current.downloadImage(resultImage, 'composed-image.png');
      toast.success('图片下载成功！');
    } catch (error) {
      toast.error('下载失败，请重试');
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* 菜单栏 */}
      <MenuBar />
      
      {/* 主内容区域 */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* 左侧：图片展示区域 */}
        <div className="flex-1 flex flex-col">
          <ImageDisplayArea 
            foregroundImage={foregroundImageUrl}
            background={selectedBackground}
            composition={composition}
            previewUrl={previewUrl}
            resultImage={resultImage}
          />
          
          {/* 操作按钮 */}
          <div className="mt-4 flex gap-3">
            <Button 
              onClick={handleAddBackground}
              disabled={isProcessing || !selectedBackground}
              className="flex-1"
            >
              <Plus className="mr-2 h-4 w-4" />
              {isProcessing ? '处理中...' : '添加背景'}
            </Button>
            {resultImage && (
              <Button onClick={handleDownload} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                下载
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
          </div>
        </div>
        
        {/* 右侧：背景选择区域 */}
        <div className="w-80 flex flex-col gap-4">
          <BackgroundSelector 
            type={backgroundType}
            onTypeChange={(type: string) => setBackgroundType(type as "image" | "gradient" | "solid" | "template")}
            selected={selectedBackground}
            onSelect={setSelectedBackground}
          />
          
          <AdjustmentControls 
            composition={composition}
            onCompositionChange={setComposition}
          />
        </div>
      </div>
      
      {/* 处理进度 */}
      {isProcessing && (
        <div className="border-t bg-background/95 backdrop-blur">
          <div className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>处理中...</span>
                <span>{processingProgress}%</span>
              </div>
              <Progress value={processingProgress} className="w-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 菜单栏组件
function MenuBar() {
  const [activeTab, setActiveTab] = useState('add-background');
  
  const menuItems = [
    { id: 'remove-background', label: '去背景', icon: '🎯' },
    { id: 'add-background', label: '添加背景', icon: '🎨' },
    { id: 'batch-process', label: '批量处理', icon: '📦' },
    { id: 'history', label: '历史记录', icon: '📚' },
    { id: 'settings', label: '设置', icon: '⚙️' },
    { id: 'help', label: '帮助', icon: '❓' }
  ];
  
  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(item.id)}
              className="flex items-center gap-2"
            >
              <span>{item.icon}</span>
              {item.label}
            </Button>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary">AI 背景处理</Badge>
        </div>
      </div>
    </div>
  );
}

// 图片展示区域
function ImageDisplayArea({ 
  foregroundImage, 
  background, 
  composition, 
  previewUrl,
  resultImage
}: {
  foregroundImage: string;
  background: BackgroundData | null;
  composition: CompositionParams;
  previewUrl: string | null;
  resultImage: string | null;
}) {
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-lg">预览效果</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center p-6">
        <div className="relative w-full max-w-lg aspect-square">
          {resultImage ? (
            <img 
              src={resultImage} 
              alt="合成结果"
              className="w-full h-full object-contain rounded-lg border shadow-lg"
            />
          ) : previewUrl ? (
            <img 
              src={previewUrl} 
              alt="合成预览"
              className="w-full h-full object-contain rounded-lg border shadow-lg"
            />
          ) : (
            <div className="w-full h-full border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>选择背景后显示预览</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// 背景选择器组件
function BackgroundSelector({ 
  type, 
  onTypeChange, 
  selected, 
  onSelect 
}: {
  type: string;
  onTypeChange: (type: string) => void;
  selected: BackgroundData | null;
  onSelect: (background: BackgroundData) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">选择背景</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={type} onValueChange={onTypeChange}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="solid" className="flex items-center gap-1">
              <Palette className="w-4 h-4" />
              纯色
            </TabsTrigger>
            <TabsTrigger value="gradient" className="flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              渐变
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-1">
              <ImageIcon className="w-4 h-4" />
              图片
            </TabsTrigger>
            <TabsTrigger value="template" className="flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              模板
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="solid" className="mt-4">
            <SolidColorGrid onSelect={onSelect} selected={selected} />
          </TabsContent>
          
          <TabsContent value="gradient" className="mt-4">
            <GradientGrid onSelect={onSelect} selected={selected} />
          </TabsContent>
          
          <TabsContent value="image" className="mt-4">
            <ImageUpload onSelect={onSelect} selected={selected} />
          </TabsContent>
          
          <TabsContent value="template" className="mt-4">
            <TemplateGrid onSelect={onSelect} selected={selected} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// 纯色背景网格
function SolidColorGrid({ onSelect, selected }: { onSelect: (background: BackgroundData) => void; selected: BackgroundData | null }) {
  const colors = [
    '#FFFFFF', '#F8F9FA', '#E9ECEF', '#DEE2E6', '#CED4DA', '#ADB5BD',
    '#6C757D', '#495057', '#343A40', '#212529', '#000000', '#FF6B6B',
    '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A'
  ];
  
  return (
    <div className="grid grid-cols-6 gap-2">
      {colors.map((color) => (
        <button
          key={color}
          onClick={() => onSelect({ type: 'solid', data: { color } })}
          className={cn(
            "w-8 h-8 rounded border-2 transition-all hover:scale-110",
            selected?.data?.color === color 
              ? "border-primary ring-2 ring-primary/20" 
              : "border-border hover:border-primary/50"
          )}
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  );
}

// 渐变背景网格
function GradientGrid({ onSelect, selected }: { onSelect: (background: BackgroundData) => void; selected: BackgroundData | null }) {
  const gradients = [
    { type: 'linear' as const, colors: ['#ff6b6b', '#4ecdc4'], direction: 45 },
    { type: 'linear' as const, colors: ['#a8edea', '#fed6e3'], direction: 45 },
    { type: 'linear' as const, colors: ['#ffecd2', '#fcb69f'], direction: 45 },
    { type: 'linear' as const, colors: ['#667eea', '#764ba2'], direction: 45 },
    { type: 'linear' as const, colors: ['#f093fb', '#f5576c'], direction: 45 },
    { type: 'linear' as const, colors: ['#4facfe', '#00f2fe'], direction: 45 },
    { type: 'linear' as const, colors: ['#43e97b', '#38f9d7'], direction: 45 },
    { type: 'linear' as const, colors: ['#fa709a', '#fee140'], direction: 45 },
    { type: 'radial' as const, colors: ['#a8c0ff', '#3f2b96'] },
    { type: 'radial' as const, colors: ['#ff9a9e', '#fecfef'] },
    { type: 'radial' as const, colors: ['#ffecd2', '#fcb69f'] },
    { type: 'radial' as const, colors: ['#ff8a80', '#ea6100'] }
  ];
  
  return (
    <div className="grid grid-cols-3 gap-2">
      {gradients.map((gradient, index) => (
        <button
          key={index}
          onClick={() => onSelect({ type: 'gradient', data: { gradient } })}
          className={cn(
            "w-16 h-12 rounded border-2 transition-all hover:scale-105",
            JSON.stringify(selected?.data?.gradient) === JSON.stringify(gradient)
              ? "border-primary ring-2 ring-primary/20" 
              : "border-border hover:border-primary/50"
          )}
          style={{ 
            background: gradient.type === 'linear' 
              ? `linear-gradient(${gradient.direction || 45}deg, ${gradient.colors.join(', ')})`
              : `radial-gradient(circle, ${gradient.colors.join(', ')})`
          }}
        />
      ))}
    </div>
  );
}

// 图片上传组件
function ImageUpload({ onSelect, selected }: { onSelect: (background: BackgroundData) => void; selected: BackgroundData | null }) {
  const [isUploading, setIsUploading] = useState(false);
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        onSelect({ type: 'image', data: { imageUrl } });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File upload failed:', error);
      setIsUploading(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">上传背景图片</p>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={isUploading}
          className="hidden"
          id="background-upload"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.getElementById('background-upload')?.click()}
          disabled={isUploading}
        >
          {isUploading ? '上传中...' : '选择文件'}
        </Button>
      </div>
      
      {selected?.type === 'image' && selected.data.imageUrl && (
        <div className="relative">
          <img 
            src={selected.data.imageUrl} 
            alt="上传的背景"
            className="w-full h-24 object-cover rounded border"
          />
        </div>
      )}
    </div>
  );
}

// 模板背景网格
function TemplateGrid({ onSelect, selected }: { onSelect: (background: BackgroundData) => void; selected: BackgroundData | null }) {
  const templates = [
    { id: 'office', name: '办公室', url: '/templates/office.jpg' },
    { id: 'nature', name: '自然', url: '/templates/nature.jpg' },
    { id: 'abstract', name: '抽象', url: '/templates/abstract.jpg' },
    { id: 'studio', name: '摄影棚', url: '/templates/studio.jpg' },
    { id: 'beach', name: '海滩', url: '/templates/beach.jpg' },
    { id: 'city', name: '城市', url: '/templates/city.jpg' }
  ];
  
  return (
    <div className="grid grid-cols-2 gap-2">
      {templates.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelect({ type: 'template', data: { templateId: template.id, imageUrl: template.url } })}
          className={cn(
            "relative w-full h-16 rounded border-2 transition-all hover:scale-105 overflow-hidden",
            selected?.data?.templateId === template.id
              ? "border-primary ring-2 ring-primary/20" 
              : "border-border hover:border-primary/50"
          )}
        >
          <div 
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url(${template.url})` }}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
            {template.name}
          </div>
        </button>
      ))}
    </div>
  );
}

// 调整控制组件
function AdjustmentControls({ 
  composition, 
  onCompositionChange 
}: {
  composition: CompositionParams;
  onCompositionChange: (composition: CompositionParams) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Move className="w-5 h-5" />
          调整设置
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 大小调整 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ZoomIn className="w-4 h-4" />
            <span className="text-sm font-medium">大小</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {Math.round(composition.scale * 100)}%
            </span>
          </div>
          <Slider
            value={[composition.scale]}
            onValueChange={([value]) => onCompositionChange({ ...composition, scale: value })}
            min={0.1}
            max={3}
            step={0.1}
            className="w-full"
          />
        </div>
        
        {/* 位置调整 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Move className="w-4 h-4" />
            <span className="text-sm font-medium">位置 X</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {composition.position.x}px
            </span>
          </div>
          <Slider
            value={[composition.position.x]}
            onValueChange={([value]) => onCompositionChange({ 
              ...composition, 
              position: { ...composition.position, x: value }
            })}
            min={-200}
            max={200}
            step={1}
            className="w-full"
          />
        </div>
        
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Move className="w-4 h-4" />
            <span className="text-sm font-medium">位置 Y</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {composition.position.y}px
            </span>
          </div>
          <Slider
            value={[composition.position.y]}
            onValueChange={([value]) => onCompositionChange({ 
              ...composition, 
              position: { ...composition.position, y: value }
            })}
            min={-200}
            max={200}
            step={1}
            className="w-full"
          />
        </div>
        
        {/* 旋转调整 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <RotateCw className="w-4 h-4" />
            <span className="text-sm font-medium">旋转</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {composition.rotation}°
            </span>
          </div>
          <Slider
            value={[composition.rotation]}
            onValueChange={([value]) => onCompositionChange({ ...composition, rotation: value })}
            min={-180}
            max={180}
            step={1}
            className="w-full"
          />
        </div>
        
        {/* 快速操作按钮 */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCompositionChange({ 
              ...composition, 
              position: { x: 0, y: 0 },
              scale: 1,
              rotation: 0
            })}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            重置
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCompositionChange({ 
              ...composition, 
              rotation: composition.rotation + 90
            })}
            className="flex-1"
          >
            <RotateCw className="w-4 h-4 mr-1" />
            旋转90°
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
