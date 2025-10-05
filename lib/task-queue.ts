import { prisma } from "@/db/prisma";
import { TASK_QUEUE_CONFIG } from "@/config/constants";
import { taskProcessor } from "./task-processor";
import { runninghubAPI } from "@/lib/runninghub-api";

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
    intervalMs: 5000,
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
  public startStatusWatcher(taskRecordId: number, runninghubTaskId: string) {
    // 已有 watcher 则先清理
    const existing = this.statusWatchers.get(runninghubTaskId);
    if (existing) clearInterval(existing);

    const startedAt = Date.now();
    const interval = setInterval(async () => {
      try {
        // 超时保护
        if (Date.now() - startedAt > this.watcherConfig.maxMinutes * 60 * 1000) {
          await prisma.fluxData.update({
            where: { id: taskRecordId },
            data: {
              taskStatus: 'failed',
              errorMsg: 'Watch timeout',
              executeEndTime: BigInt(Date.now()),
            }
          });
          this.stopStatusWatcher(runninghubTaskId);
          return;
        }

        // 查询任务状态
        const statusResp = await runninghubAPI.getTaskStatus(runninghubTaskId);
        let status: string | undefined;
        if (typeof (statusResp as any)?.data === 'string') {
          status = (statusResp as any).data as string;
        } else if ((statusResp as any)?.data && typeof (statusResp as any).data.status === 'string') {
          status = (statusResp as any).data.status as string;
        }

        if (!status) return; // 未知状态，继续轮询

        if (status === 'RUNNING' || status === 'running' || status === 'Processing' || status === 'processing' || status === 'queued' || status === 'starting') {
          return; // 继续轮询
        }

        if (status === 'SUCCESS' || status === 'succeeded') {
          // 拉取结果
          try {
            const result = await runninghubAPI.getTaskResult(runninghubTaskId);
            let outputUrl: string | null = null;
            if (result?.data && Array.isArray(result.data) && result.data.length > 0) {
              outputUrl = result.data[0]?.fileUrl || null;
            }

            await prisma.fluxData.update({
              where: { id: taskRecordId },
              data: {
                taskStatus: 'succeeded',
                imageUrl: outputUrl,
                executeEndTime: BigInt(Date.now()),
              }
            });
          } catch (e) {
            await prisma.fluxData.update({
              where: { id: taskRecordId },
              data: {
                taskStatus: 'succeeded',
                executeEndTime: BigInt(Date.now()),
              }
            });
          } finally {
            this.stopStatusWatcher(runninghubTaskId);
          }
          return;
        }

        if (status === 'FAILED' || status === 'failed') {
          await prisma.fluxData.update({
            where: { id: taskRecordId },
            data: {
              taskStatus: 'failed',
              executeEndTime: BigInt(Date.now()),
            }
          });
          this.stopStatusWatcher(runninghubTaskId);
          return;
        }
      } catch (err) {
        // 网络/临时错误，忽略并继续下次
      }
    }, this.watcherConfig.intervalMs);

    this.statusWatchers.set(runninghubTaskId, interval);
    console.log(`👀 已启动状态监控: runninghubTaskId=${runninghubTaskId}`);
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
          const { runninghubAPI } = await import('./runninghub-api');
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
