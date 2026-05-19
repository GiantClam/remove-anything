'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutWithBackgroundSelector } from './layout-with-background-selector';

interface ResponsiveLayoutWithBackgroundSelectorProps {
  foregroundImageUrl: string;
  onResult: (resultUrl: string) => void;
  onClose: () => void;
}

export function ResponsiveLayoutWithBackgroundSelector(props: ResponsiveLayoutWithBackgroundSelectorProps) {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  if (isMobile) {
    return <MobileLayout {...props} />;
  }
  
  return <DesktopLayout {...props} />;
}

// 移动端布局
function MobileLayout(props: ResponsiveLayoutWithBackgroundSelectorProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'backgrounds' | 'adjustments'>('preview');
  
  return (
    <div className="flex h-full flex-col">
      <MenuBar />
      
      {/* 移动端标签切换 */}
      <div className="border-b">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preview">预览</TabsTrigger>
            <TabsTrigger value="backgrounds">背景</TabsTrigger>
            <TabsTrigger value="adjustments">调整</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <div className="flex-1 overflow-hidden">
        {activeTab === 'preview' && <MobilePreviewTab {...props} />}
        {activeTab === 'backgrounds' && <MobileBackgroundTab {...props} />}
        {activeTab === 'adjustments' && <MobileAdjustmentTab {...props} />}
      </div>
    </div>
  );
}

// 桌面端布局
function DesktopLayout(props: ResponsiveLayoutWithBackgroundSelectorProps) {
  return <LayoutWithBackgroundSelector {...props} />;
}

// 移动端菜单栏
function MenuBar() {
  const [activeTab, setActiveTab] = useState('add-background');
  
  const menuItems = [
    { id: 'remove-background', label: '去背景', icon: '🎯' },
    { id: 'add-background', label: '添加背景', icon: '🎨' },
    { id: 'batch-process', label: '批量', icon: '📦' },
    { id: 'history', label: '历史', icon: '📚' }
  ];
  
  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1 text-sm transition-colors ${
                activeTab === item.id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// 移动端预览标签页
function MobilePreviewTab(props: ResponsiveLayoutWithBackgroundSelectorProps) {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex flex-1 items-center justify-center">
        <div className="relative aspect-square w-full max-w-sm">
          <div className="flex size-full items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25">
            <div className="text-center text-muted-foreground">
              <span className="mb-2 block text-4xl">🖼️</span>
              <p>选择背景后显示预览</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex gap-2">
        <button className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          添加背景
        </button>
        <button className="rounded-md border border-border px-4 py-2 text-sm">
          取消
        </button>
      </div>
    </div>
  );
}

// 移动端背景标签页
function MobileBackgroundTab(props: ResponsiveLayoutWithBackgroundSelectorProps) {
  const [backgroundType, setBackgroundType] = useState<'solid' | 'gradient' | 'image' | 'template'>('solid');
  
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4">
        <Tabs value={backgroundType} onValueChange={(v) => setBackgroundType(v as any)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="solid">纯色</TabsTrigger>
            <TabsTrigger value="gradient">渐变</TabsTrigger>
            <TabsTrigger value="image">图片</TabsTrigger>
            <TabsTrigger value="template">模板</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {backgroundType === 'solid' && <MobileSolidColorGrid />}
        {backgroundType === 'gradient' && <MobileGradientGrid />}
        {backgroundType === 'image' && <MobileImageUpload />}
        {backgroundType === 'template' && <MobileTemplateGrid />}
      </div>
    </div>
  );
}

// 移动端调整标签页
function MobileAdjustmentTab(props: ResponsiveLayoutWithBackgroundSelectorProps) {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="space-y-6">
        {/* 大小调整 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">大小</span>
            <span className="text-xs text-muted-foreground">100%</span>
          </div>
          <input
            type="range"
            min="10"
            max="300"
            defaultValue="100"
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
          />
        </div>
        
        {/* 位置调整 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">位置 X</span>
            <span className="text-xs text-muted-foreground">0px</span>
          </div>
          <input
            type="range"
            min="-200"
            max="200"
            defaultValue="0"
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
          />
        </div>
        
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">位置 Y</span>
            <span className="text-xs text-muted-foreground">0px</span>
          </div>
          <input
            type="range"
            min="-200"
            max="200"
            defaultValue="0"
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
          />
        </div>
        
        {/* 旋转调整 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">旋转</span>
            <span className="text-xs text-muted-foreground">0°</span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            defaultValue="0"
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
          />
        </div>
        
        {/* 快速操作按钮 */}
        <div className="grid grid-cols-2 gap-2 pt-4">
          <button className="rounded-md border border-border px-4 py-2 text-sm">
            重置
          </button>
          <button className="rounded-md border border-border px-4 py-2 text-sm">
            旋转90°
          </button>
        </div>
      </div>
    </div>
  );
}

// 移动端纯色网格
function MobileSolidColorGrid() {
  const colors = [
    '#FFFFFF', '#F8F9FA', '#E9ECEF', '#DEE2E6', '#CED4DA', '#ADB5BD',
    '#6C757D', '#495057', '#343A40', '#212529', '#000000', '#FF6B6B',
    '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A'
  ];
  
  return (
    <div className="grid grid-cols-6 gap-3">
      {colors.map((color) => (
        <button
          key={color}
          className="size-12 rounded-lg border-2 border-border"
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  );
}

// 移动端渐变网格
function MobileGradientGrid() {
  const gradients = [
    'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
    'linear-gradient(45deg, #a8edea, #fed6e3)',
    'linear-gradient(45deg, #ffecd2, #fcb69f)',
    'linear-gradient(45deg, #667eea, #764ba2)',
    'linear-gradient(45deg, #f093fb, #f5576c)',
    'linear-gradient(45deg, #4facfe, #00f2fe)',
    'linear-gradient(45deg, #43e97b, #38f9d7)',
    'linear-gradient(45deg, #fa709a, #fee140)',
    'radial-gradient(circle, #a8c0ff, #3f2b96)',
    'radial-gradient(circle, #ff9a9e, #fecfef)',
    'radial-gradient(circle, #ffecd2, #fcb69f)',
    'radial-gradient(circle, #ff8a80, #ea6100)'
  ];
  
  return (
    <div className="grid grid-cols-3 gap-3">
      {gradients.map((gradient, index) => (
        <button
          key={index}
          className="h-16 w-full rounded-lg border-2 border-border"
          style={{ background: gradient }}
        />
      ))}
    </div>
  );
}

// 移动端图片上传
function MobileImageUpload() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center">
        <span className="mb-2 block text-4xl">📷</span>
        <p className="mb-2 text-sm text-muted-foreground">上传背景图片</p>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          id="mobile-background-upload"
        />
        <button
          onClick={() => document.getElementById('mobile-background-upload')?.click()}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          选择文件
        </button>
      </div>
    </div>
  );
}

// 移动端模板网格
function MobileTemplateGrid() {
  const templates = [
    { id: 'office', name: '办公室' },
    { id: 'nature', name: '自然' },
    { id: 'abstract', name: '抽象' },
    { id: 'studio', name: '摄影棚' },
    { id: 'beach', name: '海滩' },
    { id: 'city', name: '城市' }
  ];
  
  return (
    <div className="grid grid-cols-2 gap-3">
      {templates.map((template) => (
        <button
          key={template.id}
          className="relative h-20 w-full overflow-hidden rounded-lg border-2 border-border bg-gray-100"
        >
          <div className="absolute inset-x-0 bottom-0 bg-black/50 p-2 text-center text-xs text-white">
            {template.name}
          </div>
        </button>
      ))}
    </div>
  );
}
