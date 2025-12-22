/**
 * 任务状态同步模块
 * 提供通用的任务状态查询和同步功能，支持多种任务类型（RunningHub、Replicate 等）
 */

import type { TaskRecord, TaskRepository } from "./sdk";

/**
 * 任务状态提供者接口
 * 不同的任务平台（RunningHub、Replicate）需要实现此接口
 */
export interface TaskStatusProvider {
  /**
   * 获取任务状态
   * @param externalTaskId 外部任务 ID（如 RunningHub taskId、Replicate predictionId）
   * @returns 任务状态信息
   */
  getTaskStatus(externalTaskId: string): Promise<TaskStatusResult>;

  /**
   * 获取任务结果（当任务成功时）
   * @param externalTaskId 外部任务 ID
   * @returns 任务结果（通常是输出文件的 URL）
   */
  getTaskResult?(externalTaskId: string): Promise<TaskResult>;
}

/**
 * 任务状态结果
 */
export interface TaskStatusResult {
  status: TaskStatus;
  error?: string;
  data?: any; // 原始响应数据
}

/**
 * 任务结果
 */
export interface TaskResult {
  outputUrl?: string | string[]; // 输出文件 URL（可能是单个或多个）
  metadata?: Record<string, any>; // 其他元数据
}

/**
 * 任务状态枚举
 */
export type TaskStatus = "processing" | "succeeded" | "failed" | "queued" | "pending";

/**
 * 状态同步选项
 */
export interface SyncOptions {
  /**
   * 是否在任务成功时自动获取结果
   * @default true
   */
  fetchResultOnSuccess?: boolean;

  /**
   * 结果处理函数（可选）
   * 可以用于自定义结果处理逻辑，如上传到 R2、转换格式等
   */
  onResultFetched?: (result: TaskResult, taskRecord: TaskRecord) => Promise<string | null>;
}

/**
 * 同步单个任务状态
 */
export async function syncTaskStatus(
  taskRecord: TaskRecord,
  statusProvider: TaskStatusProvider,
  repository: TaskRepository,
  options: SyncOptions = {}
): Promise<{ status: TaskStatus; updated: boolean }> {
  const { fetchResultOnSuccess = true, onResultFetched } = options;

  if (!taskRecord.externalTaskId) {
    return { status: taskRecord.status as TaskStatus, updated: false };
  }

  try {
    const statusResult = await statusProvider.getTaskStatus(taskRecord.externalTaskId);
    const newStatus = statusResult.status;

    // 标准化当前状态用于比较（统一转为小写）
    const currentStatusNormalized = String(taskRecord.status).toLowerCase();
    const newStatusNormalized = String(newStatus).toLowerCase();

    // 如果状态没有变化，不需要更新
    if (newStatusNormalized === currentStatusNormalized) {
      return { status: newStatus, updated: false };
    }

    // 将通用状态转换为数据库状态格式
    const dbStatus = newStatus === "succeeded" ? "Succeeded" 
                   : newStatus === "failed" ? "Failed"
                   : newStatus === "processing" ? "Processing"
                   : newStatus === "queued" ? "Processing"
                   : newStatus === "pending" ? "Processing"
                   : "Processing";
    
    let updateData: Partial<TaskRecord> = {
      status: dbStatus,
    };

    // 处理成功状态
    if (newStatus === "succeeded") {
      if (fetchResultOnSuccess && statusProvider.getTaskResult) {
        try {
          const result = await statusProvider.getTaskResult(taskRecord.externalTaskId!);
          
          // 如果有自定义结果处理函数，使用它
          if (onResultFetched) {
            const outputUrl = await onResultFetched(result, taskRecord);
            if (outputUrl) {
              updateData.outputUrl = outputUrl;
            }
          } else {
            // 默认处理：使用第一个输出 URL
            const outputUrl = Array.isArray(result.outputUrl)
              ? result.outputUrl[0]
              : result.outputUrl;
            if (outputUrl) {
              updateData.outputUrl = outputUrl;
            }
          }
        } catch (resultError: any) {
          console.warn(`获取任务结果失败: ${resultError.message}`);
          // 即使获取结果失败，也更新状态为成功
        }
      }
    }

    // 处理失败状态
    if (newStatus === "failed") {
      updateData.errorMsg = statusResult.error || "Task failed";
    }

    // 更新数据库
    await repository.update(taskRecord.id, updateData);

    return { status: newStatus, updated: true };
  } catch (error: any) {
    console.error(`同步任务状态失败: ${error.message}`);
    return { status: taskRecord.status as TaskStatus, updated: false };
  }
}

