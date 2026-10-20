import { TASK_QUEUE_CONFIG } from "@/config/constants";
import { prisma } from "@/db/prisma";
import {
  getBackgroundTaskStatus,
  getRunningHubLifecycleStatus,
  refreshBackgroundTaskStatus,
} from "@/lib/background-task-status";
import {
  ANALYTICS_EVENTS,
  createTaskAnalyticsEvent,
} from "@/lib/analytics-events";
import { emitServerAnalyticsEvent } from "@/lib/server-analytics-events";
import {
  canRetryAutomatically,
  isTaskExpired,
  normalizeTaskStatus,
  refundFailedTaskCredit,
} from "@/lib/task-lifecycle";
import { runninghubAPI } from "@/modules/runninghub";

import { taskProcessor } from "./task-processor";

export interface TaskQueueItem {
  id: string;
  userId: string | null;
  taskType: string;
  priority: number;
  createdAt: Date;
  status: "pending" | "running" | "completed" | "failed" | "waiting";
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
  private statusWatchers = new Map<
    string,
    { timer: NodeJS.Timeout | null; stopped: boolean }
  >();
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
  public async addTask(
    task: Omit<TaskQueueItem, "id" | "createdAt" | "status">,
  ): Promise<{ taskId: string; queuePosition: number }> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queueItem: TaskQueueItem = {
      ...task,
      id: taskId,
      createdAt: new Date(),
      status: "pending",
    };

    // 如果并发已满且队列长度超过阈值，抛出错误给前端快速失败
    const availableSlots =
      TASK_QUEUE_CONFIG.MAX_CONCURRENT_TASKS - this.runningTasks.size;
    const tooBusy =
      availableSlots <= 0 &&
      this.queue.length >= TASK_QUEUE_CONFIG.MAX_CONCURRENT_TASKS;
    if (tooBusy) {
      const error: any = new Error("TASK_QUEUE_MAXED");
      (error.code as string) = "TASK_QUEUE_MAXED";
      throw error;
    }

    // 添加到队列
    this.queue.push(queueItem);

    // 按优先级排序 (数字越小优先级越高)
    this.queue.sort((a, b) => a.priority - b.priority);

    const queuePosition =
      this.queue.findIndex((item) => item.id === taskId) + 1;

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
      const availableSlots =
        TASK_QUEUE_CONFIG.MAX_CONCURRENT_TASKS - this.runningTasks.size;

