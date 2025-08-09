'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

interface WebhookHandlerProps {
  taskId: string;
  onComplete: (imageUrl: string) => void;
  onError: (error: string) => void;
}

export function WebhookHandler({ taskId, onComplete, onError }: WebhookHandlerProps) {
  useEffect(() => {
    // 检查是否是生产环境
    const isProduction = typeof window !== 'undefined' && 
      (window.location.hostname === 'www.remove-anything.com' || 
       window.location.hostname === 'remove-anything.com' ||
       window.location.hostname.includes('vercel.app'));

    if (isProduction) {
      // 生产环境：使用Server-Sent Events或定期检查数据库状态
      console.log("🔗 生产环境：使用数据库状态检查模式");
      
      let attempts = 0;
      const maxAttempts = 60; // 最多检查60次（5分钟）
      
      const checkDatabaseStatus = async () => {
        try {
          // 只检查数据库状态，不调用Replicate API
          const response = await fetch(`/api/task/${taskId}?dbOnly=true`);
          if (response.ok) {
            const data = await response.json();
            
            if (data.status === 'succeeded' && data.output) {
              onComplete(data.output);
              return;
            } else if (data.status === 'failed') {
              onError(data.error || 'Task failed');
              return;
            }
          }
          
          attempts++;
          if (attempts < maxAttempts) {
            // 继续检查，间隔时间递增
            const delay = Math.min(5000 + attempts * 1000, 10000); // 5-10秒间隔
            setTimeout(checkDatabaseStatus, delay);
          } else {
            onError('Task timeout - no webhook received');
          }
        } catch (error) {
          console.error('Error checking database status:', error);
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(checkDatabaseStatus, 5000);
          } else {
            onError('Task timeout - database check failed');
          }
        }
      };
      
      // 延迟5秒后开始检查，给webhook时间处理
      const timer = setTimeout(checkDatabaseStatus, 5000);
      
      return () => clearTimeout(timer);
    }

    // 开发环境：使用轮询模式
    const checkTaskStatus = async () => {
      try {
        const response = await fetch(`/api/task/${taskId}`);
        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'succeeded' && data.output) {
            onComplete(data.output);
          } else if (data.status === 'failed') {
            onError(data.error || 'Task failed');
          } else {
            // 任务还在处理中，5秒后再检查一次
            setTimeout(checkTaskStatus, 5000);
          }
        }
      } catch (error) {
        console.error('Error checking task status:', error);
      }
    };

    // 开发环境中，延迟3秒后开始检查状态
    const timer = setTimeout(checkTaskStatus, 3000);
    
    return () => clearTimeout(timer);
  }, [taskId, onComplete, onError]);

  return null;
}
