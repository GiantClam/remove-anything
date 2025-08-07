import { env } from "@/env.mjs";

export interface ReplicateBackgroundRemovalRequest {
  image: string;
  resolution?: string;
}

export interface ReplicateBackgroundRemovalResponse {
  output?: string;
  error?: string;
}

export interface ReplicateAsyncResponse {
  id: string;
  status: string;
  urls?: {
    get: string;
    cancel: string;
    stream?: string;
  };
}

class CloudflareAIGateway {
  private baseUrl: string;
  private replicateApiToken: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor() {
    this.baseUrl = env.CLOUDFLARE_AI_GATEWAY_URL;
    this.replicateApiToken = env.REPLICATE_API_TOKEN;
  }

  /**
   * 通过 Cloudflare AI Gateway 异步调用 Replicate 背景移除
   * 返回任务ID，通过webhook或轮询获取结果
   */
  async removeBackgroundAsync(
    request: ReplicateBackgroundRemovalRequest
  ): Promise<ReplicateAsyncResponse> {
    const startTime = Date.now();
    
    try {
      console.log("🚀 开始异步调用 Cloudflare AI Gateway + Replicate 背景移除...");
      console.log("请求参数:", request);
      
      const headers = new Headers();
      headers.append("Content-Type", "application/json");
      headers.append("Authorization", `Bearer ${this.replicateApiToken}`);

      // 构建payload，在开发环境中不包含webhook
      const payload: any = {
        version: "men1scus/birefnet:f3e7ae8430032db9e9923c65f95ddf9f5b7ded8b7780163f18d1db67215dbd6d",
        input: {
          image: request.image,
          resolution: request.resolution || "",
        }
      };

      // 只在生产环境中添加webhook配置
      if (process.env.NODE_ENV === 'production' && env.NEXT_PUBLIC_SITE_URL.startsWith('https://')) {
        payload.webhook = `${env.NEXT_PUBLIC_SITE_URL}/api/webhooks/replicate`;
        payload.webhook_events_filter = ["completed"];
        console.log("🔗 生产环境：启用webhook回调");
      } else {
        console.log("🔧 开发环境：禁用webhook回调，使用轮询模式");
      }

      console.log("发送到Replicate的payload:", JSON.stringify(payload, null, 2));

      const response = await this.makeRequestWithRetry(
        `${this.baseUrl}/replicate/predictions`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      console.log("Replicate异步响应:", JSON.stringify(data, null, 2));
      
      if (data.error) {
        throw new Error(`Replicate API error: ${data.error}`);
      }

      const result: ReplicateAsyncResponse = {
        id: data.id,
        status: data.status,
        urls: data.urls
      };

      console.log("✅ AI Gateway 异步调用成功，任务ID:", result.id);
      return result;
    } catch (error) {
      console.error("❌ AI Gateway 异步调用失败:", error);
      throw error;
    }
  }

  /**
   * 通过 Cloudflare AI Gateway 调用 Replicate 背景移除（同步版本，保留兼容性）
   */
  async removeBackground(
    request: ReplicateBackgroundRemovalRequest
  ): Promise<ReplicateBackgroundRemovalResponse> {
    const startTime = Date.now();
    
    try {
      console.log("🚀 开始调用 Cloudflare AI Gateway + Replicate 背景移除...");
      console.log("请求参数:", request);
      
      const headers = new Headers();
      headers.append("Content-Type", "application/json");
      headers.append("Authorization", `Bearer ${this.replicateApiToken}`);

      const payload = {
        version: "men1scus/birefnet:f3e7ae8430032db9e9923c65f95ddf9f5b7ded8b7780163f18d1db67215dbd6d",
        input: {
          image: request.image,
          resolution: request.resolution || "",
        },
      };

      console.log("发送到Replicate的payload:", JSON.stringify(payload, null, 2));

      const response = await this.makeRequestWithRetry(
        `${this.baseUrl}/replicate/predictions`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      console.log("Replicate响应:", JSON.stringify(data, null, 2));
      
      if (data.error) {
        throw new Error(`Replicate API error: ${data.error}`);
      }

      const result = {
        output: data.output,
        error: data.error,
      };

      console.log("✅ AI Gateway 调用成功，结果:", result);
      return result;
    } catch (error) {
      console.error("❌ AI Gateway 调用失败:", error);
      throw error;
    }
  }

  /**
   * 获取 Replicate 任务状态
   */
  async getTaskStatus(replicateId: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      console.log("🔍 获取任务状态:", replicateId);
      
      const headers = new Headers();
      headers.append("Authorization", `Bearer ${this.replicateApiToken}`);

      const response = await this.makeRequestWithRetry(
        `${this.baseUrl}/replicate/predictions/${replicateId}`,
        {
          method: "GET",
          headers,
        }
      );

      const data = await response.json();
      console.log("任务状态响应:", JSON.stringify(data, null, 2));
      
      return data;
    } catch (error) {
      console.error("❌ 获取任务状态失败:", error);
      throw error;
    }
  }

  /**
   * 带重试的请求方法
   */
  private async makeRequestWithRetry(
    url: string,
    options: RequestInit,
    retryCount: number = 0
  ): Promise<Response> {
    try {
      console.log(`📡 发送请求到: ${url}`);
      const response = await fetch(url, options);
      
      if (!response.ok) {
        if (response.status >= 500 && retryCount < this.maxRetries) {
          console.warn(`请求失败，状态码 ${response.status}，${this.retryDelay}ms后重试...`);
          await this.delay(this.retryDelay * Math.pow(2, retryCount));
          return this.makeRequestWithRetry(url, options, retryCount + 1);
        }
        
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      return response;
    } catch (error) {
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        console.warn(`请求失败: ${error.message}，${this.retryDelay}ms后重试...`);
        await this.delay(this.retryDelay * Math.pow(2, retryCount));
        return this.makeRequestWithRetry(url, options, retryCount + 1);
      }
      
      throw error;
    }
  }

  /**
   * 判断是否为可重试的错误
   */
  private isRetryableError(error: any): boolean {
    return (
      error.name === 'TypeError' || // 网络错误
      error.message.includes('timeout') ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('ENOTFOUND')
    );
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const aiGateway = new CloudflareAIGateway(); 