      if (availableSlots > 0 && this.queue.length > 0) {
        // 启动新任务
        const tasksToStart = this.queue.splice(0, availableSlots);

        for (const task of tasksToStart) {
          await this.startTask(task);
        }
      }
    } catch (error) {
      console.error("❌ 处理队列时出错:", error);
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
      const availableSlots =
        TASK_QUEUE_CONFIG.MAX_CONCURRENT_TASKS - this.runningTasks.size;
      if (availableSlots <= 0) break;

      // 尝试重新启动任务
      try {
        console.log(
          `🔄 重试任务 ${taskId} (第 ${(task.retryCount || 0) + 1} 次)`,
        );
        await this.startTask(task);
        this.waitingTasks.delete(taskId);
      } catch (error) {
        console.error(`❌ 重试任务 ${taskId} 失败:`, error);
        // 如果重试失败，检查是否是因为队列满或机器不足
        if (
          this.isRetryableError(error) &&
          canRetryAutomatically(task.retryCount)
        ) {
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
    const errorMessage = error?.message || "";
    return (
      errorMessage.includes("TASK_QUEUE_MAXED") ||
      errorMessage.includes("TASK_INSTANCE_MAXED") ||
      errorMessage.includes("421") ||
      errorMessage.includes("415")
    );
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
  public startStatusWatcher(
    taskRecordId: number,
    runninghubTaskId: string,
    taskType: string = "image",
  ) {
    // Register before the first async read. Starting an already-watched task
    // must not create a competing poll or reset its elapsed processing time.
    if (this.statusWatchers.has(runninghubTaskId)) return;
    const watcher = { timer: null as NodeJS.Timeout | null, stopped: false };
    this.statusWatchers.set(runninghubTaskId, watcher);
    const startedAt = Date.now();
    const isActive = () =>
      !watcher.stopped && this.statusWatchers.get(runninghubTaskId) === watcher;
    const poll = async () => {
      if (!isActive()) return;
      try {
        const done = await this.checkTaskStatus(
          taskRecordId,
          runninghubTaskId,
          taskType,
          startedAt,
          isActive,
        );
        if (done && isActive()) this.stopStatusWatcher(runninghubTaskId);
      } catch {
        // Provider/database/storage errors are recoverable on the same task.
        // Avoid logging output URLs, provider bodies, or signed query tokens.
        console.warn(
          "Task status refresh failed; the original task will be polled again",
        );
      }
      if (isActive()) {
        // Schedule only after this poll settles; async work never overlaps.
        watcher.timer = setTimeout(() => {
          void poll();
        }, this.watcherConfig.intervalMs);
      }
    };
    void poll();
  }

  private async checkTaskStatus(
    taskRecordId: number,
    runninghubTaskId: string,
    taskType: string,
    startedAt: number,
    isActive: () => boolean,
  ): Promise<boolean> {
    if (taskType === "background-removal") {
      const task = await prisma.backgroundRemovalTask.findFirst({
        where: { id: taskRecordId, replicateId: runninghubTaskId },
      });
      if (!task || !isActive()) return true;
      const status = getBackgroundTaskStatus(task);
      if (["succeeded", "failed", "expired"].includes(status)) {
        if (status === "failed")
          await refundFailedTaskCredit(
            task.userId,
            task.id,
            "background-removal",
          );
        return true;
      }
      if (isTaskExpired(task)) {
        const result = await prisma.backgroundRemovalTask.updateMany({
          where: {
            id: task.id,
            taskStatus: task.taskStatus,
            outputImageUrl: task.outputImageUrl,
            expiresAt: task.expiresAt,
          },
          data: {
            taskStatus: "expired",
            errorMsg: "Task has expired",
            executeEndTime: BigInt(Date.now()),
          },
        });
        return result.count > 0;
      }
      // The shared refresher owns the registry deadline, private migration,
      // and state/output/expiry compare-and-swap used by GET and SSE too.
      const persisted = await refreshBackgroundTaskStatus(task, isActive);
      if (!isActive()) return true;
      const nextStatus = getBackgroundTaskStatus(persisted);
      await this.emitTransitionEvent(
        task.id,
        status,
        nextStatus,
        task.userId,
      );
      if (nextStatus === "failed")
        await refundFailedTaskCredit(
          persisted.userId,
          persisted.id,
          "background-removal",
        );
      return ["succeeded", "failed", "expired"].includes(nextStatus);
    }

    // Keep the legacy generic/video path metadata-only. Every transition uses
    // the original row as a guard, and success always requires an output URL.
    const task = await prisma.taskData.findFirst({
      where: { id: taskRecordId, replicateId: runninghubTaskId },
    });
    if (!task || !isActive()) return true;
    const currentStatus = normalizeTaskStatus(task.taskStatus);
    if (
      ["failed", "expired"].includes(currentStatus) ||
      (currentStatus === "succeeded" && task.imageUrl)
    ) {
      if (currentStatus === "failed")
        await refundFailedTaskCredit(task.userId, task.id, "image");
      return true;
    }
    const processingDeadline =
      Math.min(startedAt, task.createdAt.getTime()) +
      this.watcherConfig.maxMinutes * 60 * 1000;
    const retentionDeadline =
      task.expiresAt?.getTime() ??
      task.createdAt.getTime() + 24 * 60 * 60 * 1000;
    const timedOut = () =>
      Date.now() >= Math.min(processingDeadline, retentionDeadline);
    const data: {
      taskStatus: string;
      imageUrl?: string;
      executeStartTime?: bigint;
      executeEndTime?: bigint;
      errorMsg?: string | null;
    } = { taskStatus: "processing" };
    if (!timedOut()) {
      const response = await runninghubAPI.getTaskStatus(runninghubTaskId);
      if (!isActive()) return true;
      if (response.code !== 0)
        throw new Error("Provider task status is unavailable");
      const status = getRunningHubLifecycleStatus(
        typeof response.data === "string"
          ? response.data
          : response.data?.status,
      );
      data.taskStatus =
        status === "queued" && currentStatus === "processing"
          ? "processing"
          : status;
      if (status === "succeeded" && !timedOut()) {
        const result = await runninghubAPI.getTaskResult(runninghubTaskId);
        if (!isActive()) return true;
        const output =
          result.code === 0 && Array.isArray(result.data)
            ? result.data
                .find(
                  (file) =>
                    typeof file?.fileUrl === "string" && file.fileUrl.trim(),
                )
                ?.fileUrl.trim()
            : null;
        if (output) {
          data.imageUrl = output;
          data.errorMsg = null;
          data.executeEndTime = BigInt(Date.now());
        } else {
          data.taskStatus = "processing";
          data.errorMsg =
            "The provider result is not ready. Please retry shortly.";
        }
      } else if (status === "failed" || status === "expired") {
        data.errorMsg = "Task failed on provider";
        data.executeEndTime = BigInt(Date.now());
      } else if (!task.executeStartTime && status === "processing") {
        data.executeStartTime = BigInt(Date.now());
      }
    }
    if (timedOut()) {
      delete data.imageUrl;
      data.taskStatus = "failed";
      data.errorMsg = "Processing timed out. Please retry.";
      data.executeEndTime = BigInt(Date.now());
    }
    if (!isActive()) return true;
    await prisma.taskData.updateMany({
      where: {
        id: task.id,
        replicateId: runninghubTaskId,
        taskStatus: task.taskStatus,
        imageUrl: task.imageUrl,
        expiresAt: task.expiresAt,
      },
      data,
    });
    const persisted = await prisma.taskData.findFirst({
      where: { id: task.id, replicateId: runninghubTaskId },
    });
    if (!persisted) return true;
    const nextStatus = normalizeTaskStatus(persisted.taskStatus);
    await this.emitTransitionEvent(
      task.id,
      currentStatus,
      nextStatus,
      task.userId,
    );
    if (nextStatus === "failed")
      await refundFailedTaskCredit(persisted.userId, persisted.id, "image");
    return (
      ["failed", "expired"].includes(nextStatus) ||
      (nextStatus === "succeeded" && Boolean(persisted.imageUrl))
    );
  }

  private async emitTransitionEvent(
    taskId: number,
    previousStatus: string,
    nextStatus: string,
    userId: string | null,
  ) {
    const eventName =
      nextStatus === "succeeded"
        ? ANALYTICS_EVENTS.processingCompleted
        : nextStatus === "failed"
          ? ANALYTICS_EVENTS.processingFailed
          : nextStatus === "processing" && previousStatus !== "processing"
            ? ANALYTICS_EVENTS.processingStarted
            : null;
    if (!eventName || previousStatus === nextStatus) return;

    try {
      await emitServerAnalyticsEvent(
        createTaskAnalyticsEvent(eventName, taskId, {
          is_authenticated: Boolean(userId),
        }),
      );
    } catch (analyticsError) {
      console.warn("Task lifecycle analytics failed:", analyticsError);
    }
  }

  /** Stop future polls and prevent in-flight reads from writing afterward. */
  public stopStatusWatcher(runninghubTaskId: string) {
    const watcher = this.statusWatchers.get(runninghubTaskId);
    if (!watcher) return;
    watcher.stopped = true;
    if (watcher.timer) clearTimeout(watcher.timer);
    this.statusWatchers.delete(runninghubTaskId);
  }

  /** 获取当前活跃监控状态 */
  public getActiveWatchers() {
    return {
      count: this.statusWatchers.size,
      taskIds: Array.from(this.statusWatchers.keys()),
    };
  }

  /**
   * 启动任务
   */
  private async startTask(task: TaskQueueItem) {
    try {
      task.status = "running";
      this.runningTasks.set(task.id, task);

      console.log(`🚀 启动任务 ${task.id} (${task.taskType})`);

      // 根据任务类型调用相应的处理器
      await taskProcessor.processTask(task);

      // 注意：这里不调用 completeTask，因为任务可能还在RunningHub中处理
      // 任务完成会通过webhook或状态轮询来处理
    } catch (error) {
      console.error(`❌ 启动任务 ${task.id} 失败:`, error);

      // 检查是否是可重试的错误
      if (
        this.isRetryableError(error) &&
        canRetryAutomatically(task.retryCount)
      ) {
        console.log(`⏳ 任务 ${task.id} 因队列满或机器不足，进入等待重试状态`);
        task.status = "waiting";
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
      task.status = "completed";
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
      task.status = "failed";
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
      waitingTasks: Array.from(this.waitingTasks.values()).map((task) => ({
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
    const queueIndex = this.queue.findIndex((task) => task.id === taskId);
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
    const queueIndex = this.queue.findIndex((task) => task.id === taskId);
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
          const { runninghubAPI } = await import("@/modules/runninghub");
          await runninghubAPI.cancelTask(runningTask.runninghubTaskId);
          console.log(
            `🚫 RunningHub 任务 ${runningTask.runninghubTaskId} 已取消`,
          );
        } catch (error) {
          console.error(`❌ 取消 RunningHub 任务失败:`, error);
        }
      }

      // 标记任务为失败
      await this.failTask(taskId, new Error("Task cancelled by user"));
      return true;
    }

    return false;
  }
}

export const taskQueueManager = TaskQueueManager.getInstance();
