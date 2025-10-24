"use client";

import React, { useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/shared/icons";
import { EmptyPlaceholder } from "@/components/shared/empty-placeholder";
import Loading from "@/components/loading/index";
import { DownloadAction } from "@/components/history/download-action";
import { FluxTaskStatus } from "@/components/playground";
import { FluxSelectDto } from "@/db/type";
import { Link } from "@/lib/navigation";
import copy from "copy-to-clipboard";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import BlurFade from "@/components/magicui/blur-fade";
import PlaygroundLoading from "@/components/playground/loading";

interface DashboardHomeProps {
  locale: string;
}

export default function DashboardHome({ locale }: DashboardHomeProps) {
  const { userId } = useAuth();
  const t = useTranslations("DashboardHome");
  const [activeTab, setActiveTab] = useState("watermark");

  // 获取水印移除历史记录
  const { data: watermarkHistory, isLoading: watermarkLoading } = useQuery({
    queryKey: ["watermark-history", userId],
    queryFn: async () => {
      const response = await fetch("/api/mine-flux?page=1&pageSize=12", {
        credentials: 'include',
      });
      if (response.ok) {
        const result = await response.json();
        console.log("🔍 Watermark removal API response:", result);
        // 过滤出水印移除任务
        const filteredTasks = result.data?.data?.filter((task: FluxSelectDto) => 
          task.taskType === "watermark-removal"
        ) || [];
        console.log("🔍 Filtered watermark tasks:", filteredTasks);
        return filteredTasks;
      }
      return [];
    },
    enabled: !!userId,
  });

  // 获取背景移除历史记录
  const { data: backgroundHistory, isLoading: backgroundLoading } = useQuery({
    queryKey: ["background-history", userId],
    queryFn: async () => {
      const response = await fetch("/api/mine-flux?page=1&pageSize=12", {
        credentials: 'include',
      });
      if (response.ok) {
        const result = await response.json();
        console.log("🔍 Background removal API response:", result);
        // 过滤出背景移除任务
        const filteredTasks = result.data?.data?.filter((task: FluxSelectDto) => 
          task.taskType === "background-removal"
        ) || [];
        console.log("🔍 Filtered background tasks:", filteredTasks);
        return filteredTasks;
      }
      return [];
    },
    enabled: !!userId,
  });

  // 获取 Sora2 视频去水印历史记录
  const { data: sora2VideoHistory, isLoading: sora2VideoLoading } = useQuery({
    queryKey: ["sora2-video-history", userId],
    queryFn: async () => {
      const response = await fetch("/api/mine-flux?page=1&pageSize=12", {
        credentials: 'include',
      });
      if (response.ok) {
        const result = await response.json();
        console.log("🔍 Sora2 video watermark removal API response:", result);
        // 过滤出 Sora2 视频去水印任务
        const filteredTasks = result.data?.data?.filter((task: FluxSelectDto) => 
          task.taskType === "sora2-video-watermark-removal"
        ) || [];
        console.log("🔍 Filtered Sora2 video tasks:", filteredTasks);
        return filteredTasks;
      }
      return [];
    },
    enabled: !!userId,
  });

  // 复制taskid
  const copyTaskId = (taskId: string) => {
    copy(taskId);
    toast.success(t("taskIdCopied"));
  };

  // 获取任务状态显示文本
  const getStatusText = (status: string) => {
    switch (status) {
      case FluxTaskStatus.Succeeded:
        return t("status.succeeded");
      case FluxTaskStatus.Processing:
        return t("status.processing");
      case FluxTaskStatus.Failed:
        return t("status.failed");
      case "pending":
        return t("status.pending");
      default:
        return status;
    }
  };

  // 获取任务状态样式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case FluxTaskStatus.Succeeded:
        return "bg-green-100 text-green-800";
      case FluxTaskStatus.Processing:
        return "bg-yellow-100 text-yellow-800";
      case FluxTaskStatus.Failed:
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <main className="grid flex-1 items-start gap-4 py-4 sm:py-0 md:gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="watermark">{t("tabs.watermark")}</TabsTrigger>
          <TabsTrigger value="background">{t("tabs.background")}</TabsTrigger>
          <TabsTrigger value="sora2video">{t("tabs.sora2video")}</TabsTrigger>
        </TabsList>

        <TabsContent value="watermark" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icons.eraser className="h-5 w-5" />
                {t("watermarkHistory.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {watermarkLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loading />
                </div>
              ) : watermarkHistory && watermarkHistory.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {watermarkHistory.map((item: FluxSelectDto, index: number) => (
                    <div
                      key={item.id}
                      className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground mb-1">
                            {t("watermarkHistory.task")} #{index + 1}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            ID: {item.id}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyTaskId(item.id)}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Badge className={getStatusStyle(item.taskStatus)}>
                            {getStatusText(item.taskStatus)}
                          </Badge>
                        </div>
                      </div>

                      <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                        {item.taskStatus === FluxTaskStatus.Processing ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <PlaygroundLoading />
                          </div>
                        ) : (
                          <BlurFade
                            key={item.imageUrl}
                            delay={0.25 + index * 0.05}
                            inView
                          >
                            <img
                              src={item.imageUrl || item.inputImageUrl || ""}
                              alt={`AI watermark removal result: ${item.inputPrompt || 'processed image'}`}
                              className="w-full h-full object-cover"
                            />
                          </BlurFade>
                        )}
                      </div>

                      {item.taskStatus === FluxTaskStatus.Succeeded && (
                        <div className="space-y-2">
                          <DownloadAction
                            disabled={false}
                            id={item.id}
                            taskType="watermark-removal"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        <span className="font-mono">{item.taskType}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPlaceholder>
                  <EmptyPlaceholder.Icon name="media" />
                  <EmptyPlaceholder.Title>
                    {t("watermarkHistory.empty.title")}
                  </EmptyPlaceholder.Title>
                  <EmptyPlaceholder.Description>
                    {t("watermarkHistory.empty.description")}
                  </EmptyPlaceholder.Description>
                  <Button asChild>
                    <Link href="/app/watermark-removal">
                      {t("watermarkHistory.empty.action")}
                    </Link>
                  </Button>
                </EmptyPlaceholder>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="background" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icons.eraser className="h-5 w-5" />
                {t("backgroundHistory.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {backgroundLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loading />
                </div>
              ) : backgroundHistory && backgroundHistory.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {backgroundHistory.map((item: FluxSelectDto, index: number) => (
                    <div
                      key={item.id}
                      className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground mb-1">
                            {t("backgroundHistory.task")} #{index + 1}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            ID: {item.id}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyTaskId(item.id)}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Badge className={getStatusStyle(item.taskStatus)}>
                            {getStatusText(item.taskStatus)}
                          </Badge>
                        </div>
                      </div>

                      <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                        {item.taskStatus === FluxTaskStatus.Processing ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <PlaygroundLoading />
                          </div>
                        ) : (
                          <BlurFade
                            key={item.imageUrl}
                            delay={0.25 + index * 0.05}
                            inView
                          >
                            <img
                              src={item.imageUrl || item.inputImageUrl || ""}
                              alt={`AI background removal result: ${item.inputPrompt || 'processed image'}`}
                              className="w-full h-full object-cover"
                            />
                          </BlurFade>
                        )}
                      </div>

                      {item.taskStatus === FluxTaskStatus.Succeeded && (
                        <div className="space-y-2">
                          <DownloadAction
                            disabled={false}
                            id={item.id}
                            taskType="background-removal"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        <span className="font-mono">{item.taskType}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPlaceholder>
                  <EmptyPlaceholder.Icon name="media" />
                  <EmptyPlaceholder.Title>
                    {t("backgroundHistory.empty.title")}
                  </EmptyPlaceholder.Title>
                  <EmptyPlaceholder.Description>
                    {t("backgroundHistory.empty.description")}
                  </EmptyPlaceholder.Description>
                  <Button asChild>
                    <Link href="/app/remove-background">
                      {t("backgroundHistory.empty.action")}
                    </Link>
                  </Button>
                </EmptyPlaceholder>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sora2video" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icons.Video className="h-5 w-5" />
                {t("sora2VideoHistory.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sora2VideoLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loading />
                </div>
              ) : sora2VideoHistory && sora2VideoHistory.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sora2VideoHistory.map((item: FluxSelectDto, index: number) => (
                    <div
                      key={item.id}
                      className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground mb-1">
                            {t("sora2VideoHistory.task")} #{index + 1}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            ID: {item.id}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyTaskId(item.id)}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Badge className={getStatusStyle(item.taskStatus)}>
                            {getStatusText(item.taskStatus)}
                          </Badge>
                        </div>
                      </div>

                      <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                        {item.taskStatus === FluxTaskStatus.Processing ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <PlaygroundLoading />
                          </div>
                        ) : (
                          <BlurFade
                            key={item.imageUrl}
                            delay={0.25 + index * 0.05}
                            inView
                          >
                            <video
                              src={item.imageUrl || item.inputImageUrl || ""}
                              className="w-full h-full object-cover"
                              controls
                              muted
                            />
                          </BlurFade>
                        )}
                      </div>

                      {item.taskStatus === FluxTaskStatus.Succeeded && (
                        <div className="space-y-2">
                          <DownloadAction
                            disabled={false}
                            id={item.id}
                            taskType="sora2-video-watermark-removal"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        <span className="font-mono">{item.taskType}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPlaceholder>
                  <EmptyPlaceholder.Icon name="media" />
                  <EmptyPlaceholder.Title>
                    {t("sora2VideoHistory.empty.title")}
                  </EmptyPlaceholder.Title>
                  <EmptyPlaceholder.Description>
                    {t("sora2VideoHistory.empty.description")}
                  </EmptyPlaceholder.Description>
                  <Button asChild>
                    <Link href="/app/sora2-video-watermark-removal">
                      {t("sora2VideoHistory.empty.action")}
                    </Link>
                  </Button>
                </EmptyPlaceholder>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
