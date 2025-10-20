import { NextResponse, type NextRequest } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
// import { aiGateway } from "@/lib/ai-gateway"; // 已切换至 RunningHub，状态由 webhook 回写
import { findBackgroundRemovalTaskByReplicateId } from "@/db/queries/background-removal";
import { prisma } from "@/db/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    const { searchParams } = new URL(req.url);
    const dbOnly = searchParams.get('dbOnly') === 'true';
    
    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    console.log("🔍 查询任务状态:", taskId, dbOnly ? "(仅数据库)" : "(数据库优先)");

    // 首先从数据库查询任务记录
    const taskRecord = await findBackgroundRemovalTaskByReplicateId(taskId);
    
    if (!taskRecord) {
      console.log("❌ 未找到任务记录:", taskId);
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    console.log("✅ 找到任务记录:", {
      id: taskRecord.id,
      userId: taskRecord.userId || "anonymous",
      status: taskRecord.taskStatus
    });

    // 如果只查询数据库状态，直接返回
    if (dbOnly) {
      return NextResponse.json({
        success: true,
        taskId: taskId,
        status: taskRecord.taskStatus,
        output: taskRecord.outputImageUrl,
        error: taskRecord.errorMsg,
        taskRecordId: taskRecord.id,
        inputImageUrl: taskRecord.inputImageUrl,
        outputImageUrl: taskRecord.outputImageUrl,
        dbTaskStatus: taskRecord.taskStatus,
        createdAt: taskRecord.createdAt,
        executeStartTime: taskRecord.executeStartTime?.toString(),
        executeEndTime: taskRecord.executeEndTime?.toString()
      });
    }

    // RunningHub 模式：仅返回数据库状态（webhook 会写回最终状态）
    if (!['pending', 'starting', 'processing'].includes(taskRecord.taskStatus)) {
      // 任务已完成，直接返回数据库中的状态
      return NextResponse.json({
        success: true,
        taskId: taskId,
        status: taskRecord.taskStatus,
        output: taskRecord.outputImageUrl,
        error: taskRecord.errorMsg,
        // 数据库记录信息
        taskRecordId: taskRecord.id,
        inputImageUrl: taskRecord.inputImageUrl,
        outputImageUrl: taskRecord.outputImageUrl,
        dbTaskStatus: taskRecord.taskStatus,
        createdAt: taskRecord.createdAt,
        executeStartTime: taskRecord.executeStartTime?.toString(),
        executeEndTime: taskRecord.executeEndTime?.toString(),
        // 前端兼容字段
        id: taskId,
        taskStatus: taskRecord.taskStatus,
        imageUrl: taskRecord.outputImageUrl
      });
    }
    // 任务进行中：返回数据库当前状态
    return NextResponse.json({
      success: true,
      taskId: taskId,
      status: taskRecord.taskStatus,
      output: taskRecord.outputImageUrl,
      error: taskRecord.errorMsg,
      // 数据库记录信息
      taskRecordId: taskRecord.id,
      inputImageUrl: taskRecord.inputImageUrl,
      outputImageUrl: taskRecord.outputImageUrl,
      dbTaskStatus: taskRecord.taskStatus,
      createdAt: taskRecord.createdAt,
      executeStartTime: taskRecord.executeStartTime?.toString(),
      executeEndTime: taskRecord.executeEndTime?.toString(),
      // 前端兼容字段
      id: taskId,
      taskStatus: taskRecord.taskStatus,
      imageUrl: taskRecord.outputImageUrl
    });

  } catch (error) {
    console.error("❌ 查询任务状态失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
