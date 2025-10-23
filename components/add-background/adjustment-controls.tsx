'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, RotateCw, Move, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface AdjustmentControlsProps {
  params: {
    position: { x: number; y: number };
    scale: number;
    rotation: number;
    blendMode: string;
  };
  onChange: (params: any) => void;
}

export function AdjustmentControls({ params, onChange }: AdjustmentControlsProps) {
  const t = useTranslations('RemoveBackgroundPage.adjustmentControls');
  const handlePositionChange = (axis: 'x' | 'y', value: number) => {
    onChange({
      ...params,
      position: {
        ...params.position,
        [axis]: value
      }
    });
  };

  const handleScaleChange = (value: number[]) => {
    onChange({
      ...params,
      scale: value[0]
    });
  };

  const handleRotationChange = (value: number[]) => {
    onChange({
      ...params,
      rotation: value[0]
    });
  };

  const resetParams = () => {
    onChange({
      position: { x: 0, y: 0 },
      scale: 1,
      rotation: 0,
      blendMode: 'normal'
    });
  };

  const rotate90 = () => {
    onChange({
      ...params,
      rotation: (params.rotation + 90) % 360
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          {t('title')}
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={resetParams}
              className="h-8 w-8 p-0"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={rotate90}
              className="h-8 w-8 p-0"
            >
              <RotateCw className="w-3 h-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 大小调整 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ZoomIn className="w-4 h-4" />
            <span className="text-sm font-medium">{t('size')}</span>
            <span className="text-sm text-gray-500 ml-auto">{Math.round(params.scale * 100)}%</span>
          </div>
          <Slider
            value={[params.scale]}
            onValueChange={handleScaleChange}
            min={0.1}
            max={3}
            step={0.1}
            className="w-full"
          />
        </div>

        {/* 位置调整 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4" />
            <span className="text-sm font-medium">{t('position')}</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-8">X</span>
              <Slider
                value={[params.position.x]}
                onValueChange={(value) => handlePositionChange('x', value[0])}
                min={-100}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-gray-500 w-8">{params.position.x}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-8">Y</span>
              <Slider
                value={[params.position.y]}
                onValueChange={(value) => handlePositionChange('y', value[0])}
                min={-100}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-gray-500 w-8">{params.position.y}</span>
            </div>
          </div>
        </div>

        {/* 旋转调整 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4" />
            <span className="text-sm font-medium">{t('rotation')}</span>
            <span className="text-sm text-gray-500 ml-auto">{params.rotation}°</span>
          </div>
          <Slider
            value={[params.rotation]}
            onValueChange={handleRotationChange}
            min={-180}
            max={180}
            step={1}
            className="w-full"
          />
        </div>

        {/* 快速操作按钮 */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleScaleChange([0.5])}
            className="flex items-center gap-1"
          >
            <ZoomOut className="w-3 h-3" />
            {t('zoomOut')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleScaleChange([1.5])}
            className="flex items-center gap-1"
          >
            <ZoomIn className="w-3 h-3" />
            {t('zoomIn')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
