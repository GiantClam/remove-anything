"use client";

import React from "react";
import { Icons } from "@/components/shared/icons";

interface LoadingProps {
  progress?: number;
  processingStartTime?: number | null;
}

export default function Loading({ progress = 0, processingStartTime }: LoadingProps) {
  const getElapsedTime = () => {
    if (!processingStartTime) return "0s";
    const elapsed = Math.floor((Date.now() - processingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const getEstimatedTimeRemaining = () => {
    if (!processingStartTime) return "~6 minutes";
    const elapsed = Date.now() - processingStartTime;
    const totalEstimated = 6 * 60 * 1000; // 4分钟
    const remaining = Math.max(0, totalEstimated - elapsed);
    const remainingMinutes = Math.ceil(remaining / (60 * 1000));
    return remainingMinutes > 0 ? `~${remainingMinutes} minutes` : "almost done";
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-center space-x-2 mb-4">
        <Icons.spinner className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">
          Processing your video...
        </span>
      </div>
      
      <div className="space-y-4">
        {/* 进度条 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${Math.min(progress, 95)}%` }}
            ></div>
          </div>
        </div>

        {/* 时间信息 */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="font-medium text-primary">Elapsed</div>
            <div className="text-muted-foreground">{getElapsedTime()}</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="font-medium text-primary">Est. Remaining</div>
            <div className="text-muted-foreground">{getEstimatedTimeRemaining()}</div>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            AI is analyzing and removing watermarks from your video
          </p>
          <p className="text-xs text-muted-foreground">
            ⏱️ Typical processing time: 6 minutes
          </p>
        </div>
      </div>
    </div>
  );
}
