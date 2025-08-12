import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';
import { z } from "zod";

import { model } from "@/config/constants";
import { FluxHashids } from "@/db/dto/flux.dto";
import { prisma } from "@/db/prisma";
import { FluxTaskStatus } from "@/db/type";
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
        in: [FluxTaskStatus.Succeeded, FluxTaskStatus.Processing],
      },
    };
    if (model) {
      whereConditions.model = model;
    }

    // 获取Flux任务
    const [fluxData, fluxTotal] = await Promise.all([
      prisma.fluxData.findMany({
        where: whereConditions,
        take: pageSize,
        skip: offset,
        orderBy: { createdAt: "desc" },
      }),
      prisma.fluxData.count({ where: whereConditions }),
    ]);

    // 获取背景移除任务
    const backgroundRemovalTasks = await prisma.backgroundRemovalTask.findMany({
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
      taskStatus: task.taskStatus === "succeeded" ? FluxTaskStatus.Succeeded : FluxTaskStatus.Processing,
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

    // 转换Flux任务为统一格式
    const transformedFluxTasks = fluxData.map(
      ({ id, executeEndTime, executeStartTime, loraUrl, ...rest }) => ({
        ...rest,
        executeTime:
          executeEndTime && executeStartTime
            ? Number(`${executeEndTime - executeStartTime}`)
            : 0,
        id: FluxHashids.encode(id),
        taskType: "flux", // 添加任务类型标识
      }),
    );

    // 合并所有任务并按创建时间排序
    const allTasks = [...transformedFluxTasks, ...transformedBackgroundTasks]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, pageSize); // 重新分页

    return NextResponse.json({
      data: {
        total: fluxTotal + backgroundRemovalTasks.length,
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
