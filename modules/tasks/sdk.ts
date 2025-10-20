export interface TaskRecord {
  id: number | string;
  userId?: string | null;
  model: string;
  status: string; // pending | processing | succeeded | failed
  inputUrl?: string | null;
  outputUrl?: string | null;
  externalTaskId?: string | null; // RunningHub task id
  errorMsg?: string | null;
}

export interface CreateTaskParams {
  userId?: string | null;
  model: string;
  inputUrl?: string;
}

export interface TaskRepository {
  create(data: CreateTaskParams & { status?: string }): Promise<TaskRecord>;
  update(id: TaskRecord["id"], data: Partial<TaskRecord>): Promise<void>;
  findByExternalId(model: string, externalId: string): Promise<TaskRecord | null>;
}

export interface TaskQueue {
  enqueue(taskType: string, payload: Record<string, any>): Promise<void>;
}

export interface RunningHubClient {
  createTaskGeneric(opts: { workflowId: string; nodeInfoList: Array<{ nodeId: string; fieldName: string; fieldValue: string }>; taskRecordId?: number }): Promise<string>;
  getTaskStatus(taskId: string): Promise<any>;
  getTaskResult(taskId: string): Promise<any>;
}

export interface CreateVideoTaskOptions {
  workflowId: string;
  uploadNodeId?: string; // default '205'
  uploadFieldName?: string; // default 'video'
  r2Url: string;
}

export interface OrchestratorDeps {
  repo: TaskRepository;
  queue?: TaskQueue; // 可选：失败时入队
  rh: RunningHubClient;
}

export async function createVideoTaskWithR2Url(opts: { model: string; userId?: string | null } & CreateVideoTaskOptions, deps: OrchestratorDeps) {
  const { model, userId, workflowId, uploadNodeId = '205', uploadFieldName = 'video', r2Url } = opts;
  const { repo, rh, queue } = deps;

  // 1) 创建记录（processing）
  const record = await repo.create({ userId: userId || null, model, inputUrl: r2Url, status: 'processing' });

  // 2) 同步尝试创建 RunningHub 任务
  try {
    const taskId = await rh.createTaskGeneric({
      workflowId,
      nodeInfoList: [{ nodeId: uploadNodeId, fieldName: uploadFieldName, fieldValue: r2Url }],
      taskRecordId: typeof record.id === 'number' ? record.id : undefined,
    });

    await repo.update(record.id, { status: 'processing', externalTaskId: taskId });
    return { ok: true as const, recordId: record.id, taskId };
  } catch (e: any) {
    // 3) 失败则可选入队由 Cron 重试
    if (queue) {
      await queue.enqueue('video-watermark-removal', {
        taskRecordId: record.id,
        userId: userId || null,
        model,
        workflowId,
        nodeInfoList: [{ nodeId: uploadNodeId, fieldName: uploadFieldName, fieldValue: r2Url }],
      });
    }
    return { ok: false as const, recordId: record.id, error: e?.message || String(e) };
  }
}

export async function syncTaskStatus(externalTaskId: string, deps: OrchestratorDeps & { recordId: TaskRecord["id"] }) {
  const { recordId, rh, repo } = deps;
  const status = await rh.getTaskStatus(externalTaskId);
  // 透传状态字符串，实际项目可映射
  const s = (status?.data?.status || status?.data || '').toString().toLowerCase();
  if (["success", "succeeded"].includes(s)) {
    try {
      const result = await rh.getTaskResult(externalTaskId);
      const outputUrl = Array.isArray(result?.data) ? (result.data[0]?.fileUrl || null) : null;
      await repo.update(recordId, { status: 'succeeded', outputUrl });
    } catch {
      await repo.update(recordId, { status: 'succeeded' });
    }
    return 'succeeded' as const;
  }
  if (["failed", "error"].includes(s)) {
    await repo.update(recordId, { status: 'failed' });
    return 'failed' as const;
  }
  return 'processing' as const;
}


