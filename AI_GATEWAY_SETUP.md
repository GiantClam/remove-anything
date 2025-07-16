# Cloudflare AI Gateway 设置指南

本指南详细说明了如何配置和使用 Cloudflare AI Gateway 来管理 AI 模型调用。

## 概述

通过 AI Gateway，我们将以下模型调用统一管理：
- **图像生成**: 通过 Replicate 调用 FLUX 模型
- **文本生成**: 通过 Google AI Studio 调用 Gemini 模型

## 设置步骤

### 1. 创建 Cloudflare AI Gateway

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 在左侧导航中选择 "AI Gateway"
3. 点击 "Create Gateway"
4. 输入 Gateway 名称（例如：`remove-anything-ai-gateway`）
5. 复制生成的 Gateway URL

### 2. 配置模型提供商

#### Replicate 配置
1. 访问 [Replicate 账户设置](https://replicate.com/account/api-tokens)
2. 创建新的 API Token
3. 记录 Token（格式：`r8_xxxxx`）

#### Google AI Studio 配置
1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 创建新的 API Key
3. 记录 API Key

### 3. 配置环境变量

在 Cloudflare Pages 或本地环境中设置以下变量：

```bash
# Cloudflare AI Gateway 配置
CLOUDFLARE_AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/your_account_id/your_gateway_slug
CLOUDFLARE_AI_GATEWAY_TOKEN=your_cloudflare_ai_gateway_token

# 模型 API Keys
REPLICATE_API_TOKEN=r8_your_replicate_api_token
REPLICATE_WEBHOOK_SECRET=your_replicate_webhook_secret
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash
```

### 4. 设置 Webhook

#### Replicate Webhook 配置
1. 在 Replicate 账户中设置 Webhook URL：
   ```
   https://your-domain.com/api/webhooks/replicate
   ```
2. 生成 Webhook Secret 并设置为环境变量
3. 确保 Webhook 接收以下事件：
   - `start`
   - `output`
   - `logs`
   - `completed`

## 支持的模型

### 图像生成模型（通过 Replicate）
- **FLUX Pro**: `flux-pro` - 最高质量，适合专业用途
- **FLUX Dev**: `flux-dev` - 平衡质量和速度
- **FLUX Schnell**: `flux-schnell` - 最快速度，适合快速原型
- **FLUX General**: `flux-general` - 通用模型，支持 LoRA

### 文本生成模型（通过 Gemini）
- **Gemini 1.5 Flash**: `gemini-1.5-flash` - 快速响应，适合提示生成
- **Gemini 1.5 Pro**: `gemini-1.5-pro` - 高质量，适合复杂任务

## API 使用示例

### 图像生成
```typescript
import { aiGateway } from '@/lib/ai-gateway';

const result = await aiGateway.generateImageViaReplicate({
  model: 'flux-schnell',
  input_prompt: 'A beautiful sunset over mountains',
  aspect_ratio: '16:9',
  is_private: 1,
  user_id: 'user123',
  locale: 'en'
});
```

### 文本生成
```typescript
import { aiGateway } from '@/lib/ai-gateway';

const result = await aiGateway.generateTextViaGemini({
  messages: [
    {
      role: 'system',
      content: 'You are a helpful assistant.'
    },
    {
      role: 'user',
      content: 'Generate a creative image prompt'
    }
  ],
  model: 'gemini-1.5-flash',
  temperature: 0.7,
  max_tokens: 500
});
```

## 功能特性

### 自动重试机制
- 网络错误时自动重试（最多 3 次）
- 指数退避延迟策略
- 智能错误分类

### 日志记录
- 请求/响应详细日志
- 性能监控（响应时间）
- 错误追踪和调试

### 安全性
- API Key 安全存储
- 请求签名验证
- 敏感信息过滤

### Webhook 支持
- 实时任务状态更新
- 自动数据库同步
- 事件驱动架构

## 监控和调试

### 查看 AI Gateway 统计
1. 访问 Cloudflare Dashboard
2. 进入 AI Gateway 控制台
3. 查看请求统计、延迟和错误率

### 本地调试
```bash
# 运行测试脚本
npm run test:ai-gateway

# 查看详细日志
APP_ENV=development npm run dev
```

### 常见问题排查

#### 1. 认证失败
- 检查 API Token 是否正确
- 确认 Gateway URL 格式正确
- 验证环境变量是否设置

#### 2. 请求超时
- 检查网络连接
- 确认 Cloudflare 服务状态
- 查看重试日志

#### 3. Webhook 未接收
- 验证 Webhook URL 可访问
- 检查签名验证逻辑
- 确认 Webhook Secret 正确

## 性能优化

### 缓存策略
- 启用 Cloudflare 缓存
- 设置适当的 TTL
- 使用 CDN 加速

### 并发控制
- 实现请求队列
- 设置速率限制
- 监控 API 配额

### 成本优化
- 选择合适的模型
- 批量处理请求
- 监控使用量

## 迁移检查清单

- [ ] Cloudflare AI Gateway 已创建
- [ ] 环境变量已配置
- [ ] Replicate Webhook 已设置
- [ ] 图像生成功能正常
- [ ] 文本生成功能正常
- [ ] 任务状态查询正常
- [ ] 错误处理正常
- [ ] 日志记录正常
- [ ] 性能监控正常

## 进阶配置

### 自定义模型映射
在 `lib/ai-gateway.ts` 中修改 `getReplicateModelVersion` 方法来支持新模型。

### 扩展安全设置
在 Gemini 配置中添加更多安全过滤器：
```typescript
safetySettings: [
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  // 添加更多安全设置
]
```

### 自定义 Webhook 处理
在 `app/api/webhooks/replicate/route.ts` 中扩展 Webhook 处理逻辑。

## 支持和资源

- [Cloudflare AI Gateway 文档](https://developers.cloudflare.com/ai-gateway/)
- [Replicate API 文档](https://replicate.com/docs)
- [Google AI Studio 文档](https://ai.google.dev/)
- [项目 GitHub 仓库](https://github.com/your-repo)

---

如有问题或需要支持，请创建 GitHub Issue 或联系团队。 