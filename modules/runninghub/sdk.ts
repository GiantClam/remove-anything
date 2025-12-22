export interface RunningHubUploadResponse {
  code: number;
  msg: string;
  data: { fileName: string; fileType: string };
}

export interface RunningHubCreateTaskResponse {
  code: number;
  msg: string;
  data: { taskId: string; status: string };
}

export interface RunningHubTaskStatus {
  code: number;
  msg: string;
  data: { taskId: string; status: string; output?: string[]; error?: string };
}

export interface RunningHubNodeInput {
  nodeId: string;
  fieldName: string;
  fieldValue: string;
}

export interface CreateTaskOptions {
  workflowId: string;
  nodeInfoList: RunningHubNodeInput[];
  taskRecordId?: number;
}

export interface UploadFileOptions {
  fileType: string; // zip | image | video | other
  filename: string;
  contentType: string;
}

export interface RunningHubAPIConfig {
  baseUrl?: string;
  apiKey?: string;
  defaultWorkflowId?: string;
}

export class RunningHubAPI {
  private baseUrl: string;
  private apiKey: string;
  private workflowId: string;

  constructor(config?: RunningHubAPIConfig) {
    this.baseUrl = config?.baseUrl || process.env.RUNNINGHUB_API_BASE_URL || "";
    this.apiKey = config?.apiKey || process.env.RUNNINGHUB_API_KEY || "";
    this.workflowId = config?.defaultWorkflowId || process.env.RUNNINGHUB_WORKFLOW_ID || "";

    if (!this.baseUrl) console.error("[RunningHub] RUNNINGHUB_API_BASE_URL 未配置");
    if (!this.apiKey) console.error("[RunningHub] RUNNINGHUB_API_KEY 未配置");
  }

