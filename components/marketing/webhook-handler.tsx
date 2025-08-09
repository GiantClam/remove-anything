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
    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;
    
    // 检查是否是生产环境
    const isProduction = typeof window !== 'undefined' && 
      (window.location.hostname === 'www.remove-anything.com' || 
       window.location.hostname === 'remove-anything.com' ||
       window.location.hostname.includes('vercel.app'));

    if (isProduction) {
      // 生产环境：优化检查策略
      console.log("🔗 生产环境：使用数据库状态检查模式");
      
      let attempts = 0;
      const maxAttempts = 60; // 增加最大尝试次数（10分钟）
      
      const checkDatabaseStatus = async () => {
        try {
          // 只检查数据库状态，不调用Replicate API
          const response = await fetch(`/api/task/${taskId}?dbOnly=true`);
          if (response.ok) {
            const data = await response.json();
            
            console.log(`🔍 生产环境状态检查 ${attempts + 1}/${maxAttempts}:`, data.status);
            
            if (data.status === 'succeeded' && data.output) {
              console.log("✅ 任务完成，输出:", data.output);
              onComplete(data.output);
              return;
            } else if (data.status === 'failed') {
              console.log("❌ 任务失败:", data.error);
              onError(data.error || 'Task failed');
              return;
            }
          }
          
          attempts++;
          if (attempts < maxAttempts) {
            // 动态调整检查间隔：开始频繁，后来递减
            let delay;
            if (attempts <= 10) {
              delay = 2000; // 前10次每2秒检查一次
            } else if (attempts <= 30) {
              delay = 3000; // 11-30次每3秒检查一次  
            } else {
              delay = 5000; // 之后每5秒检查一次
            }
            
            timeoutId = setTimeout(checkDatabaseStatus, delay);
          } else {
            onError('Task timeout - no webhook received');
          }
        } catch (error) {
          console.error('Error checking database status:', error);
          attempts++;
          if (attempts < maxAttempts) {
            timeoutId = setTimeout(checkDatabaseStatus, 3000);
          } else {
            onError('Task timeout - database check failed');
          }
        }
      };
      
      // 立即开始第一次检查，不等待
      checkDatabaseStatus();
      
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
      };
    }

    // 开发环境：使用更频繁的轮询
    const checkTaskStatus = async () => {
      try {
        const response = await fetch(`/api/task/${taskId}`);
        if (response.ok) {
          const data = await response.json();
          
          console.log("🔍 开发环境状态检查:", data.status);
          
          if (data.status === 'succeeded' && data.output) {
            onComplete(data.output);
          } else if (data.status === 'failed') {
            onError(data.error || 'Task failed');
          }
          // 继续轮询直到任务完成
        }
      } catch (error) {
        console.error('Error checking task status:', error);
      }
    };

    // 开发环境：立即开始检查，然后每3秒检查一次
    checkTaskStatus();
    intervalId = setInterval(checkTaskStatus, 3000);
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [taskId, onComplete, onError]);

  return null;
}
