export class ClientImageDownloader {
  private isIOS: boolean;
  private isAndroid: boolean;
  private isMobile: boolean;
  
  constructor() {
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    this.isAndroid = /Android/.test(navigator.userAgent);
    this.isMobile = this.isIOS || this.isAndroid;
  }
  
  async downloadImage(
    imageDataUrl: string, 
    filename: string = 'composed-image.png'
  ): Promise<void> {
    try {
      if (this.isMobile) {
        await this.downloadOnMobile(imageDataUrl, filename);
      } else {
        await this.downloadOnDesktop(imageDataUrl, filename);
      }
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }
  
  private async downloadOnMobile(imageDataUrl: string, filename: string): Promise<void> {
    if (this.isIOS) {
      await this.downloadOnIOS(imageDataUrl, filename);
    } else if (this.isAndroid) {
      await this.downloadOnAndroid(imageDataUrl, filename);
    }
  }
  
  private async downloadOnIOS(imageDataUrl: string, filename: string): Promise<void> {
    // iOS 方案1: 尝试 Web Share API
    if ('share' in navigator && 'canShare' in navigator) {
      try {
        const response = await fetch(imageDataUrl);
        const blob = await response.blob();
        const file = new File([blob], filename, { type: blob.type });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: filename,
            text: '保存到相册'
          });
          return;
        }
      } catch (error) {
        console.log('Web Share API failed, trying alternative method');
      }
    }
    
    // iOS 方案2: 新窗口打开
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head><title>保存图片</title></head>
          <body style="margin:0;padding:20px;text-align:center;background:#f0f0f0;">
            <img src="${imageDataUrl}" style="max-width:100%;height:auto;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);" />
            <p style="margin-top:20px;color:#666;font-size:14px;">
              长按图片 → 保存到相册
            </p>
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  }
  
  private async downloadOnAndroid(imageDataUrl: string, filename: string): Promise<void> {
    // Android 方案1: 尝试直接下载
    try {
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      // Android 方案2: 降级到新窗口
      this.downloadOnIOS(imageDataUrl, filename);
    }
  }
  
  private async downloadOnDesktop(imageDataUrl: string, filename: string): Promise<void> {
    // PC端直接下载
    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  // 批量下载
  async downloadMultiple(images: Array<{ dataUrl: string; filename: string }>): Promise<void> {
    for (let i = 0; i < images.length; i++) {
      await this.downloadImage(images[i].dataUrl, images[i].filename);
      
      // 避免浏览器阻止多个下载
      if (i < images.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  // 从URL下载图片
  async downloadFromUrl(imageUrl: string, filename: string): Promise<void> {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const dataUrl = URL.createObjectURL(blob);
      
      await this.downloadImage(dataUrl, filename);
      
      URL.revokeObjectURL(dataUrl);
    } catch (error) {
      console.error('Download from URL failed:', error);
      throw error;
    }
  }
}
