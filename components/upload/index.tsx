"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { FileIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { Accept } from "react-dropzone";
import { toast } from "sonner";

import { cn, getMime } from "@/lib/utils";

import { BaseUpload } from "./base-upload";
import { RemoveAction } from "./remove-action";

let md5Worker: any;

export function formatSize(size: number) {
  const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  let i = 0;
  while (size >= 1024) {
    size /= 1024;
    i++;
  }
  return size.toFixed(2) + " " + units[i];
}

// Helper function to convert React Dropzone Accept type to string
function convertAcceptToString(accept?: Accept): string {
  if (!accept) return "image/*";
  
  if (typeof accept === "string") {
    return accept;
  }
  
  if (Array.isArray(accept)) {
    return accept[0] || "image/*";
  }
  
  // If it's an object, get the first key
  const keys = Object.keys(accept);
  return keys[0] || "image/*";
}

interface UploadValue {
  id?: string;
  url: string;
  completedUrl: string;
  key?: string;
  originFile?: File;
  md5?: string;
  fileType?: string;
  status?: 'uploading' | 'uploaded' | 'processing' | 'completed' | 'error';
  error?: string;
}

interface FormUploadProps {
  accept?: Accept;
  maxSize?: number;
  maxFiles?: number;
  defaultImg?: string;
  value?: UploadValue[];
  className?: string;
  previewClassName?: string;
  disabled?: boolean;
  placeholder?: string | React.ReactNode;
  onChange?: (values: UploadValue[]) => void;
  multiple?: boolean; // 新增：支持多文件上传
}

export const useGetLicenseSts = (config?: {
  onSuccess: (result: any) => void;
}) => {
  const { userId } = useAuth();

  return useMutation({
    mutationFn: async (values: any = {}) => {
      return fetch(`/api/s3/sts`, {
        method: "POST",
        body: JSON.stringify(values),
        credentials: 'include',
      }).then((res) => res.json());
    },
    onSuccess: async (result) => {
      config?.onSuccess(result);
    },
  });
};

