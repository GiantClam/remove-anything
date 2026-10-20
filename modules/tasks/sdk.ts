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
  findByExternalId(
    model: string,
    externalId: string,
  ): Promise<TaskRecord | null>;
}

/**
 * Retained for adapter compatibility. Provider submission failures are no
 * longer copied to this queue because transport failures can leave creation
 * outcomes unknown and replaying them may create duplicate paid jobs.
 */
export interface TaskQueue {
  enqueue(taskType: string, payload: Record<string, any>): Promise<void>;
}

export interface RunningHubClient {
  createTaskGeneric(opts: {
    workflowId: string;
    nodeInfoList: Array<{
      nodeId: string;
      fieldName: string;
      fieldValue: string;
    }>;
    taskRecordId?: number;
    webhookRecordType?: "video" | "object" | "watermark";
  }): Promise<string>;
  cancelTask?(taskId: string): Promise<boolean>;
  getTaskStatus(taskId: string): Promise<any>;
  getTaskResult(taskId: string): Promise<any>;
}

export interface CreateVideoTaskOptions {
  workflowId: string;
  uploadNodeId?: string; // default '205'
  uploadFieldName?: string; // default 'video'
  r2Url: string;
  /** Use an existing task row instead of creating another one. */
  taskRecordId?: number;
}

export interface OrchestratorDeps {
  repo: TaskRepository;
  rh: RunningHubClient;
  /** @deprecated The orchestrator intentionally does not enqueue provider failures. */
  queue?: TaskQueue;
}

export async function createVideoTaskWithR2Url(
  opts: { model: string; userId?: string | null } & CreateVideoTaskOptions,
  deps: OrchestratorDeps,
) {
  const {
    model,
    userId,
    workflowId,
    uploadNodeId = "205",
    uploadFieldName = "video",
    r2Url,
    taskRecordId,
  } = opts;
  const { repo, rh } = deps;

  // Reuse route-created records for existing callers; standalone module users
  // still get an owned record by default.
  const recordId =
    taskRecordId ??
    (
      await repo.create({
        userId: userId || null,
        model,
        inputUrl: r2Url,
        status: "processing",
      })
    ).id;

  // 2) Submit once through the provider SDK, which owns its single safe
  // retry after an explicit capacity rejection. Never enqueue after this
  // boundary: transport failures can leave task creation outcome unknown.
  let taskId: string;
  try {
    taskId = await rh.createTaskGeneric({
      workflowId,
      nodeInfoList: [
        { nodeId: uploadNodeId, fieldName: uploadFieldName, fieldValue: r2Url },
      ],
      taskRecordId: typeof recordId === "number" ? recordId : undefined,
      webhookRecordType: "video",
    });
  } catch (e: any) {
    const submissionOutcome =
      e?.code === "TASK_CREATION_REJECTED" && e?.taskWasNotCreated === true
        ? ("rejected" as const)
        : ("unknown" as const);
    try {
      await repo.update(recordId, {
        status: submissionOutcome === "unknown" ? "processing" : "failed",
        errorMsg: e?.message || String(e),
      });
    } catch {
      // Preserve the original submission error; no provider request is replayed.
    }
    return {
      ok: false as const,
      recordId,
      error: e?.message || String(e),
      submissionOutcome,
    };
  }

  try {
    await repo.update(recordId, {
      status: "processing",
      externalTaskId: taskId,
    });
  } catch (e: any) {
    return {
      ok: false as const,
      recordId,
      taskId,
      error: e?.message || String(e),
      submissionOutcome: "created" as const,
    };
  }

  return { ok: true as const, recordId, taskId };
}

export async function syncTaskStatus(
  externalTaskId: string,
  deps: OrchestratorDeps & { recordId: TaskRecord["id"] },
) {
  const { recordId, rh, repo } = deps;
  const status = await rh.getTaskStatus(externalTaskId);
  // 透传状态字符串，实际项目可映射
  const s = (status?.data?.status || status?.data || "")
    .toString()
    .toLowerCase();
  if (["success", "succeeded"].includes(s)) {
    try {
      const result = await rh.getTaskResult(externalTaskId);
      const outputUrl = Array.isArray(result?.data)
        ? result.data[0]?.fileUrl || null
        : null;
      await repo.update(recordId, { status: "succeeded", outputUrl });
    } catch {
      await repo.update(recordId, { status: "succeeded" });
    }
    return "succeeded" as const;
  }
  if (["failed", "error"].includes(s)) {
    await repo.update(recordId, { status: "failed" });
    return "failed" as const;
  }
  return "processing" as const;
}
