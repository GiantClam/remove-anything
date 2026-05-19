import { prisma } from "@/db/prisma";
import { TASK_QUEUE_CONFIG } from "@/config/constants";
import { taskProcessor } from "./task-processor";
import { runninghubAPI } from "@/modules/runninghub";
import { env } from "@/env.mjs";
import { nanoid } from 'nanoid';
import { createR2S3Service } from "@/lib/r2-s3";

export interface TaskQueueItem {
  id: string;
  userId: string | null;
  taskType: string;
  priority: number;
  createdAt: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting';
  metadata?: any;
  retryCount?: number;
  runninghubTaskId?: string; // RunningHub 任务 ID
  retryTimer?: NodeJS.Timeout; // 重试定时器
}

class TaskQueueManager {
  private static instance: TaskQueueManager;
  private runningTasks: Map<string, TaskQueueItem> = new Map();
  private queue: TaskQueueItem[] = [];
  private waitingTasks: Map<string, TaskQueueItem> = new Map(); // 等待重试的任务
  private isProcessing = false;
  private statusWatchers: Map<string, NodeJS.Timeout> = new Map(); // key: runninghubTaskId
  private watcherConfig = {
    intervalMs: 2000, // 2秒轮询一次，更频繁
    maxMinutes: 15,
  };

  public getMaxConcurrent(): number {
    return TASK_QUEUE_CONFIG.MAX_CONCURRENT_TASKS;
  }

  private constructor() {}

  public static getInstance(): TaskQueueManager {
    if (!TaskQueueManager.instance) {
      TaskQueueManager.instance = new TaskQueueManager();
    }
    return TaskQueueManager.instance;
  }

  /**
   * 添加任务到队列
   */
  public async addTask(task: Omit<TaskQueueItem, 'id' | 'createdAt' | 'status'>): Promise<{ taskId: string; queuePosition: number }> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queueItem: TaskQueueItem = {
      ...task,
      id: taskId,
      createdAt: new Date(),
      status: 'pending',
    };

    // 如果并发已满且队列长度超过阈值，抛出错误给前端快速失败
    const availableSlots = TASK_QUEUE_CONFIG.MAX_CONCURRENT_TASKS - this.runningTasks.size;
    const tooBusy = availableSlots <= 0 && this.queue.length >= TASK_QUEUE_CONFIG.MAX_CONCURRENT_TASKS;
    if (tooBusy) {
      const error: any = new Error('TASK_QUEUE_MAXED');
      (error.code as string) = 'TASK_QUEUE_MAXED';
      throw error;
    }

    // 添加到队列
    this.queue.push(queueItem);
    
    // 按优先级排序 (数字越小优先级越高)
    this.queue.sort((a, b) => a.priority - b.priority);

    const queuePosition = this.queue.findIndex(item => item.id === taskId) + 1;

    console.log(`📝 任务 ${taskId} 已添加到队列，位置: ${queuePosition}`);

    // 尝试处理队列
    this.processQueue();

