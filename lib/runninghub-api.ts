import { env } from "@/env.mjs";

export interface RunningHubUploadResponse {
  code: number;
  msg: string;
  data: {
    fileName: string; // 文件在服务器上的相对路径
    fileType: string;
  };
}

export interface RunningHubCreateTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    status: string;
  };
}

export interface RunningHubTaskStatus {
  code: number;
  msg: string;
  data: {
    taskId: string;
    status: string;
    output?: string[];
    error?: string;
  };
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

export class RunningHubAPI {
  private baseUrl: string;
  private apiKey: string;
  private workflowId: string;

  constructor() {
    this.baseUrl = env.RUNNINGHUB_API_BASE_URL;
    this.apiKey = env.RUNNINGHUB_API_KEY;
    this.workflowId = env.RUNNINGHUB_WORKFLOW_ID;

    // 关键环境变量快速校验与提示
    if (!this.baseUrl) {
      console.error("[RunningHub] 缺少 RUNNINGHUB_API_BASE_URL 环境变量");
    }
    if (!this.apiKey || this.apiKey === "placeholder") {
      console.error("[RunningHub] 缺少或未配置有效 RUNNINGHUB_API_KEY（当前为 placeholder）");
    }
    if (!this.workflowId || this.workflowId === "placeholder") {
      console.error("[RunningHub] 缺少或未配置有效 RUNNINGHUB_WORKFLOW_ID");
    }
  }

  /**
   * 通用文件上传
   */
  async uploadFile(buffer: Buffer, options: UploadFileOptions): Promise<string> {
    try {
      console.log("🚀 开始上传文件到RunningHub...");
      console.log("[RunningHub] baseUrl=", this.baseUrl);
      console.log("[RunningHub] apiKey=", this.apiKey ? `${this.apiKey.substring(0, 8)}...` : "undefined");
      console.log("[RunningHub] buffer size=", buffer.length, "bytes");
      console.log("[RunningHub] upload options=", options);

      const formData = new FormData();
      const blob = new Blob([new Uint8Array(buffer)], { type: options.contentType || 'application/octet-stream' });
      formData.append('file', blob, options.filename || 'upload.bin');
      formData.append('apiKey', this.apiKey);
      formData.append('fileType', options.fileType);

      const response = await fetch(`${this.baseUrl}/task/openapi/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let bodyText: string | undefined;
        try {
          bodyText = await response.text();
        } catch {}
        throw new Error(`Upload failed: status=${response.status} ${response.statusText} body=${bodyText || ''}`);
      }

      const result = await response.json();
      if (result.code !== 0) throw new Error(`Upload failed (api): ${result.msg}`);

      //const fileName = result.data.fileName.replace(/^api\//, '').replace(/\.(zip|mp4|mov|mkv|png|jpg|jpeg)$/i, (m: string) => m);
      const fileName = result.data.fileName;
      return fileName;
    } catch (error) {
      console.error("❌ 文件上传失败:", error);
      throw error;
    }
  }

  /**
   * 上传ZIP文件（兼容旧接口）
   */
  async uploadZip(zipBuffer: Buffer): Promise<string> {
    try {
      console.log("🚀 开始上传ZIP文件到RunningHub...");
      console.log("[RunningHub] baseUrl=", this.baseUrl);
      console.log("[RunningHub] apiKey=", this.apiKey ? `${this.apiKey.substring(0, 8)}...` : "undefined");
      console.log("[RunningHub] zipBuffer size=", zipBuffer.length, "bytes");

      const fileName = await this.uploadFile(zipBuffer, {
        fileType: 'zip',
        filename: 'images.zip',
        contentType: 'application/zip',
      });
      console.log("✅ ZIP文件上传成功，文件名:", fileName);
      return fileName;
      
    } catch (error) {
      console.error("❌ ZIP文件上传失败:", error);
      throw error;
    }
  }

  /**
   * 使用 R2 URL 直接创建任务（避免文件上传）
   */
  async createTaskWithR2Url(options: CreateTaskOptions & { r2Url: string }): Promise<string> {
    try {
      const { workflowId, nodeInfoList, taskRecordId, r2Url } = options;
      console.log("🚀 创建任务 (使用 R2 URL)");
      console.log("[RunningHub] workflowId=", workflowId);
      console.log("[RunningHub] r2Url=", r2Url);

      const webhookUrl = taskRecordId 
        ? `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/webhooks/runninghub`
        : undefined;

      // 直接使用 R2 URL 作为视频输入
      const nodeInfoListWithR2Url = nodeInfoList.map(node => {
        if (node.fieldName === 'video_file' || node.fieldName === 'video') {
          return {
            ...node,
            fieldValue: r2Url // 直接使用 R2 URL
          };
        }
        return node;
      });

      const payload = {
        apiKey: this.apiKey,
        workflowId,
        nodeInfoList: nodeInfoListWithR2Url,
        ...(webhookUrl && { webhookUrl })
      };

      console.log("📤 发送到 RunningHub 的 payload:", JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.baseUrl}/task/openapi/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let bodyText: string | undefined;
        try { bodyText = await response.text(); } catch {}
        throw new Error(`Create task failed: status=${response.status} ${response.statusText} body=${bodyText || ''}`);
      }

      const result: RunningHubCreateTaskResponse = await response.json();
      if (result.code !== 0) throw new Error(`Create task failed (api): ${result.msg}`);
      return result.data.taskId;
    } catch (error) {
      console.error("❌ 创建任务失败 (R2 URL):", error);
      throw error;
    }
  }

  /**
   * 通用创建任务
   */
  async createTaskGeneric(options: CreateTaskOptions): Promise<string> {
    try {
      const { workflowId, nodeInfoList, taskRecordId } = options;
      console.log("🚀 创建任务 (通用)");
      console.log("[RunningHub] workflowId=", workflowId);

      const webhookUrl = taskRecordId 
        ? `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/webhooks/runninghub`
        : undefined;

      const payload = {
        apiKey: this.apiKey,
        workflowId,
        nodeInfoList,
        ...(webhookUrl && { webhookUrl })
      };

      const response = await fetch(`${this.baseUrl}/task/openapi/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let bodyText: string | undefined;
        try { bodyText = await response.text(); } catch {}
        throw new Error(`Create task failed: status=${response.status} ${response.statusText} body=${bodyText || ''}`);
      }

      const result: RunningHubCreateTaskResponse = await response.json();
      if (result.code !== 0) throw new Error(`Create task failed (api): ${result.msg}`);
      return result.data.taskId;
    } catch (error) {
      console.error("❌ 创建任务失败 (通用):", error);
      throw error;
    }
  }

