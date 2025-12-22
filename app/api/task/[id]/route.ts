import { NextResponse, type NextRequest } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
// import { aiGateway } from "@/lib/ai-gateway"; // 已切换至 RunningHub，状态由 webhook 回写
import { findBackgroundRemovalTaskByReplicateId } from "@/db/queries/background-removal";
import { prisma } from "@/db/prisma";
import { runninghubAPI } from "@/modules/runninghub";

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

    // 首先从数据库查询任务记录（如果数据库不可用，则进入降级）
    let taskRecord: any | null = null;
    let dbFailed = false;
    try {
      taskRecord = await findBackgroundRemovalTaskByReplicateId(taskId);
    } catch (e) {
      dbFailed = true;
      console.warn("⚠️ 数据库查询失败，启用RunningHub降级模式:", (e as any)?.message || e);
    }
    
    if (!taskRecord && !dbFailed) {
      console.log("❌ 未找到任务记录:", taskId);
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (taskRecord) {
      console.log("✅ 找到任务记录:", {
        id: taskRecord.id,
        userId: taskRecord.userId || "anonymous",
        status: taskRecord.taskStatus
      });
    }

    // 如果只查询数据库状态，直接返回
    if (taskRecord && dbOnly) {
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

    // 如果数据库可用且记录处于终态，直接返回数据库状态
    if (taskRecord && !['pending', 'starting', 'processing'].includes(taskRecord.taskStatus)) {
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

    // 降级逻辑：数据库不可用或记录仍在处理中，直接查询 RunningHub
    console.log("🟡 启用 RunningHub 降级查询: ", taskId);
    try {
      const statusResp = await runninghubAPI.getTaskStatus(taskId);
      let status: string | undefined;
      if (statusResp && typeof statusResp === 'object' && statusResp.code === 0 && statusResp.data) {
        if (typeof statusResp.data === 'string') status = statusResp.data;
        else if (typeof (statusResp as any).data.status === 'string') status = (statusResp as any).data.status;
      }

      let output: string | null = null;
      if (status === 'SUCCESS' || status === 'succeeded') {
        const result = await runninghubAPI.getTaskResult(taskId);
        if (result?.data && Array.isArray(result.data) && result.data.length > 0) {
          output = result.data[0]?.fileUrl || null;
        }
      }

      return NextResponse.json({
        success: true,
        taskId,
        status: status || (taskRecord?.taskStatus ?? 'unknown'),
        output: output || taskRecord?.outputImageUrl || null,
        error: taskRecord?.errorMsg || null,
        // 标记为降级来源
        fallback: true,
      });
    } catch (fallbackErr) {
      console.error("❌ RunningHub 降级查询失败:", fallbackErr);
      // 如果数据库有记录则至少返回数据库状态
      if (taskRecord) {
        return NextResponse.json({
          success: true,
          taskId,
          status: taskRecord.taskStatus,
          output: taskRecord.outputImageUrl,
          error: taskRecord.errorMsg,
          degraded: true,
        });
      }
      // 否则返回错误
      return NextResponse.json({ error: "Task query failed" }, { status: 500 });
    }

  } catch (error) {
    console.error("❌ 查询任务状态失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
