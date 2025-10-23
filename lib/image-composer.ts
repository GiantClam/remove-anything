export interface BackgroundData {
  type: 'solid' | 'gradient' | 'image' | 'template';
  data: {
    color?: string;
    gradient?: {
      type: 'linear' | 'radial';
      colors: string[];
      direction?: number;
    };
    imageUrl?: string;
    templateId?: string;
  };
}

export interface CompositionParams {
  position: { x: number; y: number };
  scale: number;
  rotation: number;
  blendMode?: 'normal' | 'multiply' | 'overlay' | 'screen' | 'darken' | 'lighten';
}

export interface ComposeOptions {
  foreground: string;
  background: BackgroundData;
  composition: CompositionParams;
  outputSize?: { width: number; height: number };
}

export class ImageComposer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private deviceScore: number = 0;
  
  constructor(width: number = 1024, height: number = 1024) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
    
    this.detectDeviceCapability();
  }
  
  private detectDeviceCapability(): void {
    // 检测设备性能
    const startTime = performance.now();
    for (let i = 0; i < 1000; i++) {
      this.ctx.fillRect(0, 0, 100, 100);
    }
    const canvasTime = performance.now() - startTime;
    
    // 计算设备分数
    let score = 100;
    if (canvasTime > 50) score -= 30;
    else if (canvasTime > 20) score -= 15;
    
    // 设备像素比影响
    if (window.devicePixelRatio > 2) score -= 10;
    
    this.deviceScore = Math.max(0, score);
  }
  
  getOptimalCanvasSize(imageSize: { width: number; height: number }): { width: number; height: number } {
    const maxSize = this.getMaxCanvasSize();
    const aspectRatio = imageSize.width / imageSize.height;
    
    if (imageSize.width > maxSize || imageSize.height > maxSize) {
      if (aspectRatio > 1) {
        return { width: maxSize, height: maxSize / aspectRatio };
      } else {
        return { width: maxSize * aspectRatio, height: maxSize };
      }
    }
    
    return imageSize;
  }
  
  private getMaxCanvasSize(): number {
    if (this.deviceScore > 80) return 2048;      // 高端设备
    if (this.deviceScore > 60) return 1024;      // 中端设备
    if (this.deviceScore > 40) return 512;       // 低端设备
    return 256;                                  // 极低端设备
  }
  
  async composeImages(options: ComposeOptions): Promise<string> {
    const { foreground, background, composition, outputSize } = options;
    
    // 设置画布尺寸
    if (outputSize) {
      this.canvas.width = outputSize.width;
      this.canvas.height = outputSize.height;
    }
    
    // 启用硬件加速
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    
    // 1. 绘制背景
    await this.drawBackground(background);
    
    // 2. 绘制前景
    await this.drawForeground(foreground, composition);
    
    // 3. 返回合成结果
    return this.canvas.toDataURL('image/png', 0.9);
  }
  
  private async drawBackground(background: BackgroundData): Promise<void> {
    const { type, data } = background;
    
    switch (type) {
      case 'solid':
        if (data.color) {
          this.ctx.fillStyle = data.color;
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        break;
        
      case 'gradient':
        if (data.gradient) {
          const gradient = this.createGradient(data.gradient);
          this.ctx.fillStyle = gradient;
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        break;
        
      case 'image':
      case 'template':
        if (data.imageUrl) {
          await this.drawImageBackground(data.imageUrl);
        }
        break;
    }
  }
  
  private async drawForeground(
    foregroundUrl: string, 
    composition: CompositionParams
  ): Promise<void> {
    const img = await this.loadImage(foregroundUrl);
    
    const { position, scale, rotation, blendMode } = composition;
    
    this.ctx.save();
    
    // 设置混合模式
    if (blendMode && blendMode !== 'normal') {
      this.ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
    }
    
    // 应用变换
    const centerX = position.x + (img.width * scale) / 2;
    const centerY = position.y + (img.height * scale) / 2;
    
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate((rotation * Math.PI) / 180);
    this.ctx.scale(scale, scale);
    
    // 绘制前景图片
    this.ctx.drawImage(
      img,
      -img.width / 2,
      -img.height / 2,
      img.width,
      img.height
    );
    
    this.ctx.restore();
  }
  
  private createGradient(gradientData: any): CanvasGradient {
    const { type, colors, direction } = gradientData;
    
    let gradient: CanvasGradient;
    
    if (type === 'linear') {
      const angle = (direction || 45) * Math.PI / 180;
      const x1 = Math.cos(angle) * this.canvas.width;
      const y1 = Math.sin(angle) * this.canvas.height;
      gradient = this.ctx.createLinearGradient(0, 0, x1, y1);
    } else {
      gradient = this.ctx.createRadialGradient(
        this.canvas.width / 2,
        this.canvas.height / 2,
        0,
        this.canvas.width / 2,
        this.canvas.height / 2,
        Math.max(this.canvas.width, this.canvas.height) / 2
      );
    }
    
    colors.forEach((color: string, index: number) => {
      gradient.addColorStop(index / (colors.length - 1), color);
    });
    
    return gradient;
  }
  
  private async drawImageBackground(imageUrl: string): Promise<void> {
    const img = await this.loadImage(imageUrl);
    
    // 计算缩放比例，保持宽高比
    const scale = Math.max(
      this.canvas.width / img.width,
      this.canvas.height / img.height
    );
    
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    
    const x = (this.canvas.width - scaledWidth) / 2;
    const y = (this.canvas.height - scaledHeight) / 2;
    
    this.ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
  }
  
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }
  
  // 生成纯色背景
  static generateSolidColorBackground(color: string, width: number = 1024, height: number = 1024): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return canvas.toDataURL('image/png');
  }
  
  // 生成渐变背景
  static generateGradientBackground(
    gradient: { type: 'linear' | 'radial'; colors: string[]; direction?: number },
    width: number = 1024,
    height: number = 1024
  ): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    let canvasGradient: CanvasGradient;
    
    if (gradient.type === 'linear') {
      const angle = (gradient.direction || 45) * Math.PI / 180;
      const x1 = Math.cos(angle) * width;
      const y1 = Math.sin(angle) * height;
      canvasGradient = ctx.createLinearGradient(0, 0, x1, y1);
    } else {
      canvasGradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        Math.max(width, height) / 2
      );
    }
    
    gradient.colors.forEach((color, index) => {
      canvasGradient.addColorStop(index / (gradient.colors.length - 1), color);
    });
    
    ctx.fillStyle = canvasGradient;
    ctx.fillRect(0, 0, width, height);
    
    return canvas.toDataURL('image/png');
  }
}
