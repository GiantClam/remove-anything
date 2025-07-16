# 环境变量配置指南

请创建一个 `.env.local` 文件，并添加以下环境变量配置：

## Cloudflare AI Gateway 配置

```env
# Cloudflare AI Gateway 配置
CLOUDFLARE_AI_GATEWAY_URL="https://gateway.ai.cloudflare.com/v1/9630806d5a588fc350ee64c395005cfa/openai"
CLOUDFLARE_AI_GATEWAY_TOKEN="bjGAwxEZi18PDSYjjUxWntZLDhq6fXp8wLlUp3wh"

# Replicate API 配置
REPLICATE_API_TOKEN="r8_XVqdElM4gHp9s393WV7X5IlA0GmgJz54X80Nt"
REPLICATE_WEBHOOK_SECRET=""

# Cloudflare 基础配置
CLOUDFLARE_KV_NAMESPACE_ID="6c1c975a74a048cea8fa67bc2db4a1c7"
CLOUDFLARE_KV_ACCOUNT_ID="9630806d5a588fc350ee64c395005cfa"
CLOUDFLARE_KV_API_TOKEN="bjGAwxEZi18PDSYjjUxWntZLDhq6fXp8wLlUp3wh"
```

## 完整 .env.local 配置

请将以下配置复制到你的 `.env.local` 文件中：

```env
# 数据库配置
DATABASE_URL="file:./dev.db"

# NextAuth 配置
NEXTAUTH_SECRET="nextauth-secret-placeholder"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="google-client-id-placeholder"
GOOGLE_CLIENT_SECRET="google-client-secret-placeholder"

# Cloudflare 配置
CLOUDFLARE_KV_NAMESPACE_ID="6c1c975a74a048cea8fa67bc2db4a1c7"
CLOUDFLARE_KV_ACCOUNT_ID="9630806d5a588fc350ee64c395005cfa"
CLOUDFLARE_KV_API_TOKEN="bjGAwxEZi18PDSYjjUxWntZLDhq6fXp8wLlUp3wh"

# Cloudflare AI Gateway 配置
CLOUDFLARE_AI_GATEWAY_URL="https://gateway.ai.cloudflare.com/v1/9630806d5a588fc350ee64c395005cfa/openai"
CLOUDFLARE_AI_GATEWAY_TOKEN="bjGAwxEZi18PDSYjjUxWntZLDhq6fXp8wLlUp3wh"

# Replicate API 配置
REPLICATE_API_TOKEN="r8_XVqdElM4gHp9s393WV7X5IlA0GmgJz54X80Nt"
REPLICATE_WEBHOOK_SECRET=""

# Gemini API 配置
GEMINI_API_KEY="gemini-api-key-placeholder"
GEMINI_MODEL="gemini-1.5-flash"

# R2 存储配置
R2_ENDPOINT="https://9630806d5a588fc350ee64c395005cfa.r2.cloudflarestorage.com"
R2_REGION="auto"
R2_ACCESS_KEY="r2-access-key-placeholder"
R2_SECRET_KEY="r2-secret-key-placeholder"
R2_URL_BASE="https://remove-anything.9630806d5a588fc350ee64c395005cfa.r2.cloudflarestorage.com"
R2_BUCKET="remove-anything"
R2_ACCOUNT_ID="9630806d5a588fc350ee64c395005cfa"

# Stripe 配置
STRIPE_API_KEY="sk_test_placeholder"
STRIPE_WEBHOOK_SECRET="whsec_placeholder"

# 应用配置
APP_ENV="development"
HASHID_SALT="dev-salt-change-in-production"
RESEND_API_KEY="re_placeholder"
LOG_SNAG_TOKEN="log-snag-token-placeholder"
TASK_HEADER_KEY="task-header-key-placeholder"
FLUX_HEADER_KEY="flux-header-key-placeholder"
FLUX_CREATE_URL="https://placeholder.com/create"
FLUX_AI_PROMPT="Generate a high-quality image based on the following prompt"

# Webhook 配置
WEBHOOK_SECRET="webhook-secret-placeholder"

# 链接预览配置
LINK_PREVIEW_API_BASE_URL=""
SITE_NOTIFICATION_EMAIL_TO=""

# 网站配置
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_SITE_EMAIL_FROM="noreply@localhost"
NEXT_PUBLIC_SITE_LINK_PREVIEW_ENABLED="false"

# Stripe 产品配置
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PLAN_ID="price_placeholder_monthly"
NEXT_PUBLIC_STRIPE_PRO_YEARLY_PLAN_ID="price_placeholder_yearly"
NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PLAN_ID="price_placeholder_business_monthly"
NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PLAN_ID="price_placeholder_business_yearly"

# 分析配置
NEXT_PUBLIC_UMAMI_DATA_ID=""
NEXT_PUBLIC_GA_ID=""
```

## AI Gateway 配置说明

### Cloudflare AI Gateway 端点配置

根据 [Cloudflare AI Gateway - Replicate 文档](https://developers.cloudflare.com/ai-gateway/providers/replicate/)，AI Gateway 的端点格式为：

```
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/replicate
```

在你的配置中：
- **Account ID**: `9630806d5a588fc350ee64c395005cfa`
- **Gateway ID**: `openai`
- **完整端点**: `https://gateway.ai.cloudflare.com/v1/9630806d5a588fc350ee64c395005cfa/openai`

### Replicate 认证

根据 Cloudflare 文档，访问 Replicate 通过 AI Gateway 时需要使用 `Token` 认证格式：

```
Authorization: Token {replicate_api_token}
```

### 支持的 Flux 模型

项目支持以下 Flux 模型：
- `flux-pro`: black-forest-labs/flux-pro
- `flux-dev`: black-forest-labs/flux-dev
- `flux-schnell`: black-forest-labs/flux-schnell
- `flux-general`: black-forest-labs/flux-dev (通用模型)
- `flux-freeSchnell`: black-forest-labs/flux-schnell (免费版本)

## 快速开始

1. 创建 `.env.local` 文件并复制上述配置
2. 运行 `npm run dev` 启动开发服务器
3. 访问 `http://localhost:3000` 测试 AI 图片生成功能

## 验证配置

你可以通过以下方式验证 AI Gateway 配置是否正确：

1. 访问应用的图片生成页面
2. 输入一个提示词并生成图片
3. 检查控制台日志是否显示 AI Gateway 请求成功

如果遇到问题，请检查：
- Replicate API Token 是否有效
- Cloudflare Account ID 是否正确
- Gateway ID 是否正确配置 