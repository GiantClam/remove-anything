# Remove Anything AI - Cloudflare 部署指南

## 📋 部署概述

本指南将帮助您将 Remove Anything AI 项目部署到 Cloudflare 生态系统中。

## 🌟 架构概述

- **前端**: Next.js 14 (静态导出)
- **平台**: Cloudflare Pages
- **数据库**: Cloudflare D1 (SQLite)
- **存储**: Cloudflare R2 (S3 兼容)
- **认证**: Google OAuth (NextAuth.js)
- **AI 服务**: Cloudflare AI Gateway
- **分析**: Google Analytics
- **邮件**: Resend

## 🚀 部署步骤

### 1. 准备工作

#### 克隆项目
```bash
git clone https://github.com/your-username/remove-anything.git
cd remove-anything
npm install
```

#### 环境变量配置
```bash
# 复制环境变量模板
cp env.cloudflare.template .env.local

# 编辑环境变量
nano .env.local
```

### 2. Cloudflare 服务设置

#### 2.1 创建 Cloudflare Pages 项目
1. 登录 Cloudflare 控制台
2. 进入 "Pages" 部分
3. 点击 "创建项目"
4. 连接到 Git 仓库
5. 配置构建设置：
   - 构建命令: `npm run build:cloudflare`
   - 输出目录: `out`
   - 环境变量: 从 `env.cloudflare.template` 复制

#### 2.2 创建 Cloudflare D1 数据库
```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 创建 D1 数据库
wrangler d1 create remove-anything-db

# 运行数据库迁移
wrangler d1 migrations apply remove-anything-db
```

#### 2.3 创建 Cloudflare R2 存储桶
```bash
# 创建 R2 存储桶
wrangler r2 bucket create remove-anything-storage

# 配置 CORS 策略
wrangler r2 bucket cors put remove-anything-storage --cors-file r2-cors.json
```

#### 2.4 设置 Cloudflare AI Gateway
1. 在 Cloudflare 控制台中进入 "AI Gateway"
2. 创建新的 Gateway: `remove-anything-ai-gateway`
3. 复制 Gateway URL 和 Token
4. 在环境变量中配置

### 3. 第三方服务配置

#### 3.1 Google OAuth 设置
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 Google+ API
4. 创建 OAuth 2.0 客户端 ID
5. 添加授权重定向 URI：
   - `https://your-domain.pages.dev/api/auth/callback/google`
6. 复制客户端 ID 和密钥到环境变量

#### 3.2 Google Analytics 设置
1. 访问 [Google Analytics](https://analytics.google.com/)
2. 创建新的属性
3. 复制测量 ID 到环境变量

#### 3.3 Replicate API 设置
1. 访问 [Replicate](https://replicate.com/)
2. 创建账户并获取 API Token
3. 复制 Token 到环境变量

#### 3.4 Google Gemini API 设置
1. 访问 [Google AI Studio](https://ai.google.dev/)
2. 创建 API 密钥
3. 复制密钥到环境变量

### 4. 构建和部署

#### 4.1 本地构建测试
```bash
# 生成 Prisma 客户端
npm run db:generate

# 构建项目
npm run build:cloudflare

# 测试构建结果
npm run start
```

#### 4.2 部署到 Cloudflare
```bash
# 使用自动化部署脚本
npm run deploy:cloudflare

# 或手动部署
wrangler pages publish out --project-name remove-anything
```

### 5. 部署后配置

#### 5.1 数据库迁移
```bash
# 在生产环境中运行数据库迁移
wrangler d1 migrations apply remove-anything-db --env production
```

#### 5.2 域名设置（可选）
1. 在 Cloudflare Pages 项目设置中添加自定义域名
2. 更新环境变量中的 `NEXTAUTH_URL` 和 `NEXT_PUBLIC_APP_URL`

#### 5.3 环境变量验证
```bash
# 测试 AI Gateway 连接
npm run test:ai-gateway

# 验证所有服务
curl -X GET https://your-domain.pages.dev/api/health
```

## 📊 监控和维护

### 性能监控
- Cloudflare Analytics：实时流量分析
- Google Analytics：用户行为分析
- AI Gateway Analytics：API 使用情况

### 错误监控
- Cloudflare 错误日志
- 浏览器开发者工具
- 应用程序日志

### 定期维护
- 监控 API 使用配额
- 更新依赖包
- 轮换敏感凭据
- 备份数据库

## 🔧 故障排除

### 常见问题

#### 构建失败
```bash
# 检查 Node.js 版本
node --version

# 清理 node_modules
rm -rf node_modules package-lock.json
npm install

# 重新构建
npm run build:cloudflare
```

#### 数据库连接问题
```bash
# 检查 D1 数据库状态
wrangler d1 info remove-anything-db

# 检查迁移状态
wrangler d1 migrations list remove-anything-db
```

#### AI Gateway 调用失败
```bash
# 测试 AI Gateway 连接
curl -X POST "https://gateway.ai.cloudflare.com/v1/your-account-id/remove-anything-ai-gateway/replicate" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"version": "test"}'
```

#### 认证问题
1. 检查 Google OAuth 配置
2. 验证回调 URL 设置
3. 确认 NEXTAUTH_SECRET 已设置

## 🎯 性能优化

### 缓存策略
- 静态资源：1 年缓存
- API 响应：根据内容类型设置
- 图片资源：CDN 边缘缓存

### 成本优化
- 使用 Cloudflare 免费层
- 优化 AI API 调用频率
- 监控存储使用量

### 安全配置
- 启用 HTTPS
- 配置 CSP 头部
- 限制 API 访问频率
- 定期更新密钥

## 📝 附录

### 有用的命令
```bash
# 查看 Cloudflare 配置
wrangler whoami
wrangler pages project list

# 监控部署
wrangler pages deployment list remove-anything

# 查看日志
wrangler pages functions logs remove-anything
```

### 相关链接
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 文档](https://developers.cloudflare.com/r2/)
- [Cloudflare AI Gateway 文档](https://developers.cloudflare.com/ai-gateway/)
- [NextAuth.js 文档](https://next-auth.js.org/)

## 🎉 完成！

恭喜！您已成功将 Remove Anything AI 部署到 Cloudflare。项目现在运行在全球边缘网络上，具有：

- ⚡ 极快的加载速度
- 🌍 全球 CDN 加速
- 🔒 企业级安全性
- 💰 成本效益
- 📈 自动扩展
- 🤖 强大的 AI 功能

享受您的 AI 驱动的图像编辑应用程序！ 