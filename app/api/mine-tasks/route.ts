import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';
import { z } from "zod";

import { model } from "@/config/constants";
import { prisma } from "@/db/prisma";
import { TaskStatus } from "@/db/type";
import { getErrorMessage } from "@/lib/handle-error";
import { getUserBackgroundRemovalTasks } from "@/db/queries/background-removal";

const searchParamsSchema = z.object({
  page: z.coerce.number().default(1),
  pageSize: z.coerce.number().default(10),
  sort: z.string().optional(),
  model: z.enum([model.backgroundRemoval]).optional(),
});

export async function GET(req: NextRequest) {
  // 在构建时跳过数据库查询
  if (shouldSkipDatabaseQuery()) {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = user.id;
  
  // 开发模式：返回空数据
  const isDevMode = process.env.NODE_ENV === "development" && userId === "dev-user-123";
  if (isDevMode) {
    console.log("🔧 开发模式：使用测试用户账户");
    const url = new URL(req.url);
    const values = searchParamsSchema.parse(
      Object.fromEntries(url.searchParams),
    );
    const { page, pageSize } = values;
    
    return NextResponse.json({
      data: {
        total: 0,
        page,
        pageSize,
        data: [],
      },
    });
  }
  
  try {
    const url = new URL(req.url);
    const values = searchParamsSchema.parse(
      Object.fromEntries(url.searchParams),
    );
    const { page, pageSize, model } = values;
    const offset = (page - 1) * pageSize;
    const whereConditions: any = {
      userId,
      taskStatus: {
        in: [TaskStatus.Succeeded, TaskStatus.Processing],
      },
    };
    if (model) {
      whereConditions.model = model;
    }

    // 获取任务数据
    const [tasks, taskTotal, backgroundRemovalTasks] = await Promise.all([
      prisma.taskData.findMany({
        where: whereConditions,
        take: pageSize,
        skip: offset,
        orderBy: { createdAt: "desc" },
      }),
      prisma.taskData.count({ where: whereConditions }),
      prisma.backgroundRemovalTask.findMany({
        where: {
          userId,
          taskStatus: {
            in: ["succeeded", "processing", "pending", "starting"],
          },
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(pageSize, 50),
      }),
    ]);

    // 获取水印移除任务
    const watermarkRemovalTasks = await prisma.watermarkRemovalTask.findMany({
      where: {
        userId,
        taskStatus: {
          in: ["succeeded", "processing", "pending", "starting"],
        },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(pageSize, 50), // 限制数量，避免过多数据
    });

    // 转换背景移除任务为统一格式
    const transformedBackgroundTasks = backgroundRemovalTasks.map((task) => ({
      id: task.replicateId, // 使用replicateId作为id
      imageUrl: task.outputImageUrl,
      inputImageUrl: task.inputImageUrl,
      inputPrompt: "Background Removal", // 背景移除没有prompt，使用固定值
      taskStatus: task.taskStatus === "succeeded" ? TaskStatus.Succeeded : TaskStatus.Processing,
      model: task.model,
      createdAt: task.createdAt,
      userId: task.userId,
      isPrivate: !task.isPublic,
      aspectRatio: task.resolution || "1024x1024",
      executeTime: task.executeEndTime && task.executeStartTime 
        ? Number(`${task.executeEndTime - task.executeStartTime}`)
        : 0,
      taskType: "background-removal", // 添加任务类型标识
    }));

    // 转换水印移除任务为统一格式
    const transformedWatermarkTasks = watermarkRemovalTasks.map((task) => ({
      id: task.runninghubTaskId || task.id.toString(), // 使用runninghubTaskId或id作为标识
      imageUrl: task.outputZipUrl || task.inputZipUrl, // 如果有输出文件则使用，否则使用输入文件
      inputImageUrl: task.inputZipUrl, // 使用inputZipUrl作为输入图片URL
      inputPrompt: "Watermark Removal", // 水印移除没有prompt，使用固定值
      taskStatus: task.taskStatus === "succeeded" ? TaskStatus.Succeeded : TaskStatus.Processing,
      model: "watermark-removal",
      createdAt: task.createdAt,
      userId: task.userId,
      isPrivate: !task.isPublic,
      aspectRatio: "1024x1024", // 水印移除默认分辨率
      executeTime: 0, // 水印移除暂时不计算执行时间
      taskType: "watermark-removal", // 添加任务类型标识
    }));

    // 查询 Sora2 视频去水印任务（从 TaskData 表中筛选）
    const sora2VideoTasks = tasks.filter((task) => 
      task.model === "sora2-video-watermark-removal"
    );

    // 转换 Sora2 视频去水印任务为统一格式
    const transformedSora2VideoTasks = sora2VideoTasks.map((task) => ({
      id: task.replicateId || task.id.toString(), // 使用replicateId或id作为标识
      imageUrl: task.imageUrl || task.inputImageUrl, // 使用imageUrl或inputImageUrl作为视频URL
      inputImageUrl: task.inputImageUrl, // 使用inputImageUrl作为输入视频URL
      inputPrompt: task.inputPrompt || "Sora2 Video Watermark Removal",
      taskStatus: task.taskStatus === "succeeded" ? TaskStatus.Succeeded : TaskStatus.Processing,
      model: task.model,
      createdAt: task.createdAt,
      userId: task.userId,
      isPrivate: task.isPrivate || false,
      aspectRatio: task.aspectRatio || "16:9", // 视频默认比例
      executeTime: task.executeEndTime && task.executeStartTime 
        ? Number(`${task.executeEndTime - task.executeStartTime}`)
        : 0,
      taskType: "sora2-video-watermark-removal", // 添加任务类型标识
    }));

    // 合并所有任务并按创建时间排序
    const allTasks = [...transformedBackgroundTasks, ...transformedWatermarkTasks, ...transformedSora2VideoTasks]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, pageSize); // 重新分页

    return NextResponse.json({
      data: {
        total: backgroundRemovalTasks.length + watermarkRemovalTasks.length + sora2VideoTasks.length,
        page,
        pageSize,
        data: allTasks,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