  /**
   * 取消 RunningHub 任务
   */
  async cancelTask(taskId: string): Promise<boolean> {
    try {
      console.log(`🚫 取消 RunningHub 任务: ${taskId}`);
      
      const payload = {
        apiKey: this.apiKey,
        taskId: taskId
      };

      const response = await fetch(`${this.baseUrl}/task/openapi/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let bodyText: string | undefined;
        try { bodyText = await response.text(); } catch {}
        throw new Error(`Cancel task failed: status=${response.status} ${response.statusText} body=${bodyText || ''}`);
      }

      const result = await response.json();
      if (result.code !== 0) {
        console.warn(`⚠️ 取消任务失败 (api): ${result.msg}`);
        return false;
      }
      
      console.log(`✅ RunningHub 任务 ${taskId} 已取消`);
      return true;
    } catch (error) {
      console.error("❌ 取消任务失败:", error);
      return false;
    }
  }

  /**
   * 创建图片去水印任务（兼容旧接口）
   */
  async createWatermarkRemovalTask(filename: string, taskRecordId?: number): Promise<string> {
    try {
      return this.createTaskGeneric({
        workflowId: this.workflowId,
        nodeInfoList: [
          { nodeId: '377', fieldName: 'upload', fieldValue: filename },
        ],
        taskRecordId,
      });
      
    } catch (error) {
      console.error("❌ 创建去水印任务失败:", error);
      throw error;
    }
  }

  /**
   * 创建视频去水印任务（可配置上传节点）
   * workflowId 必须从环境变量中提供，不允许通过参数传递
   */
  async createVideoWatermarkRemovalTask(filename: string, taskRecordId?: number, options?: { workflowId: string; uploadNodeId?: string; uploadFieldName?: string; }): Promise<string> {
    // workflowId 必须从参数中提供（由调用方从环境变量中选择）
    const workflowId = options?.workflowId;
    if (!workflowId) {
      throw new Error('workflowId is required and must be provided from environment variables');
    }
    const uploadNodeId = options?.uploadNodeId || '205';
    const uploadFieldName = options?.uploadFieldName || 'video';
    return this.createTaskGeneric({
      workflowId,
      nodeInfoList: [
        { nodeId: uploadNodeId, fieldName: uploadFieldName, fieldValue: filename },
      ],
      taskRecordId,
    });
  }

  /**
   * 查询任务状态
   */
  async getTaskStatus(taskId: string): Promise<RunningHubTaskStatus> {
    try {
      console.log(`🔍 查询任务状态: ${taskId}`);
      
      const payload = {
        apiKey: this.apiKey,
        taskId: taskId
      };

      console.log("📤 [RunningHub] 发送请求到:", `${this.baseUrl}/task/openapi/status`);
      console.log("📤 [RunningHub] 请求方法: POST");
      console.log("📤 [RunningHub] 请求头: Content-Type: application/json");
      console.log("📤 [RunningHub] 请求体:", JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.baseUrl}/task/openapi/status?t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(payload),
      });

      console.log("📥 [RunningHub] 响应状态:", response.status, response.statusText);
      console.log("📥 [RunningHub] 响应头:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let bodyText: string | undefined;
        try {
          bodyText = await response.text();
          console.log("📥 [RunningHub] 错误响应体:", bodyText);
        } catch {}
        throw new Error(`Get status failed: status=${response.status} ${response.statusText} body=${bodyText || ''}`);
      }

      const result = await response.json();
      console.log("📥 [RunningHub] 成功响应体:", JSON.stringify(result, null, 2));
      
      // 检查返回值是否有 code 字段
      if (typeof result.code !== 'number') {
        console.warn("⚠️ RunningHub API 返回格式异常，缺少 code 字段");
        return result; // 直接返回原始结果
      }
      
      if (result.code !== 0) {
        throw new Error(`Get status failed (api): ${result.msg || 'Unknown error'}`);
      }

      // 检查是否有 data 字段
      if (!result.data) {
        console.warn("⚠️ RunningHub API 返回成功但缺少 data 字段");
        // 如果没有 data 字段，可能整个 result 就是数据
        // 构造一个符合 RunningHubTaskStatus 格式的对象
        return {
          code: 0,
          msg: "success",
          data: result
        };
      }

      console.log(`📊 任务状态: ${result.data?.status || result.data}`);
      return result;
      
    } catch (error) {
      console.error("❌ 查询任务状态失败:", error);
      throw error;
    }
  }

  /**
   * 获取任务结果
   */
  async getTaskResult(taskId: string): Promise<any> {
    try {
      console.log(`🔍 获取任务结果: ${taskId}`);
      
      const payload = {
        apiKey: this.apiKey,
        taskId: taskId
      };

      console.log("📤 [RunningHub] 发送请求到:", `${this.baseUrl}/task/openapi/outputs`);
      console.log("📤 [RunningHub] 请求方法: POST");
      console.log("📤 [RunningHub] 请求头: Content-Type: application/json");
      console.log("📤 [RunningHub] 请求体:", JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.baseUrl}/task/openapi/outputs?t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(payload),
      });

      console.log("📥 [RunningHub] 响应状态:", response.status, response.statusText);
      console.log("📥 [RunningHub] 响应头:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let bodyText: string | undefined;
        try {
          bodyText = await response.text();
          console.log("📥 [RunningHub] 错误响应体:", bodyText);
        } catch {}
        throw new Error(`Get result failed: status=${response.status} ${response.statusText} body=${bodyText || ''}`);
      }

      const result = await response.json();
      console.log("📥 [RunningHub] 成功响应体:", JSON.stringify(result, null, 2));
      
      if (result.code !== 0) {
        // 检查是否是任务仍在运行中的错误
        if (result.code === 804 && result.msg === 'APIKEY_TASK_IS_RUNNING') {
          console.log(`ℹ️ 任务仍在运行中，无法获取结果: ${taskId}`);
          // 返回一个特殊的结果，表示任务仍在运行
          return {
            code: 804,
            msg: 'APIKEY_TASK_IS_RUNNING',
            data: null
          };
        }
        throw new Error(`Get result failed (api): ${result.msg || 'Unknown error'}`);
      }

      console.log(`📊 任务结果获取成功: ${taskId}`);
      return result;
      
    } catch (error) {
      console.error("❌ 获取任务结果失败:", error);
      throw error;
    }
  }
}

export const runninghubAPI = new RunningHubAPI();
