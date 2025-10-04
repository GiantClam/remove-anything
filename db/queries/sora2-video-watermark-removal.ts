import { prisma } from "@/db/prisma";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

export interface UpdateSora2VideoWatermarkRemovalTaskData {
  replicateId?: string;
  taskStatus?: string;
  imageUrl?: string;
  executeStartTime?: bigint;
  executeEndTime?: bigint;
  errorMsg?: string;
}

/**
 * 根据RunningHub任务ID查找Sora2视频去水印任务
 */
export async function findSora2VideoWatermarkRemovalTaskByRunningHubId(runninghubTaskId: string) {
  console.log("🔍 开始查找Sora2视频去水印任务:", runninghubTaskId);
  
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过查找Sora2视频去水印任务");
    return null;
  }

  try {
    console.log("🔍 执行数据库查询，runninghubTaskId:", runninghubTaskId);
    const task = await prisma.fluxData.findFirst({
      where: { 
        replicateId: runninghubTaskId,
        model: "sora2-video-watermark-removal"
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    console.log("🔍 数据库查询结果:", task ? "找到任务" : "未找到任务");
    return task;
  } catch (error) {
    console.error("❌ 查找Sora2视频去水印任务失败:", error);
    throw error;
  }
}

/**
 * 更新Sora2视频去水印任务
 */
export async function updateSora2VideoWatermarkRemovalTask(taskId: number, data: UpdateSora2VideoWatermarkRemovalTaskData) {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过更新Sora2视频去水印任务");
    return { id: taskId };
  }

  try {
    const task = await prisma.fluxData.update({
      where: { id: taskId },
      data: data
    });

    console.log("✅ Sora2视频去水印任务更新成功:", task.id);
    return task;
  } catch (error) {
    console.error("❌ 更新Sora2视频去水印任务失败:", error);
    throw error;
  }
}

/**
 * 根据ID查找Sora2视频去水印任务
 */
export async function findSora2VideoWatermarkRemovalTaskById(id: number) {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过查找Sora2视频去水印任务");
    return null;
  }

  try {
    const task = await prisma.fluxData.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    return task;
  } catch (error) {
    console.error("❌ 查找Sora2视频去水印任务失败:", error);
    throw error;
  }
}
