'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, Image, Sparkles, Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface BackgroundSelectorProps {
  type: "solid" | "gradient" | "image" | "template";
  onTypeChange: (type: string) => void;
  selected: any;
  onSelect: (background: any) => void;
}

// 预设颜色
const solidColors = [
  '#FFFFFF', '#000000', '#F8F9FA', '#6C757D',
  '#FF6B6B', '#4ECDC4', '#96CEB4', '#DDA0DD',
  '#F8C471', '#F1948A', '#A8E6CF', '#FFD93D',
  '#6BCF7F', '#4D96FF', '#9B59B6', '#E74C3C',
  '#F39C12', '#2ECC71', '#3498DB', '#E67E22',
  '#1ABC9C', '#34495E', '#95A5A6', '#F1C40F'
];

// 预设渐变
const gradients = [
  { name: '蓝粉渐变', colors: ['#ff6b6b', '#4ecdc4'], direction: 45 },
  { name: '紫蓝渐变', colors: ['#667eea', '#764ba2'], direction: 45 },
  { name: '橙红渐变', colors: ['#fa709a', '#fee140'], direction: 45 },
  { name: '绿蓝渐变', colors: ['#43e97b', '#38f9d7'], direction: 45 },
  { name: '径向蓝紫', colors: ['#a8c0ff', '#3f2b96'], type: 'radial' },
  { name: '径向粉橙', colors: ['#ff9a9e', '#fecfef'], type: 'radial' },
  { name: '日落渐变', colors: ['#ff9a9e', '#fad0c4'], direction: 45 },
  { name: '海洋渐变', colors: ['#667eea', '#764ba2'], direction: 45 },
  { name: '森林渐变', colors: ['#134e5e', '#71b280'], direction: 45 },
  { name: '火焰渐变', colors: ['#ff416c', '#ff4b2b'], direction: 45 },
  { name: '星空渐变', colors: ['#0c0c0c', '#1a1a2e'], direction: 45 },
  { name: '彩虹渐变', colors: ['#ff9a9e', '#fecfef', '#fecfef'], direction: 45 }
];

// 预设模板
const templates = [
  { name: '办公室', url: '/templates/office.jpg', category: 'office' },
  { name: '自然风景', url: '/templates/nature.jpg', category: 'nature' },
  { name: '抽象背景', url: '/templates/abstract.jpg', category: 'abstract' },
  { name: '摄影棚', url: '/templates/studio.jpg', category: 'studio' },
  { name: '海滩', url: '/templates/beach.jpg', category: 'beach' },
  { name: '城市', url: '/templates/city.jpg', category: 'city' }
];

export function BackgroundSelector({ type, onTypeChange, selected, onSelect }: BackgroundSelectorProps) {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const t = useTranslations('RemoveBackgroundPage.backgroundSelector');

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setUploadedImage(result);
        onSelect({
          type: 'image',
          data: { imageUrl: result }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={type} onValueChange={onTypeChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4 gap-1">
            <TabsTrigger value="solid" className="flex items-center gap-1 text-xs">
              <Palette className="w-3 h-3" />
              <span className="hidden lg:inline">{t('solid')}</span>
            </TabsTrigger>
            <TabsTrigger value="gradient" className="flex items-center gap-1 text-xs">
              <Layers className="w-3 h-3" />
              <span className="hidden lg:inline">{t('gradient')}</span>
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-1 text-xs">
              <Image className="w-3 h-3" />
              <span className="hidden lg:inline">{t('image')}</span>
            </TabsTrigger>
            <TabsTrigger value="template" className="flex items-center gap-1 text-xs">
              <Sparkles className="w-3 h-3" />
              <span className="hidden lg:inline">{t('template')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="solid" className="mt-4">
            <div className="grid grid-cols-6 gap-2">
              {solidColors.map((color, index) => (
                <button
                  key={index}
                  onClick={() => onSelect({ type: 'solid', data: { color } })}
                  className={`w-8 h-8 rounded border-2 ${
                    selected?.data?.color === color ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="gradient" className="mt-4">
            <div className="grid grid-cols-2 gap-2">
              {gradients.map((gradient, index) => (
                <button
                  key={index}
                  onClick={() => onSelect({ type: 'gradient', data: { gradient: { type: gradient.type || 'linear', colors: gradient.colors, direction: gradient.direction } } })}
                  className={`h-16 rounded border-2 ${
                    selected?.data?.gradient?.colors?.join(',') === gradient.colors.join(',') ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'
                  }`}
                  style={{
                    background: gradient.type === 'radial' 
                      ? `radial-gradient(circle, ${gradient.colors.join(', ')})`
                      : `linear-gradient(${gradient.direction}deg, ${gradient.colors.join(', ')})`
                  }}
                  title={gradient.name}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="image" className="mt-4">
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="background-upload"
                />
                <label
                  htmlFor="background-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Image className="w-8 h-8 text-gray-400" />
                  <span className="text-sm text-gray-600">{t('uploadImage')}</span>
                </label>
              </div>
              
              {uploadedImage && (
                <div className="border rounded-lg p-2">
                  <img
                    src={uploadedImage}
                    alt="Uploaded background"
                    className="w-full h-24 object-cover rounded"
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="template" className="mt-4">
            <div className="grid grid-cols-2 gap-2">
              {templates.map((template, index) => (
                <button
                  key={index}
                  onClick={() => onSelect({ type: 'template', data: { templateId: template.name } })}
                  className={`h-16 rounded border-2 ${
                    selected?.data?.templateId === template.name ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'
                  }`}
                  title={template.name}
                >
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 rounded flex items-center justify-center">
                    <span className="text-xs text-gray-600">{template.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
