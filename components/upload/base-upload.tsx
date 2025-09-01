"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BaseUploadProps {
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  accept?: string;
  maxSize?: number;
  isUploading?: boolean;
  uploadProgress?: number;
  selectedFile?: File | null;
  className?: string;
  multiple?: boolean; // 新增：支持多文件上传
}

export function BaseUpload({
  onFileSelect,
  onFileRemove,
  accept = "image/*",
  maxSize = 10 * 1024 * 1024, // 10MB
  isUploading = false,
  uploadProgress = 0,
  selectedFile,
  className,
  multiple = false, // 默认单文件上传
}: BaseUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const t = useTranslations("Upload");

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      if (multiple) {
        // 多文件模式：处理所有文件
        Array.from(files).forEach(file => {
          handleFileSelect(file);
        });
      } else {
        // 单文件模式：只处理第一个文件
        handleFileSelect(files[0]);
      }
    }
  };

  const handleFileSelect = (file: File) => {
    if (file.size > maxSize) {
      alert(t("fileSizeLimit", { size: maxSize / (1024 * 1024) }));
      return;
    }
    
    onFileSelect(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (multiple) {
        // 多文件模式：处理所有文件
        Array.from(files).forEach(file => {
          handleFileSelect(file);
        });
      } else {
        // 单文件模式：只处理第一个文件
        handleFileSelect(files[0]);
      }
    }
  };

  if (selectedFile) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileIcon className="h-5 w-5" />
              <span className="text-sm font-medium">{selectedFile.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onFileRemove}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {isUploading && (
            <div className="mt-4 space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-sm text-muted-foreground">
                {t("uploadProgress", { progress: uploadProgress })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "border-2 border-dashed transition-colors",
        dragOver && "border-primary bg-primary/5",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="p-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">{t("dragAndDrop")}</p>
            <p className="text-xs text-muted-foreground">
              {t("supportedFormats", { formats: accept, size: maxSize / (1024 * 1024) })}
            </p>
          </div>
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              {t("selectFile")}
              <input
                type="file"
                className="hidden"
                accept={accept}
                multiple={multiple}
                onChange={handleFileInput}
              />
            </label>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 