"use client";

import React from "react";

export default function ComfortingMessages() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/50 p-4">
        <h4 className="font-medium text-sm mb-2">💡 Tips for better results</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Use high-quality videos for better watermark removal</li>
          <li>• Ensure the video is well-lit and clear</li>
          <li>• Choose the correct orientation (landscape or portrait)</li>
          <li>• Supported formats: MP4, MOV, AVI, MKV, WEBM</li>
        </ul>
      </div>
      
    </div>
  );
}
