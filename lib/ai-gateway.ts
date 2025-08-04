import { env } from "@/env.mjs";

export interface ReplicateImageRequest {
  model: string;
  input_image_url?: string;
  input_prompt: string;
  aspect_ratio: string;
  is_private: number;
  user_id: string;
  lora_name?: string;
  locale: string;
}

export interface ReplicateImageResponse {
  replicate_id: string;
  error?: string;
}

export interface GeminiTextRequest {
  messages: Array<{
    role: string;
    content: string;
  }>;
  model: string;
  temperature?: number;
  max_tokens?: number;
}

export interface GeminiTextResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: string;
}

class CloudflareAIGateway {
  private baseUrl: string;
  private apiToken: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor() {
    // 根据 Cloudflare AI Gateway 文档，URL 格式为：
    // https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}
    this.baseUrl = env.CLOUDFLARE_AI_GATEWAY_URL;
    this.apiToken = env.REPLICATE_API_TOKEN;
  }

  /**
   * 通过 Cloudflare AI Gateway 调用 Replicate 图像生成
   * 根据 Cloudflare 文档：https://developers.cloudflare.com/ai-gateway/providers/replicate/
   */
  async generateImageViaReplicate(
    request: ReplicateImageRequest
  ): Promise<ReplicateImageResponse> {
    const startTime = Date.now();
    
    try {
      this.logRequest('Replicate Image Generation', request);
      
      const headers = new Headers();
      headers.append("Content-Type", "application/json");
      // 根据 Cloudflare 文档，使用 Token 认证
      headers.append("Authorization", `Token ${this.apiToken}`);

      const payload = {
        version: this.getReplicateModelVersion(request.model),
        input: {
          prompt: request.input_prompt,
          aspect_ratio: request.aspect_ratio,
          ...(request.input_image_url && { image: request.input_image_url }),
          output_quality: 90,
          safety_tolerance: 2,
          prompt_upsampling: false,
          ...(request.lora_name && { lora: request.lora_name }),
        },
        // 开发模式下暂时禁用 webhook，生产环境使用真实 webhook
        ...(process.env.NODE_ENV !== "development" && {
          webhook: `${env.NEXTAUTH_URL}/api/webhooks/replicate`,
          webhook_events_filter: ["start", "output", "logs", "completed"],
        }),
      };

      // 根据 Cloudflare 文档，URL 结构为 /replicate/predictions
      const response = await this.makeRequestWithRetry(
        `${this.baseUrl}/replicate/predictions`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Replicate API error: ${data.error}`);
      }

      const result = {
        replicate_id: data.id,
        error: data.error,
      };

      this.logResponse('Replicate Image Generation', result, Date.now() - startTime);
      return result;
    } catch (error) {
      this.logError('Replicate Image Generation', error, Date.now() - startTime);
      throw error;
    }
  }

  /**
   * 通过 AI Gateway 调用 Gemini 文本生成
   */
  async generateTextViaGemini(
    request: GeminiTextRequest
  ): Promise<GeminiTextResponse> {
    const startTime = Date.now();
    
    try {
      this.logRequest('Gemini Text Generation', request);
      
      const headers = new Headers();
      headers.append("Content-Type", "application/json");
      headers.append("Authorization", `Bearer ${env.GEMINI_API_KEY}`);

      const payload = {
        contents: request.messages.map((msg) => ({
          parts: [{ text: msg.content }],
          role: msg.role === "user" ? "user" : "model",
        })),
        generationConfig: {
          temperature: request.temperature || 0.7,
          maxOutputTokens: request.max_tokens || 1000,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      };

      const response = await this.makeRequestWithRetry(
        `${this.baseUrl}/google-ai-studio/v1/models/${request.model}:generateContent`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Gemini API error: ${data.error.message || data.error}`);
      }

      // 转换 Gemini 响应格式为 OpenAI 兼容格式
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      const result = {
        choices: [
          {
            message: {
              content,
            },
          },
        ],
        error: data.error,
      };

      this.logResponse('Gemini Text Generation', result, Date.now() - startTime);
      return result;
    } catch (error) {
      this.logError('Gemini Text Generation', error, Date.now() - startTime);
      throw error;
    }
  }

  /**
   * 获取 Replicate 模型版本
   * 根据 Replicate 官方模型版本配置
   */
  private getReplicateModelVersion(model: string): string {
    const modelVersions = {
      "flux-pro": "black-forest-labs/flux-pro",
      "flux-dev": "black-forest-labs/flux-dev", 
      "flux-schnell": "black-forest-labs/flux-schnell",
      "flux-general": "black-forest-labs/flux-dev", // 使用 dev 版本作为通用模型
      "flux-freeSchnell": "black-forest-labs/flux-schnell", // 免费版本使用 schnell
    };

    return modelVersions[model] || modelVersions["flux-freeSchnell"];
  }

  /**
   * 通过 Cloudflare AI Gateway 获取 Replicate 任务状态
   */
  async getTaskStatus(replicateId: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logRequest('Get Task Status', { replicateId });
      
      const headers = new Headers();
      headers.append("Authorization", `Token ${this.apiToken}`);

      // 根据 Cloudflare 文档，URL 结构为 /replicate/predictions/{id}
      const response = await this.makeRequestWithRetry(
        `${this.baseUrl}/replicate/predictions/${replicateId}`,
        {
          method: "GET",
          headers,
        }
      );

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Get task status error: ${data.error}`);
      }

      this.logResponse('Get Task Status', data, Date.now() - startTime);
      return data;
    } catch (error) {
      this.logError('Get Task Status', error, Date.now() - startTime);
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
      const response = await fetch(url, options);
      
      if (!response.ok) {
        if (response.status >= 500 && retryCount < this.maxRetries) {
          console.warn(`Request failed with status ${response.status}, retrying in ${this.retryDelay}ms...`);
          await this.delay(this.retryDelay * Math.pow(2, retryCount));
          return this.makeRequestWithRetry(url, options, retryCount + 1);
        }
        
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      return response;
    } catch (error) {
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        console.warn(`Request failed: ${error.message}, retrying in ${this.retryDelay}ms...`);
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

  /**
   * 记录请求日志
   */
  private logRequest(operation: string, data: any): void {
    if (env.APP_ENV === 'development') {
      console.log(`[AI Gateway] ${operation} Request:`, {
        operation,
        timestamp: new Date().toISOString(),
        data: this.sanitizeLogData(data),
      });
    }
  }

  /**
   * 记录响应日志
   */
  private logResponse(operation: string, data: any, duration: number): void {
    if (env.APP_ENV === 'development') {
      console.log(`[AI Gateway] ${operation} Response:`, {
        operation,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        data: this.sanitizeLogData(data),
      });
    }
  }

  /**
   * 记录错误日志
   */
  private logError(operation: string, error: any, duration: number): void {
    console.error(`[AI Gateway] ${operation} Error:`, {
      operation,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      error: error.message,
      stack: error.stack,
    });
  }

  /**
   * 清理日志数据，移除敏感信息
   */
  private sanitizeLogData(data: any): any {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = { ...data };
    
    // 移除敏感字段
    const sensitiveFields = ['apiKey', 'token', 'authorization', 'Authorization'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '***';
      }
    });
    
    return sanitized;
  }
}

export const aiGateway = new CloudflareAIGateway(); 