    return { taskId, queuePosition };
  }

  /**
   * 处理队列
   */
  private async processQueue() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // 检查是否有空闲槽位
      const availableSlots = TASK_QUEUE_CONFIG.MAX_CONCURRENT_TASKS - this.runningTasks.size;
      
      if (availableSlots > 0 && this.queue.length > 0) {
        // 启动新任务
        const tasksToStart = this.queue.splice(0, availableSlots);
        
        for (const task of tasksToStart) {
          await this.startTask(task);
        }
      }
    } catch (error) {
      console.error('❌ 处理队列时出错:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 处理等待重试的任务
   */
  private async processWaitingTasks() {
    const waitingTaskIds = Array.from(this.waitingTasks.keys());
    
    for (const taskId of waitingTaskIds) {
      const task = this.waitingTasks.get(taskId);
      if (!task) continue;

      // 检查是否有空闲槽位
      const availableSlots = TASK_QUEUE_CONFIG.MAX_CONCURRENT_TASKS - this.runningTasks.size;
      if (availableSlots <= 0) break;

      // 尝试重新启动任务
      try {
        console.log(`🔄 重试任务 ${taskId} (第 ${(task.retryCount || 0) + 1} 次)`);
        await this.startTask(task);
        this.waitingTasks.delete(taskId);
      } catch (error) {
        console.error(`❌ 重试任务 ${taskId} 失败:`, error);
        // 如果重试失败，检查是否是因为队列满或机器不足
        if (this.isRetryableError(error)) {
          // 继续等待重试
          task.retryCount = (task.retryCount || 0) + 1;
          this.scheduleRetry(task);
        } else {
          // 不可重试的错误，标记为失败
          await this.failTask(taskId, error);
          this.waitingTasks.delete(taskId);
        }
      }
    }
  }

  /**
   * 检查错误是否可重试
   */
  private isRetryableError(error: any): boolean {
    const errorMessage = error?.message || '';
    return errorMessage.includes('TASK_QUEUE_MAXED') || 
           errorMessage.includes('TASK_INSTANCE_MAXED') ||
           errorMessage.includes('421') ||
           errorMessage.includes('415');
  }

  /**
   * 安排重试
   */
  private scheduleRetry(task: TaskQueueItem) {
    // 清除之前的定时器
    if (task.retryTimer) {
      clearTimeout(task.retryTimer);
    }

    // 设置 5 秒后重试
    task.retryTimer = setTimeout(() => {
      this.processWaitingTasks();
    }, 5000);

    console.log(`⏰ 任务 ${task.id} 将在 5 秒后重试`);
  }

  /**
   * 启动 RunningHub 状态监控（后端托管，无需前端）
   */
  public startStatusWatcher(taskRecordId: number, runninghubTaskId: string, taskType: string = 'image') {
    console.log(`🚀 启动状态监控: ${runninghubTaskId} (类型: ${taskType}, 记录ID: ${taskRecordId})`);
    
    // 已有 watcher 则先清理
    const existing = this.statusWatchers.get(runninghubTaskId);
    if (existing) {
      console.log(`🔄 清理现有监控: ${runninghubTaskId}`);
      clearInterval(existing);
    }

    const startedAt = Date.now();
    
    // 立即执行一次状态检查，不等待间隔
    console.log(`⚡ 立即执行状态检查: ${runninghubTaskId}`);
    this.checkTaskStatus(taskRecordId, runninghubTaskId, taskType, startedAt).catch(error => {
      console.error(`❌ 初始状态检查异常: ${runninghubTaskId}`, error);
    });
    
    const interval = setInterval(async () => {
      try {
        await this.checkTaskStatus(taskRecordId, runninghubTaskId, taskType, startedAt);
      } catch (error) {
        console.error(`❌ 状态检查异常: ${runninghubTaskId}`, error);
        // 如果连续出错，停止监控
        this.stopStatusWatcher(runninghubTaskId);
      }
    }, this.watcherConfig.intervalMs);

    this.statusWatchers.set(runninghubTaskId, interval);
    console.log(`✅ 状态监控已设置: ${runninghubTaskId}, 间隔: ${this.watcherConfig.intervalMs}ms`);
    console.log(`📊 当前活跃监控数量: ${this.statusWatchers.size}`);
  }

  /**
   * 检查任务状态的核心逻辑
   */
  private async checkTaskStatus(taskRecordId: number, runninghubTaskId: string, taskType: string, startedAt: number) {
    try {
      console.log(`🔍 开始检查任务状态: ${runninghubTaskId} (类型: ${taskType}, 记录ID: ${taskRecordId})`);
        // 超时保护
        if (Date.now() - startedAt > this.watcherConfig.maxMinutes * 60 * 1000) {
          if (taskType === 'background-removal') {
            await prisma.backgroundRemovalTask.update({
              where: { replicateId: runninghubTaskId },
              data: {
                taskStatus: 'failed',
                errorMsg: 'Watch timeout',
                executeEndTime: BigInt(Date.now()),
              }
            });
          } else {
              await prisma.taskData.update({
                where: { id: taskRecordId },
                data: {
                  taskStatus: 'failed',
                  errorMsg: 'Watch timeout',
                  executeEndTime: BigInt(Date.now()),
                }
              });
            }
          this.stopStatusWatcher(runninghubTaskId);
          return;
        }

        // 查询任务状态
        const statusResp = await runninghubAPI.getTaskStatus(runninghubTaskId);
        let status: string | undefined;
        
        console.log(`🔍 RunningHub状态响应:`, JSON.stringify(statusResp, null, 2));
        
        // 改进状态解析逻辑
        if (statusResp && typeof statusResp === 'object') {
          if (statusResp.code === 0 && statusResp.data) {
            if (typeof statusResp.data === 'string') {
              status = statusResp.data;
            } else if (statusResp.data && typeof statusResp.data.status === 'string') {
              status = statusResp.data.status;
            } else if (statusResp.data && typeof statusResp.data === 'object') {
              status = statusResp.data.status;
            }
          } else if (statusResp.code !== 0) {
            console.log(`⚠️ RunningHub API返回错误: code=${statusResp.code}, msg=${statusResp.msg}`);
            // API错误，继续轮询
            return;
          }
        }

        console.log(`📊 解析的任务状态: ${status} (原始响应: ${JSON.stringify(statusResp)})`);

        if (!status) {
          console.log(`⚠️ 无法解析任务状态，继续轮询`);
          return; // 未知状态，继续轮询
        }

        if (status === 'RUNNING' || status === 'running' || status === 'Processing' || status === 'processing' || status === 'queued' || status === 'starting') {
          // 更新数据库状态为processing（如果当前不是processing状态）
          try {
            if (taskType === 'background-removal') {
              await prisma.backgroundRemovalTask.update({
                where: { replicateId: runninghubTaskId },
                data: {
                  taskStatus: 'processing',
                  executeStartTime: BigInt(Date.now()),
                }
              });
            } else {
              await prisma.taskData.update({
                where: { id: taskRecordId },
                data: {
                  taskStatus: 'processing',
                  executeStartTime: BigInt(Date.now()),
                }
              });
            }
            console.log(`🔄 任务状态更新为processing`);
          } catch (updateError) {
            console.error("❌ 更新任务状态为processing失败:", updateError);
          }
          return; // 继续轮询
        }

        if (status === 'SUCCESS' || status === 'succeeded') {
          // 拉取结果
          try {
            console.log(`🎯 任务状态为SUCCESS，开始获取结果: ${runninghubTaskId}`);
            const result = await runninghubAPI.getTaskResult(runninghubTaskId);
            console.log(`📦 结果响应:`, JSON.stringify(result, null, 2));
            
            let outputUrl: string | null = null;
            
            // 检查是否是 APIKEY_TASK_IS_RUNNING 响应
            if (result.code === 804 && result.msg === 'APIKEY_TASK_IS_RUNNING') {
              console.log(`ℹ️ 任务状态为SUCCESS但结果API仍返回运行中，保持当前状态等待下次轮询`);
              return; // 继续轮询
            } else if (result?.data && Array.isArray(result.data) && result.data.length > 0) {
              const remoteUrl = result.data[0]?.fileUrl || null;
              console.log(`✅ 获取到远端输出URL: ${remoteUrl}`);
              // 将远端图片转存到 R2
              try {
                outputUrl = await this.saveImageToR2(remoteUrl, runninghubTaskId);
                console.log(`📤 已转存到R2: ${outputUrl}`);
              } catch (uploadErr) {
                console.error("❌ 转存到R2失败，回退使用远端URL:", uploadErr);
                outputUrl = remoteUrl;
              }
            } else {
              console.log(`⚠️ 结果数据格式异常:`, result);
            }

            if (taskType === 'background-removal') {
              await prisma.backgroundRemovalTask.update({
                where: { replicateId: runninghubTaskId },
                data: {
                  taskStatus: 'succeeded',
                  outputImageUrl: outputUrl,
                  executeEndTime: BigInt(Date.now()),
                }
              });
            } else {
              await prisma.taskData.update({
                where: { id: taskRecordId },
                data: {
                  taskStatus: 'succeeded',
                  imageUrl: outputUrl,
                  executeEndTime: BigInt(Date.now()),
                }
              });
            }
            console.log(`✅ 任务成功完成，输出URL: ${outputUrl}`);
          } catch (e) {
            console.error("❌ 获取任务结果失败:", e);
            if (taskType === 'background-removal') {
              await prisma.backgroundRemovalTask.update({
                where: { replicateId: runninghubTaskId },
                data: {
                  taskStatus: 'succeeded',
                  executeEndTime: BigInt(Date.now()),
                }
              });
            } else {
              await prisma.taskData.update({
                where: { id: taskRecordId },
                data: {
                  taskStatus: 'succeeded',
                  executeEndTime: BigInt(Date.now()),
                }
              });
            }
          } finally {
            this.stopStatusWatcher(runninghubTaskId);
          }
          return;
        }

        if (status === 'FAILED' || status === 'failed') {
          if (taskType === 'background-removal') {
            await prisma.backgroundRemovalTask.update({
              where: { replicateId: runninghubTaskId },
              data: {
                taskStatus: 'failed',
                executeEndTime: BigInt(Date.now()),
              }
            });
          } else {
            await prisma.taskData.update({
              where: { id: taskRecordId },
              data: {
                taskStatus: 'failed',
                executeEndTime: BigInt(Date.now()),
              }
            });
          }
          this.stopStatusWatcher(runninghubTaskId);
          return;
        }
    } catch (error) {
      console.error("❌ 状态监控错误:", error);
      // 继续轮询，不因单次错误停止
    }
  }

  /**
   * 将远端图片下载并上传到 Cloudflare R2，返回公共访问URL
   */
  private async saveImageToR2(remoteUrl: string | null, taskId: string): Promise<string | null> {
    if (!remoteUrl) return null;
    
    // 设置超时保护 - 15秒
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('R2 upload timeout')), 15000);
    });
    
    try {
      const uploadPromise = this.performR2Upload(remoteUrl, taskId);
      return await Promise.race([uploadPromise, timeoutPromise]);
    } catch (e) {
      console.error('saveImageToR2 error:', e);
      return null;
    }
  }

  private async performR2Upload(remoteUrl: string, taskId: string): Promise<string | null> {
    const resp = await fetch(remoteUrl);
    if (!resp.ok) throw new Error(`fetch image failed: ${resp.status}`);
    const arrayBuffer = await resp.arrayBuffer();
    const contentType = resp.headers.get('content-type') || 'image/png';

    const s3 = createR2S3Service();
    const fileName = `${taskId}-${nanoid(8)}.png`;
    const key = `background-removal/processed/${fileName}`;
    await s3.putItemInBucket(fileName, Buffer.from(arrayBuffer), {
      path: "background-removal/processed",
      ContentType: contentType,
      acl: "public-read",
    });

    return `${env.R2_URL_BASE}/${key}`;
  }

  /** 停止状态监控 */
  public stopStatusWatcher(runninghubTaskId: string) {
    const h = this.statusWatchers.get(runninghubTaskId);
    if (h) {
      clearInterval(h);
      this.statusWatchers.delete(runninghubTaskId);
      console.log(`🛑 已停止状态监控: runninghubTaskId=${runninghubTaskId}`);
    }
  }

  /** 获取当前活跃监控状态 */
  public getActiveWatchers() {
    return {
      count: this.statusWatchers.size,
      taskIds: Array.from(this.statusWatchers.keys())
    };
  }

  /**
   * 启动任务
   */
  private async startTask(task: TaskQueueItem) {
    try {
      task.status = 'running';
      this.runningTasks.set(task.id, task);

      console.log(`🚀 启动任务 ${task.id} (${task.taskType})`);

      // 根据任务类型调用相应的处理器
      await taskProcessor.processTask(task);

      // 注意：这里不调用 completeTask，因为任务可能还在RunningHub中处理
      // 任务完成会通过webhook或状态轮询来处理

    } catch (error) {
      console.error(`❌ 启动任务 ${task.id} 失败:`, error);
      
      // 检查是否是可重试的错误
      if (this.isRetryableError(error)) {
        console.log(`⏳ 任务 ${task.id} 因队列满或机器不足，进入等待重试状态`);
        task.status = 'waiting';
        this.runningTasks.delete(task.id);
        this.waitingTasks.set(task.id, task);
        this.scheduleRetry(task);
      } else {
        // 不可重试的错误，直接标记为失败
        await this.failTask(task.id, error);
      }
    }
  }

  /**
   * 完成任务
   */
  public async completeTask(taskId: string) {
    const task = this.runningTasks.get(taskId);
    if (task) {
      task.status = 'completed';
      this.runningTasks.delete(taskId);
      console.log(`✅ 任务 ${taskId} 已完成`);
      
      // 继续处理队列
      this.processQueue();
    }
  }

  /**
   * 任务失败
   */
  public async failTask(taskId: string, error: any) {
    const task = this.runningTasks.get(taskId);
    if (task) {
      task.status = 'failed';
      this.runningTasks.delete(taskId);
      console.log(`❌ 任务 ${taskId} 失败:`, error);
      
      // 继续处理队列
      this.processQueue();
    }
  }

  /**
   * 获取队列状态
   */
  public getQueueStatus() {
    return {
      running: this.runningTasks.size,
      pending: this.queue.length,
      waiting: this.waitingTasks.size,
      maxConcurrent: TASK_QUEUE_CONFIG.MAX_CONCURRENT_TASKS,
      queue: this.queue.map((task, index) => ({
        id: task.id,
        position: index + 1,
        taskType: task.taskType,
        userId: task.userId,
        createdAt: task.createdAt,
        priority: task.priority,
        status: task.status,
      })),
      waitingTasks: Array.from(this.waitingTasks.values()).map(task => ({
        id: task.id,
        taskType: task.taskType,
        userId: task.userId,
        createdAt: task.createdAt,
        priority: task.priority,
        status: task.status,
        retryCount: task.retryCount || 0,
      })),
    };
  }

  /**
   * 获取特定任务的队列位置
   */
  public getTaskPosition(taskId: string): number | null {
    const queueIndex = this.queue.findIndex(task => task.id === taskId);
    if (queueIndex !== -1) {
      return queueIndex + 1;
    }
    
    // 检查是否正在运行
    if (this.runningTasks.has(taskId)) {
      return 0; // 0 表示正在运行
    }
    
    return null; // 任务不存在
  }

  /**
   * 获取正在运行的任务
   */
  public getRunningTask(taskId: string): TaskQueueItem | null {
    return this.runningTasks.get(taskId) || null;
  }

  /**
   * 取消任务
   */
  public async cancelTask(taskId: string): Promise<boolean> {
    // 从队列中移除
    const queueIndex = this.queue.findIndex(task => task.id === taskId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
      console.log(`🚫 任务 ${taskId} 已从队列中取消`);
      return true;
    }

    // 从等待队列中移除
    const waitingTask = this.waitingTasks.get(taskId);
    if (waitingTask) {
      // 清除重试定时器
      if (waitingTask.retryTimer) {
        clearTimeout(waitingTask.retryTimer);
      }
      this.waitingTasks.delete(taskId);
      console.log(`🚫 等待重试的任务 ${taskId} 已取消`);
      return true;
    }

    // 检查是否正在运行
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      // 如果 RunningHub 任务已经创建，尝试取消它
      if (runningTask.runninghubTaskId) {
        try {
          const { runninghubAPI } = await import('@/modules/runninghub');
          await runninghubAPI.cancelTask(runningTask.runninghubTaskId);
          console.log(`🚫 RunningHub 任务 ${runningTask.runninghubTaskId} 已取消`);
        } catch (error) {
          console.error(`❌ 取消 RunningHub 任务失败:`, error);
        }
      }
      
      // 标记任务为失败
      await this.failTask(taskId, new Error('Task cancelled by user'));
      return true;
    }

    return false;
  }
}

export const taskQueueManager = TaskQueueManager.getInstance();
