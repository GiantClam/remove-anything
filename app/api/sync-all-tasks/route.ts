import { NextResponse } from "next/server";
import { prisma } from "@/db/prisma";
import { runninghubAPI } from "@/lib/runninghub-api";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log("🔄 开始批量同步所有任务");
    
    // 查找所有进行中的任务
    const processingTasks = await prisma.backgroundRemovalTask.findMany({
      where: { 
        taskStatus: { in: ['pending', 'starting', 'processing'] },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log(`📋 找到 ${processingTasks.length} 个进行中的任务`);

    const results = [];

    for (const task of processingTasks) {
      try {
        console.log(`🔍 同步任务: ${task.replicateId}`);
        
        // 检查 RunningHub 状态
        const statusResp = await runninghubAPI.getTaskStatus(task.replicateId);
        let status: string | undefined;
        
        if (statusResp && typeof statusResp === 'object') {
          if (statusResp.code === 0 && statusResp.data) {
            if (typeof statusResp.data === 'string') {
              status = statusResp.data;
            } else if (statusResp.data && typeof statusResp.data.status === 'string') {
              status = statusResp.data.status;
            }
          }
        }

        let updateData: any = {};
        let syncResult = "no_change";

        if (status === 'SUCCESS' || status === 'succeeded') {
          // 获取结果
          const result = await runninghubAPI.getTaskResult(task.replicateId);
          let outputUrl: string | null = null;
          
          if (result?.data && Array.isArray(result.data) && result.data.length > 0) {
            outputUrl = result.data[0]?.fileUrl || null;
          }
          
          updateData = {
            taskStatus: 'succeeded',
            outputImageUrl: outputUrl,
            executeEndTime: BigInt(Date.now())
          };
          
          syncResult = "succeeded";
          console.log(`✅ 任务成功: ${task.replicateId}`);
          
        } else if (status === 'FAILED' || status === 'failed') {
          updateData = {
            taskStatus: 'failed',
            executeEndTime: BigInt(Date.now()),
            errorMsg: 'Task failed on RunningHub'
          };
          
          syncResult = "failed";
          console.log(`❌ 任务失败: ${task.replicateId}`);
          
        } else if (status === 'RUNNING' || status === 'running' || status === 'Processing' || status === 'processing') {
          updateData = {
            taskStatus: 'processing',
            executeStartTime: BigInt(Date.now())
          };
          
          syncResult = "processing";
          console.log(`🔄 任务进行中: ${task.replicateId}`);
        }

        // 更新数据库
        if (Object.keys(updateData).length > 0) {
          await prisma.backgroundRemovalTask.update({
            where: { replicateId: task.replicateId },
            data: updateData
          });
        }

        results.push({
          taskId: task.replicateId,
          oldStatus: task.taskStatus,
          newStatus: updateData.taskStatus || task.taskStatus,
          runninghubStatus: status,
          syncResult: syncResult,
          updated: Object.keys(updateData).length > 0
        });

      } catch (error) {
        console.error(`❌ 同步任务失败: ${task.replicateId}`, error);
        results.push({
          taskId: task.replicateId,
          oldStatus: task.taskStatus,
          error: error.message,
          syncResult: "error"
        });
      }
    }

    const successCount = results.filter(r => r.syncResult === 'succeeded').length;
    const failedCount = results.filter(r => r.syncResult === 'failed').length;
    const processingCount = results.filter(r => r.syncResult === 'processing').length;
    const errorCount = results.filter(r => r.syncResult === 'error').length;

    console.log(`📊 同步完成: 成功 ${successCount}, 失败 ${failedCount}, 进行中 ${processingCount}, 错误 ${errorCount}`);

    return NextResponse.json({
      success: true,
      message: `批量同步完成: 成功 ${successCount}, 失败 ${failedCount}, 进行中 ${processingCount}, 错误 ${errorCount}`,
      totalTasks: processingTasks.length,
      results: results,
      summary: {
        succeeded: successCount,
        failed: failedCount,
        processing: processingCount,
        errors: errorCount
      }
    });

  } catch (error) {
    console.error("❌ 批量同步失败:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Batch sync failed", 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