  async uploadFile(buffer: Buffer, options: UploadFileOptions): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: options.contentType || 'application/octet-stream' });
    formData.append('file', blob, options.filename || 'upload.bin');
    formData.append('apiKey', this.apiKey);
    formData.append('fileType', options.fileType);

    const response = await fetch(`${this.baseUrl}/task/openapi/upload`, { method: 'POST', body: formData });
    if (!response.ok) {
      let bodyText: string | undefined; try { bodyText = await response.text(); } catch {}
      throw new Error(`Upload failed: status=${response.status} ${response.statusText} body=${bodyText || ''}`);
    }
    const result = await response.json() as RunningHubUploadResponse;
    if (result.code !== 0) throw new Error(`Upload failed (api): ${result.msg}`);
    return result.data.fileName as string;
  }

  async uploadZip(zipBuffer: Buffer): Promise<string> {
    return this.uploadFile(zipBuffer, { fileType: 'zip', filename: 'images.zip', contentType: 'application/zip' });
  }

  async createTaskWithR2Url(options: CreateTaskOptions & { r2Url: string }): Promise<string> {
    const { workflowId, nodeInfoList, taskRecordId, r2Url } = options;
    const webhookUrl = taskRecordId ? `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/webhooks/runninghub` : undefined;
    const nodeInfoListWithR2Url = nodeInfoList.map(node => (node.fieldName === 'video_file' || node.fieldName === 'video') ? { ...node, fieldValue: r2Url } : node);
    const payload = { apiKey: this.apiKey, workflowId, nodeInfoList: nodeInfoListWithR2Url, ...(webhookUrl && { webhookUrl }) };
    const response = await fetch(`${this.baseUrl}/task/openapi/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) { let bodyText: string | undefined; try { bodyText = await response.text(); } catch {}; throw new Error(`Create task failed: status=${response.status} ${response.statusText} body=${bodyText || ''}`); }
    const result = await response.json() as RunningHubCreateTaskResponse;
    if (result.code !== 0) throw new Error(`Create task failed (api): ${result.msg}`);
    return result.data.taskId;
  }

  async createTaskGeneric(options: CreateTaskOptions): Promise<string> {
    const { workflowId, nodeInfoList, taskRecordId } = options;
    const webhookUrl = taskRecordId ? `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/webhooks/runninghub` : undefined;
    const payload = { apiKey: this.apiKey, workflowId, nodeInfoList, ...(webhookUrl && { webhookUrl }) };
    const response = await fetch(`${this.baseUrl}/task/openapi/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) { let bodyText: string | undefined; try { bodyText = await response.text(); } catch {}; throw new Error(`Create task failed: status=${response.status} ${response.statusText} body=${bodyText || ''}`); }
    const result = await response.json() as RunningHubCreateTaskResponse;
    if (result.code !== 0) throw new Error(`Create task failed (api): ${result.msg}`);
    return result.data.taskId;
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const payload = { apiKey: this.apiKey, taskId };
    const response = await fetch(`${this.baseUrl}/task/openapi/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) { let bodyText: string | undefined; try { bodyText = await response.text(); } catch {}; throw new Error(`Cancel task failed: status=${response.status} ${response.statusText} body=${bodyText || ''}`); }
    const result = await response.json() as { code: number; msg?: string };
    if (result.code !== 0) return false;
    return true;
  }

  async createWatermarkRemovalTask(filename: string, taskRecordId?: number): Promise<string> {
    return this.createTaskGeneric({ workflowId: this.workflowId, nodeInfoList: [{ nodeId: '377', fieldName: 'upload', fieldValue: filename }], taskRecordId });
  }

  async createVideoWatermarkRemovalTask(filename: string, taskRecordId?: number, options?: { workflowId: string; uploadNodeId?: string; uploadFieldName?: string; }): Promise<string> {
    const workflowId = options?.workflowId; if (!workflowId) throw new Error('workflowId is required');
    const uploadNodeId = options?.uploadNodeId || '205';
    const uploadFieldName = options?.uploadFieldName || 'video';
    return this.createTaskGeneric({ workflowId, nodeInfoList: [{ nodeId: uploadNodeId, fieldName: uploadFieldName, fieldValue: filename }], taskRecordId });
  }

  async getTaskStatus(taskId: string): Promise<RunningHubTaskStatus> {
    const payload = { apiKey: this.apiKey, taskId };
    const response = await fetch(`${this.baseUrl}/task/openapi/status?t=${Date.now()}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }, body: JSON.stringify(payload) });
    if (!response.ok) { let bodyText: string | undefined; try { bodyText = await response.text(); } catch {}; throw new Error(`Get status failed: status=${response.status} ${response.statusText} body=${bodyText || ''}`); }
    const result = await response.json() as RunningHubTaskStatus | { code: number; msg?: string; data?: any };
    if (typeof result.code !== 'number') return result as RunningHubTaskStatus;
    if (result.code !== 0) throw new Error(`Get status failed (api): ${result.msg || 'Unknown error'}`);
    if (!result.data) return { code: 0, msg: 'success', data: result as any };
    return result as RunningHubTaskStatus;
  }

  async getTaskResult(taskId: string): Promise<any> {
    const payload = { apiKey: this.apiKey, taskId };
    const response = await fetch(`${this.baseUrl}/task/openapi/outputs?t=${Date.now()}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }, body: JSON.stringify(payload) });
    if (!response.ok) { let bodyText: string | undefined; try { bodyText = await response.text(); } catch {}; throw new Error(`Get result failed: status=${response.status} ${response.statusText} body=${bodyText || ''}`); }
    const result = await response.json() as { code: number; msg?: string; data?: any };
    if (result.code !== 0) {
      if (result.code === 804 && result.msg === 'APIKEY_TASK_IS_RUNNING') return { code: 804, msg: 'APIKEY_TASK_IS_RUNNING', data: null };
      throw new Error(`Get result failed (api): ${result.msg || 'Unknown error'}`);
    }
    return result;
  }
}

export const runninghubAPI = new RunningHubAPI();

