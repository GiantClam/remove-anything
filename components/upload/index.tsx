"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { FileIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { Accept } from "react-dropzone";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

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
  const { userId, isSignedIn } = useAuth();

  return useMutation({
    mutationFn: async (values: any = {}) => {
      // 如果用户未登录，直接返回错误，让组件使用本地文件处理
      if (!isSignedIn) {
        throw new Error("User not authenticated - use local file handling");
      }
      
      return fetch(`/api/s3/sts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    accept,
    maxSize = 10 * 1024 * 1024, // 10MB
    maxFiles = 10, // 默认最多10个文件
    multiple = false, // 默认单文件上传
    disabled,
    className,
    previewClassName,
    defaultImg,
  } = props;

  const t = useTranslations("Upload");
  const [uploadLoading, setUploadLoading] = useState(false);
  const { userId, isSignedIn } = useAuth();
  const getLicenseSts = useGetLicenseSts();

  const handleFileChange = async (files: File[]) => {
    console.log("🔧 Upload 组件：handleFileChange 被调用", { filesLength: files.length, files });
    
    if (files.length) {
      try {
        setUploadLoading(true);
        
        // 检查文件数量限制
        if (multiple && value.length + files.length > maxFiles) {
          toast.error(t("maxFilesLimit", { count: maxFiles }));
          return;
        }
        
        // 如果不是多文件模式，只处理第一个文件
        const filesToProcess = multiple ? files : [files[0]];
        
        // 先添加到列表中，状态为上传中
        const newItems: UploadValue[] = filesToProcess.map((file) => ({
          id: nanoid(),
          url: "",
          completedUrl: "",
          status: "uploading",
          originFile: file,
          fileType: file.type,
        }));

        if (multiple) {
          // 多文件模式，添加到列表
          onChange?.([...value, ...newItems]);
        } else {
          // 单文件模式，替换现有文件
          onChange?.(newItems);
        }

        // 如果用户已登录，使用STS上传到R2
        if (isSignedIn) {
          try {
            // 逐个文件获取 STS 并直传 PUT 到 R2
            const uploadResults = await Promise.all(
              filesToProcess.map(async (file) => {
                const ext = file.type && file.type.includes('/') ? file.type.split('/')[1] : 'bin';
                const filename = `${nanoid()}.${ext}`;
                const stsResult: any = await getLicenseSts.mutateAsync({
                  key: filename,
                  fileType: file.type,
                });

                if (!stsResult?.data?.putUrl) {
                  throw new Error('Failed to get STS putUrl');
                }

                const putRes = await fetch(stsResult.data.putUrl, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': file.type || 'application/octet-stream',
                  },
                  body: file,
                });

                if (!putRes.ok) {
                  throw new Error(`PUT upload failed with status ${putRes.status}`);
                }

                return {
                  completedUrl: stsResult.data.completedUrl as string,
                  key: stsResult.data.key as string,
                  fileType: file.type,
                };
              })
            );

            // 按顺序更新对应的文件状态
            const updatedItems = newItems.map((item, idx) => {
              const r = uploadResults[idx];
              return {
                ...item,
                status: 'uploaded' as const,
                url: r?.completedUrl || item.url,
                completedUrl: r?.completedUrl || item.completedUrl,
                key: r?.key || item.key,
                fileType: r?.fileType || item.fileType,
              };
            });

            if (multiple) {
              onChange?.([...value, ...updatedItems]);
            } else {
              onChange?.(updatedItems);
            }

            console.log("🔧 Upload 组件：STS上传完成，更新文件状态", {
              items: updatedItems,
            });
          } catch (error) {
            console.error("🔧 STS上传失败:", error);
            // 用户未登录，使用本地文件处理
            console.log("🔧 匿名用户：使用本地文件处理模式");
            
            // 创建本地文件URL（用于预览）
            const localItems = newItems.map((item) => ({
              ...item,
              status: "uploaded" as const,
              url: URL.createObjectURL(item.originFile!),
              originFile: item.originFile,  // 保存原始文件对象，供后续API使用
            }));

            // 更新对应的文件状态
            if (multiple) {
              onChange?.([...value, ...localItems]);
            } else {
              onChange?.(localItems);
            }

            console.log("🔧 Upload 组件：本地文件处理完成，更新文件状态", {
              items: localItems,
            });
          }
        } else {
          // 用户未登录，使用本地文件处理
          console.log("🔧 匿名用户：使用本地文件处理模式");
          
          // 创建本地文件URL（用于预览）
          const localItems = newItems.map((item) => ({
            ...item,
            status: "uploaded" as const,
            url: URL.createObjectURL(item.originFile!),
            originFile: item.originFile,  // 保存原始文件对象，供后续API使用
          }));

          // 更新对应的文件状态
          if (multiple) {
            onChange?.([...value, ...localItems]);
          } else {
            onChange?.(localItems);
          }

          console.log("🔧 Upload 组件：本地文件处理完成，更新文件状态", {
            items: localItems,
          });
        }
        
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
                        <div className="text-white text-sm">{t("uploading")}</div>
                      </div>
                    )}
                    {item.status === 'error' && (
                      <div className="absolute inset-0 bg-red-500 bg-opacity-50 flex items-center justify-center">
                        <div className="text-white text-xs text-center">{t("uploadFailed")}</div>
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