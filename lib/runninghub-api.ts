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
   * 上传ZIP文件
   */
  async uploadZip(zipBuffer: Buffer): Promise<string> {
    try {
      console.log("🚀 开始上传ZIP文件到RunningHub...");
      console.log("[RunningHub] baseUrl=", this.baseUrl);
      console.log("[RunningHub] apiKey=", this.apiKey ? `${this.apiKey.substring(0, 8)}...` : "undefined");
      console.log("[RunningHub] zipBuffer size=", zipBuffer.length, "bytes");

      const formData = new FormData();
      const blob = new Blob([zipBuffer], { type: 'application/zip' });
      formData.append('file', blob, 'images.zip');
      formData.append('apiKey', this.apiKey);
      formData.append('fileType', 'zip');

      console.log("📤 [RunningHub] 发送请求到:", `${this.baseUrl}/task/openapi/upload`);
      console.log("📤 [RunningHub] 请求方法: POST");
      console.log("📤 [RunningHub] FormData 内容:");
      console.log("  - file: Blob (", blob.size, "bytes)");
      console.log("  - apiKey:", this.apiKey ? `${this.apiKey.substring(0, 8)}...` : "undefined");
      console.log("  - fileType: zip");

      const response = await fetch(`${this.baseUrl}/task/openapi/upload`, {
        method: 'POST',
        body: formData,
      });

      console.log("📥 [RunningHub] 响应状态:", response.status, response.statusText);
      console.log("📥 [RunningHub] 响应头:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let bodyText: string | undefined;
        try {
          bodyText = await response.text();
          console.log("📥 [RunningHub] 错误响应体:", bodyText);
        } catch {}
        throw new Error(`Upload failed: status=${response.status} ${response.statusText} body=${bodyText || ''}`);
      }

      const result = await response.json();
      console.log("📥 [RunningHub] 成功响应体:", JSON.stringify(result, null, 2));
      
      if (result.code !== 0) {
        console.log("❌ [RunningHub] API返回错误:", result.msg);
        throw new Error(`Upload failed (api): ${result.msg}`);
      }

      console.log("✅ ZIP文件上传成功，完整路径:", result.data.fileName);
      
      // 从完整路径中提取文件名（去掉路径前缀和.zip后缀）
      const fileName = result.data.fileName.replace(/^api\//, '').replace(/\.zip$/, '');
      console.log("✅ 提取的文件名:", fileName);
      
      return fileName;
      
    } catch (error) {
      console.error("❌ ZIP文件上传失败:", error);
      throw error;
    }
  }

  /**
   * 创建去水印任务
   */
  async createWatermarkRemovalTask(filename: string, taskRecordId?: number): Promise<string> {
    try {
      console.log("🚀 开始创建去水印任务...");
      console.log("[RunningHub] workflowId=", this.workflowId);
      
      // 构建 webhook URL，如果提供了 taskRecordId
      const webhookUrl = taskRecordId 
        ? `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/webhooks/runninghub`
        : undefined;
      
      console.log("🔗 [RunningHub] webhookUrl 构建:", {
        taskRecordId,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        webhookUrl
      });
      
      if (webhookUrl) {
        console.log("[RunningHub] webhookUrl=", webhookUrl);
      }
      
      const payload = {
        apiKey: this.apiKey,
        workflowId: this.workflowId,
        nodeInfoList: [
          {
            nodeId: "377",
            fieldName: "upload",
            fieldValue: filename
          }
        ],
        ...(webhookUrl && { webhookUrl })
      };

      console.log("📤 [RunningHub] 发送请求到:", `${this.baseUrl}/task/openapi/create`);
      console.log("📤 [RunningHub] 请求方法: POST");
      console.log("📤 [RunningHub] 请求头: Content-Type: application/json");
      console.log("📤 [RunningHub] 请求体:", JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.baseUrl}/task/openapi/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        throw new Error(`Create task failed: status=${response.status} ${response.statusText} body=${bodyText || ''}`);
      }

      const result: RunningHubCreateTaskResponse = await response.json();
      console.log("📥 [RunningHub] 成功响应体:", JSON.stringify(result, null, 2));
      
      if (result.code !== 0) {
        console.log("❌ [RunningHub] API返回错误:", result.msg);
        throw new Error(`Create task failed (api): ${result.msg}`);
      }

      console.log("✅ 去水印任务创建成功，任务ID:", result.data.taskId);
      return result.data.taskId;
      
    } catch (error) {
      console.error("❌ 创建去水印任务失败:", error);
      throw error;
    }
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

      const response = await fetch(`${this.baseUrl}/task/openapi/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

      console.log("📤 [RunningHub] 发送请求到:", `${this.baseUrl}/task/openapi/result`);
      console.log("📤 [RunningHub] 请求方法: POST");
      console.log("📤 [RunningHub] 请求头: Content-Type: application/json");
      console.log("📤 [RunningHub] 请求体:", JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.baseUrl}/task/openapi/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
