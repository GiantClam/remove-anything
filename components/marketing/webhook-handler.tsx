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

    // 生产环境中，延迟3秒后开始检查状态（给webhook时间处理）
    const timer = setTimeout(checkTaskStatus, 3000);
    
    return () => clearTimeout(timer);
  }, [taskId, onComplete, onError]);

  return null;
}