/**
 * 批量同步任务状态
 */
export async function syncTasksBatch(
  taskRecords: TaskRecord[],
  statusProvider: TaskStatusProvider,
  repository: TaskRepository,
  options: SyncOptions = {}
): Promise<{
  total: number;
  updated: number;
  succeeded: number;
  failed: number;
  stillProcessing: number;
  errors: string[];
}> {
  const results = {
    total: taskRecords.length,
    updated: 0,
    succeeded: 0,
    failed: 0,
    stillProcessing: 0,
    errors: [] as string[],
  };

  for (const taskRecord of taskRecords) {
    try {
      const syncResult = await syncTaskStatus(taskRecord, statusProvider, repository, options);
      
      if (syncResult.updated) {
        results.updated++;
        if (syncResult.status === "succeeded") {
          results.succeeded++;
        } else if (syncResult.status === "failed") {
          results.failed++;
        }
      } else {
        if (syncResult.status === "processing" || syncResult.status === "queued" || syncResult.status === "pending") {
          results.stillProcessing++;
        }
      }
    } catch (error: any) {
      const errorMsg = `任务 ${taskRecord.id} 同步失败: ${error.message}`;
      results.errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }
  }

  return results;
}

/**
 * 创建 RunningHub 状态提供者
 */
export function createRunningHubStatusProvider(
  runningHubClient: { getTaskStatus: (taskId: string) => Promise<any>; getTaskResult?: (taskId: string) => Promise<any> }
): TaskStatusProvider {
  return {
    async getTaskStatus(externalTaskId: string): Promise<TaskStatusResult> {
      const result = await runningHubClient.getTaskStatus(externalTaskId);
      
      // 处理不同的响应格式
      const taskStatus = typeof result.data === 'string' 
        ? result.data 
        : result.data?.taskStatus || result.data?.status || result.data;
      
      const status = normalizeStatus(taskStatus);
      
      return {
        status,
        error: result.data?.error,
        data: result,
      };
    },

    async getTaskResult(externalTaskId: string): Promise<TaskResult> {
      if (!runningHubClient.getTaskResult) {
        throw new Error("getTaskResult not implemented");
      }
      
      const result = await runningHubClient.getTaskResult(externalTaskId);
      
      // 处理不同的响应格式
      let outputUrl: string | string[] | undefined;
      if (Array.isArray(result.data)) {
        outputUrl = result.data.map((item: any) => item.fileUrl || item.url || item).filter(Boolean);
      } else if (result.data?.fileUrl || result.data?.url) {
        outputUrl = result.data.fileUrl || result.data.url;
      }
      
      return {
        outputUrl,
        metadata: result.data,
      };
    },
  };
}

/**
 * 创建 Replicate 状态提供者
 */
export function createReplicateStatusProvider(
  replicateClient: { getTaskStatus: (predictionId: string) => Promise<any> }
): TaskStatusProvider {
  return {
    async getTaskStatus(externalTaskId: string): Promise<TaskStatusResult> {
      const result = await replicateClient.getTaskStatus(externalTaskId);
      
      const status = normalizeStatus(result.status);
      
      return {
        status,
        error: result.error?.message || result.error,
        data: result,
      };
    },

    async getTaskResult(externalTaskId: string): Promise<TaskResult> {
      // Replicate 的结果通常在 status 响应中
      const result = await replicateClient.getTaskStatus(externalTaskId);
      
      let outputUrl: string | string[] | undefined;
      if (Array.isArray(result.output)) {
        outputUrl = result.output;
      } else if (result.output) {
        outputUrl = result.output;
      }
      
      return {
        outputUrl,
        metadata: result,
      };
    },
  };
}

/**
 * 标准化状态字符串
 */
function normalizeStatus(status: any): TaskStatus {
  if (!status) return "processing";
  
  const statusStr = String(status).toLowerCase();
  
  if (["success", "succeeded", "completed"].includes(statusStr)) {
    return "succeeded";
  }
  if (["failed", "failure", "error"].includes(statusStr)) {
    return "failed";
  }
  if (["queued", "pending"].includes(statusStr)) {
    return "queued";
  }
  if (["running", "processing", "starting"].includes(statusStr)) {
    return "processing";
  }
  
  return "processing";
}

