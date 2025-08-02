# Vercel 部署环境变量配置指南

> **Remove Anything** 项目 Vercel 部署完整环境变量配置

## 🎯 配置优先级

### 立即部署（最小配置）⭐
这些变量是项目**立即可用**的最小配置：

```bash
# =============================================================================
# 核心必需变量（立即部署）
# =============================================================================

# 🔒 身份验证（必需）
NEXTAUTH_SECRET=your-random-secret-string-here-32-chars-min
NEXTAUTH_URL=https://your-vercel-app.vercel.app

# 🌐 应用基础配置
NEXT_PUBLIC_SITE_URL=https://your-vercel-app.vercel.app
NEXT_PUBLIC_SITE_EMAIL_FROM=noreply@your-domain.com

# 🗄️ 数据库（开发用SQLite）
DATABASE_URL=file:./dev.db

# 🔑 基础安全
HASHID_SALT=your-random-hashid-salt-here
WEBHOOK_SECRET=your-webhook-secret-here
```

### 完整功能配置（推荐）⭐⭐⭐
添加以下变量解锁所有功能：

#### 🤖 AI 功能配置
```bash
# Google Gemini API（文本生成）
GEMINI_API_KEY=your-gemini-api-key-from-ai-studio
GEMINI_MODEL=gemini-1.5-flash

# Replicate API（图像生成）
REPLICATE_API_TOKEN=r8_your-replicate-api-token
REPLICATE_WEBHOOK_SECRET=your-replicate-webhook-secret

# Flux AI 提示词
FLUX_AI_PROMPT=your-custom-flux-prompt-here
```

#### 🔐 Google OAuth 认证
```bash
# Google OAuth 配置（用户登录）
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### 💳 支付功能（Stripe）
```bash
# Stripe 支付配置
STRIPE_API_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-webhook-secret

# Stripe 产品价格 ID
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PLAN_ID=price_your-monthly-plan-id
NEXT_PUBLIC_STRIPE_PRO_YEARLY_PLAN_ID=price_your-yearly-plan-id
NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PLAN_ID=price_your-business-monthly-id
NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PLAN_ID=price_your-business-yearly-id
```

#### 📧 邮件服务
```bash
# Resend 邮件服务
RESEND_API_KEY=re_your-resend-api-key
```

#### 📊 分析和监控（可选）
```bash
# Google Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Umami 分析
NEXT_PUBLIC_UMAMI_DATA_ID=your-umami-data-id

# 错误监控
SENTRY_DSN=your-sentry-dsn
```

## 🚀 Vercel 部署步骤

### 1. **通过 Vercel Dashboard 设置**

1. 进入 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择您的项目
3. 进入 **Settings** → **Environment Variables**
4. 逐个添加上述环境变量

### 2. **通过 Vercel CLI 设置**

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 设置环境变量
vercel env add NEXTAUTH_SECRET
vercel env add GOOGLE_CLIENT_ID
vercel env add GEMINI_API_KEY
# ... 继续添加其他变量

# 重新部署
vercel --prod
```

### 3. **批量导入环境变量**

创建 `.env.production` 文件：
```bash
NEXTAUTH_SECRET=your-secret
GOOGLE_CLIENT_ID=your-client-id
GEMINI_API_KEY=your-api-key
# ... 其他变量
```

然后使用：
```bash
vercel env pull .env.production
```

## 🎯 API 密钥获取指南

### 🔑 **Google OAuth 设置**
1. 访问 [Google Cloud Console](https://console.cloud.google.com)
2. 创建项目 → APIs & Services → Credentials
3. 创建 OAuth 2.0 Client ID
4. 设置授权域名：`your-vercel-app.vercel.app`
5. 设置回调 URL：`https://your-vercel-app.vercel.app/api/auth/callback/google`

### 🤖 **Google Gemini API**
1. 访问 [Google AI Studio](https://aistudio.google.com)
2. 点击 **Get API Key**
3. 创建项目并生成 API 密钥

### 🎨 **Replicate API**
1. 访问 [Replicate](https://replicate.com)
2. 注册账户 → Account → API tokens
3. 创建 API token

### 💳 **Stripe 支付**
1. 访问 [Stripe Dashboard](https://dashboard.stripe.com)
2. Developers → API keys
3. 获取 Secret key 和设置 Webhook

### 📧 **Resend 邮件**
1. 访问 [Resend](https://resend.com)
2. 注册账户 → API Keys
3. 创建 API key

## 🔒 安全最佳实践

### 密钥生成
```bash
# 生成 NEXTAUTH_SECRET
openssl rand -base64 32

# 生成 HASHID_SALT
openssl rand -hex 16

# 生成 WEBHOOK_SECRET
openssl rand -base64 24
```

### 环境变量验证
```bash
# 本地验证配置
npm run build

# 检查环境变量
node -e "console.log(process.env.NEXTAUTH_SECRET ? '✅ NEXTAUTH_SECRET set' : '❌ Missing NEXTAUTH_SECRET')"
```

## 📊 功能优先级矩阵

| 功能模块 | 必需变量 | 影响功能 | 紧急程度 |
|---------|---------|---------|---------|
| **用户认证** | `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_*` | 用户登录 | 🔴 高 |
| **AI 图像生成** | `REPLICATE_API_TOKEN` | 核心功能 | 🔴 高 |
| **AI 文本生成** | `GEMINI_API_KEY` | 核心功能 | 🔴 高 |
| **支付系统** | `STRIPE_*` | 付费功能 | 🟡 中 |
| **邮件通知** | `RESEND_API_KEY` | 通知功能 | 🟡 中 |
| **数据分析** | `NEXT_PUBLIC_GA_ID` | 分析统计 | 🟢 低 |

## 🎯 部署检查清单

### 部署前验证
- [ ] ✅ `NEXTAUTH_SECRET` 已设置（32字符以上）
- [ ] ✅ `NEXTAUTH_URL` 匹配部署域名
- [ ] ✅ Google OAuth 回调 URL 已配置
- [ ] ✅ 本地构建成功 (`npm run build`)
- [ ] ✅ 环境变量无 placeholder 值

### 部署后测试
- [ ] ✅ 网站可以正常访问
- [ ] ✅ 用户可以登录
- [ ] ✅ AI 生成功能正常
- [ ] ✅ 支付流程正常（如启用）

## ⚠️ 常见问题

### 1. 认证失败
**错误**: `NextAuth configuration error`
**解决**: 检查 `NEXTAUTH_SECRET` 和 `NEXTAUTH_URL` 配置

### 2. API 调用失败
**错误**: `API key not found`
**解决**: 确认 API 密钥已正确设置且有效

### 3. 构建失败
**错误**: `Environment validation failed`
**解决**: 设置 `SKIP_ENV_VALIDATION=true` 或完善环境变量

---

## 📞 支持

如果遇到配置问题：
1. 检查 [项目文档](./README.md)
2. 查看 [环境变量模板](./env.template)  
3. 参考 [Cloudflare 迁移指南](./CLOUDFLARE_DEPLOYMENT_GUIDE.md)

**重要**: 永远不要将真实的 API 密钥提交到代码仓库！ 