const FormUpload = (props: FormUploadProps) => {
  const {
    value = [],
    placeholder = "Please drag and drop files to upload",
    onChange,
    className,
    previewClassName,
    disabled,
    accept,
    maxSize,
    maxFiles = 10, // 默认最多10个文件
    defaultImg,
    multiple = false, // 默认单文件上传
  } = props;
  const getLicenseSts = useGetLicenseSts();
  const [uploadLoading, setUploadLoading] = useState(false);
  
  const handleFileChange = async (files: File[]) => {
    if (files.length) {
      try {
        setUploadLoading(true);
        
        // 检查文件数量限制
        if (multiple && value.length + files.length > maxFiles) {
          toast.error(`最多只能上传 ${maxFiles} 个文件`);
          return;
        }
        
        // 如果不是多文件模式，只处理第一个文件
        const filesToProcess = multiple ? files : [files[0]];
        
        const uploadPromises = filesToProcess.map(async (file) => {
          const key = `${nanoid(12)}.${getMime(file.name) || "_"}`;
          
          // 先添加到列表中，状态为上传中
          const tempValue = {
            url: "",
            key: "",
            completedUrl: "",
            id: nanoid(12),
            originFile: file,
            status: 'uploading' as const,
          };
          
          const currentValues = [...value];
          if (!multiple) {
            // 单文件模式，替换现有文件
            onChange?.([tempValue]);
          } else {
            // 多文件模式，添加到列表
            onChange?.([...currentValues, tempValue]);
          }

          try {
            const res = await getLicenseSts.mutateAsync({
              key,
              fileType: file.type,
            });
            
            if (res.error || !res?.data.putUrl || !res?.data.url) {
              throw new Error(res.error || "Failed to get upload information");
            }
            
            const formData = new FormData();
            formData.append("file", file);
            await fetch(res.data.putUrl, {
              body: file,
              method: "PUT",
              headers: {
                "Content-Type": file.type,
              },
            });

            const newValue = {
              url: res?.data?.url,
              key: res?.data?.key,
              completedUrl: res?.data?.completedUrl,
              id: tempValue.id,
              originFile: file,
              status: 'uploaded' as const,
            };
            
            // 更新对应的文件状态
            const updatedValues = multiple 
              ? value.map(v => v.id === tempValue.id ? newValue : v)
              : [newValue];
            onChange?.(updatedValues);
            
            return newValue;
          } catch (error) {
            console.log("upload error->", error);
            const errorValue = {
              ...tempValue,
              status: 'error' as const,
              error: error + "" || "Upload failed!",
            };
            
            const updatedValues = multiple 
              ? value.map(v => v.id === tempValue.id ? errorValue : v)
              : [errorValue];
            onChange?.(updatedValues);
            
            toast.error(error + "" || "Upload failed! Please try again later.");
            throw error;
          }
        });
        
        await Promise.all(uploadPromises);
        
      } catch (error) {
        console.log("error->", error);
        toast.error(error + "" || "Upload failed! Please try again later.");
      } finally {
        setUploadLoading(false);
      }
    }
  };

  return (
    <>
      {value?.length && Array.isArray(value) ? (
        <div
          className={cn(
            "dark:!bg-navy-700 relative flex h-[225px] w-full items-center justify-center rounded-xl border-gray-200 bg-gray-100 transition duration-300 dark:!border-none",
            previewClassName,
            {
              disabled,
            },
          )}
        >
          {multiple ? (
            // 多文件模式：显示网格布局
            <div className="grid grid-cols-2 gap-2 p-2 w-full h-full overflow-auto">
              {value.map((item) => {
                const type = item?.fileType || item?.originFile?.type;
                return (
                  <div
                    className="group relative h-32 w-full overflow-hidden rounded-lg border"
                    key={item.id}
                  >
                    {!disabled && (
                      <RemoveAction
                        onClick={() => {
                          onChange?.(value.filter((_item) => _item.id !== item.id));
                        }}
                      />
                    )}
                    {item.status === 'uploading' && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="text-white text-sm">上传中...</div>
                      </div>
                    )}
                    {item.status === 'error' && (
                      <div className="absolute inset-0 bg-red-500 bg-opacity-50 flex items-center justify-center">
                        <div className="text-white text-xs text-center">上传失败</div>
                      </div>
                    )}
                    {type?.includes("image") ? (
                      <img src={item.url || URL.createObjectURL(item.originFile!)} className="h-full w-full object-cover" />
                    ) : type?.includes("video") ? (
                      <video src={item.url} className="h-full w-full object-cover" />
                    ) : (
                      <div className="dark:!bg-navy-700 flex h-full w-full flex-col items-center justify-center border-gray-200 bg-gray-100 dark:!border-none">
                        <FileIcon fontSize={24} />
                        <p className="max-w-[80%] truncate text-xs">{item.originFile?.name}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // 单文件模式：保持原有布局
            value.map((item) => {
              const type = item?.fileType || item?.originFile?.type;
              return (
                <div
                  className="group relative h-full w-full overflow-hidden flex justify-center"
                  key={item.id}
                >
                  {!disabled && (
                    <RemoveAction
                      onClick={() => {
                        onChange?.(value.filter((_item) => _item.id !== item.id));
                      }}
                    />
                  )}
                  {type?.includes("image") ? (
                    <img src={item.url} className="aspect-auto h-full object-cover" />
                  ) : type?.includes("video") ? (
                    <video src={item.url} className="aspect-auto" />
                  ) : (
                    <div className="dark:!bg-navy-700 flex aspect-auto flex-col items-center justify-center border-gray-200 bg-gray-100 dark:!border-none">
                      <FileIcon fontSize={24} />
                      <p className="max-w-[50%] truncate">{item.url}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <>
          {defaultImg && (
            <div
              className={cn(
                "pointer-events-none absolute z-10 h-full w-full",
                className,
              )}
            >
              <img src={defaultImg} className="h-full w-full" />
            </div>
          )}
          <BaseUpload
            className={className}
            onFileSelect={(file) => handleFileChange([file])}
            onFileRemove={() => {}}
            accept={convertAcceptToString(accept)}
            maxSize={maxSize}
            isUploading={uploadLoading}
            multiple={multiple}
          />
        </>
      )}
    </>
  );
};

export default FormUpload; 