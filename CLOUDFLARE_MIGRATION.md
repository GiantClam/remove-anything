# Cloudflare 迁移指南

本指南详细说明了如何将项目从 Vercel 迁移到 Cloudflare 平台，包括认证、数据库、存储和分析服务的迁移。

## 迁移概览

### 已完成的迁移
1. ✅ **认证系统**: Clerk Auth → Google Auth (NextAuth.js)
2. ✅ **数据库**: PostgreSQL → Cloudflare D1 (SQLite)
3. ✅ **存储**: AWS S3 兼容服务 → Cloudflare R2
4. ✅ **分析**: Vercel Analytics → Google Analytics
5. ✅ **AI 模型**: 直接调用 → Cloudflare AI Gateway
   - 图像生成: Replicate FLUX 模型
   - 文本生成: Google Gemini 模型

## 环境变量配置

### 新的环境变量
在 Cloudflare Pages 中设置以下环境变量：

```bash
# Google OAuth 配置
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=https://your-domain.pages.dev

# Cloudflare D1 数据库
DATABASE_URL=file:./dev.db  # 开发环境
# 生产环境会自动使用 D1

# Cloudflare R2 存储
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_REGION=auto
R2_ACCESS_KEY=your_r2_access_key
R2_SECRET_KEY=your_r2_secret_key
R2_URL_BASE=https://your-r2-domain.com
R2_BUCKET=your-bucket-name
R2_ACCOUNT_ID=your_cloudflare_account_id

# Google Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Cloudflare AI Gateway 配置
CLOUDFLARE_AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/your_account_id/your_gateway_slug
CLOUDFLARE_AI_GATEWAY_TOKEN=your_cloudflare_ai_gateway_token

# 模型 API Keys
REPLICATE_API_TOKEN=r8_your_replicate_api_token
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash

# 其他现有环境变量
NEXT_PUBLIC_SITE_URL=https://your-domain.pages.dev
STRIPE_API_KEY=your_stripe_key
# ... 其他现有变量
```

## 部署步骤

### 1. 设置 Cloudflare D1 数据库

```bash
# 创建 D1 数据库
wrangler d1 create remove-anything-db

# 运行迁移
wrangler d1 migrations apply remove-anything-db

# 更新 wrangler.toml 中的 database_id
```

### 2. 设置 Cloudflare R2 存储

```bash
# 创建 R2 存储桶
wrangler r2 bucket create remove-anything-storage

# 设置自定义域名（可选）
wrangler r2 bucket create remove-anything-storage --custom-domain your-domain.com
```

### 3. 配置 Google OAuth

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 Google+ API
4. 创建 OAuth 2.0 客户端 ID
5. 添加授权重定向 URI: `https://your-domain.pages.dev/api/auth/callback/google`

### 4. 设置 Google Analytics

1. 访问 [Google Analytics](https://analytics.google.com/)
2. 创建新的 GA4 属性
3. 获取测量 ID (G-XXXXXXXXXX)
4. 在环境变量中设置 `NEXT_PUBLIC_GA_ID`

### 5. 配置 Cloudflare AI Gateway

1. **创建 AI Gateway**：
   - 登录 Cloudflare Dashboard
   - 进入 AI Gateway 控制台
   - 创建新的 Gateway
   - 获取 Gateway URL 和 API Token

2. **配置模型提供商**：
   - 添加 Replicate 提供商（用于图像生成）
   - 添加 Google AI Studio (Gemini) 提供商（用于文本生成）

3. **获取 API Keys**：
   - Replicate API Token: https://replicate.com/account/api-tokens
   - Gemini API Key: https://makersuite.google.com/app/apikey

4. **在环境变量中设置**：
   ```bash
   # Cloudflare AI Gateway 配置
   CLOUDFLARE_AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/your_account_id/your_gateway_slug
   CLOUDFLARE_AI_GATEWAY_TOKEN=your_cloudflare_ai_gateway_token
   
   # 模型 API Keys
   REPLICATE_API_TOKEN=r8_your_replicate_api_token
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-1.5-flash
   ```

### 6. 部署到 Cloudflare Pages

```bash
# 构建项目
npm run build:cloudflare

# 或者使用 Cloudflare Pages 自动部署
# 1. 连接 GitHub 仓库
# 2. 设置构建命令: npm run build:cloudflare
# 3. 设置输出目录: out
# 4. 设置环境变量
```

## 数据迁移

### 从 PostgreSQL 到 D1

1. 导出现有数据：
```bash
pg_dump your_postgres_db > data_export.sql
```

2. 转换为 SQLite 格式（可能需要手动调整）
3. 导入到 D1：
```bash
wrangler d1 execute remove-anything-db --file=converted_data.sql
```

### 从 S3 到 R2

使用 rclone 或类似工具迁移文件：
```bash
rclone copy s3:your-bucket r2:remove-anything-storage
```

## 测试清单

- [ ] 用户可以使用 Google 账户登录
- [ ] 数据库查询正常工作
- [ ] 文件上传到 R2 存储
- [ ] Google Analytics 跟踪正常
- [ ] AI Gateway 图像生成正常（通过 Replicate）
- [ ] AI Gateway 文本生成正常（通过 Gemini）
- [ ] API 路由正常响应
- [ ] 静态资源加载正常

## 故障排除

### 常见问题

1. **认证失败**: 检查 Google OAuth 配置和重定向 URI
2. **数据库连接失败**: 确认 D1 数据库 ID 正确配置
3. **存储问题**: 验证 R2 访问密钥和权限
4. **构建失败**: 检查依赖和环境变量

### 有用的命令

```bash
# 查看 D1 数据库信息
wrangler d1 info remove-anything-db

# 查看 R2 存储桶
wrangler r2 bucket list

# 本地开发
npm run dev

# 构建检查
npm run build:cloudflare
```

## 性能优化

- 启用 Cloudflare CDN
- 配置缓存规则
- 使用 Cloudflare 图片优化
- 启用 Brotli 压缩

## 监控和日志

- 使用 Cloudflare Analytics
- 设置错误监控（Sentry 已配置）
- 配置 Cloudflare Workers 日志

## 回滚计划

如果需要回滚到 Vercel：
1. 恢复原始环境变量
2. 重新部署到 Vercel
3. 更新 DNS 记录
4. 数据同步（如果需要） 