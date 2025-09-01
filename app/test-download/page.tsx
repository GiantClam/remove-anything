"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { DownloadAction } from "@/components/history/download-action";

export default function TestDownloadPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">下载功能测试页面</h1>
      
      <div className="space-y-4">
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">测试下载按钮</h2>
          <p className="text-muted-foreground mb-4">
            点击下面的按钮测试不同类型的下载功能
          </p>
          
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <h3 className="font-medium">背景移除下载</h3>
              <DownloadAction 
                id="test-bg-123" 
                taskType="background-removal"
                showText={true}
              />
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium">水印移除下载</h3>
              <DownloadAction 
                id="test-wm-123" 
                taskType="watermark-removal"
                showText={true}
              />
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium">Flux下载</h3>
              <DownloadAction 
                id="test-flux-123" 
                taskType="flux"
                showText={true}
              />
            </div>
          </div>
        </div>
        
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">手动测试下载</h2>
          <p className="text-muted-foreground mb-4">
            手动测试API端点
          </p>
          
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={async () => {
                try {
                  const response = await fetch('/api/download-background?taskId=test123', {
                    credentials: 'include',
                  });
                  console.log('背景移除API响应:', response);
                  console.log('响应头:', Object.fromEntries(response.headers.entries()));
                  
                  if (response.ok) {
                    const blob = await response.blob();
                    console.log('Blob:', blob);
                    
                    // 尝试下载
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'test-background.png';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                  }
                } catch (error) {
                  console.error('测试失败:', error);
                }
              }}
            >
              测试背景移除API
            </Button>
            
            <Button
              onClick={async () => {
                try {
                  const response = await fetch('/api/download?taskId=test123&type=watermark-removal', {
                    credentials: 'include',
                  });
                  console.log('水印移除API响应:', response);
                  console.log('响应头:', Object.fromEntries(response.headers.entries()));
                  
                  if (response.ok) {
                    const blob = await response.blob();
                    console.log('Blob:', blob);
                    
                    // 尝试下载
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'test-watermark.zip';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                  }
                } catch (error) {
                  console.error('测试失败:', error);
                }
              }}
            >
              测试水印移除API
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
