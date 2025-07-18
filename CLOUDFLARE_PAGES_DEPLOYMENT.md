# Cloudflare Pages + Functions 完整部署指南

本指南详细说明如何将 Remove Anything 项目部署到 Cloudflare Pages + Functions，实现完整的 Next.js SSR 和 API 功能。

## 🎯 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare Pages + Functions               │
├─────────────────────────────────────────────────────────────┤
│ 🌐 Pages (静态内容 + SSR)  │  ⚡ Functions (API 路由)    │
│ ├─ 预渲染页面              │  ├─ /api/* 路由              │
│ ├─ 静态资源                │  ├─ 图像优化                 │
│ └─ 动态 SSR 页面           │  └─ 服务端逻辑               │
├─────────────────────────────────────────────────────────────┤
│                    Cloudflare 绑定服务                      │
│ 🗄️ D1 数据库  │ 📦 KV 缓存  │ 🪣 R2 存储  │ 🤖 AI Gateway │
└─────────────────────────────────────────────────────────────┘
```

## 📋 部署前准备

### 1. 确保环境配置完整
```bash
# 检查配置
npm run check-config

# 如果配置不完整，请参考 CLOUDFLARE_QUICK_SETUP.md
```

### 2. 创建 Cloudflare 资源

#### 🗄️ 创建 D1 数据库
```bash
# 创建数据库
npx wrangler d1 create remove-anything-db

# 复制返回的 database_id 到 wrangler.pages.toml
```

#### 📦 创建 KV 命名空间
```bash
# 生产环境
npx wrangler kv:namespace create "remove-anything-kv"

# 开发环境（可选）
npx wrangler kv:namespace create "remove-anything-kv" --preview
```

#### 🪣 创建 R2 存储桶
```bash
# 生产环境
npx wrangler r2 bucket create remove-anything-storage

# 开发环境（可选）
npx wrangler r2 bucket create remove-anything-storage-dev
```

### 3. 更新配置文件

编辑 `wrangler.pages.toml`，替换所有 `your-*-id` 为真实的资源 ID：

```toml
# 示例配置
[[kv_namespaces]]
binding = "KV"
id = "abcd1234efgh5678ijkl9012mnop3456"  # 替换为真实 ID

[[d1_databases]]
binding = "DB"
database_name = "remove-anything-db"
database_id = "1234-5678-9012-3456"      # 替换为真实 ID
```

## 🚀 部署流程

### 方法一：一键部署（推荐）

```bash
# 1. 完整构建和部署
npm run deploy:pages

# 这个命令会：
# - 清理之前的构建
# - 生成 Prisma 客户端
# - 构建 Next.js 应用
# - 转换为 Pages Functions
# - 自动部署到 Cloudflare
```

### 方法二：分步部署

```bash
# 1. 构建 Pages 版本
npm run build:pages

# 2. 手动部署
npx wrangler pages deploy .vercel/output --config wrangler.pages.toml

# 或者使用默认配置
npx wrangler pages deploy
```

### 方法三：Dashboard 部署

1. 运行构建：
   ```bash
   npm run build:pages
   ```

2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)

3. 进入 **Workers & Pages** → **Create Application** → **Pages**

4. 上传 `.vercel/output` 目录

5. 配置环境变量和绑定

## 🗄️ 数据库迁移

### 生产环境迁移
```bash
# 应用迁移到生产数据库
npx wrangler d1 migrations apply remove-anything-db --config wrangler.pages.toml

# 验证迁移
npx wrangler d1 execute remove-anything-db --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### 本地开发迁移
```bash
# 本地数据库迁移
npx wrangler d1 migrations apply remove-anything-db --local --config wrangler.pages.toml
```

## 🔧 环境变量配置

### Pages 环境变量设置

通过以下方式之一设置环境变量：

#### 方法一：Wrangler CLI
```bash
# 设置生产环境变量
npx wrangler pages secret put NEXTAUTH_SECRET --config wrangler.pages.toml
npx wrangler pages secret put REPLICATE_API_TOKEN --config wrangler.pages.toml
npx wrangler pages secret put GEMINI_API_KEY --config wrangler.pages.toml

# 设置公开变量
npx wrangler pages var put NEXT_PUBLIC_SITE_URL "https://your-domain.pages.dev" --config wrangler.pages.toml
```

#### 方法二：Dashboard 设置
1. 进入 Pages 项目设置
2. 点击 **Settings** → **Environment Variables**
3. 添加必需的环境变量

### 必需的环境变量列表

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `NEXTAUTH_SECRET` | Secret | NextAuth.js 密钥 |
| `NEXTAUTH_URL` | Public | 应用 URL |
| `REPLICATE_API_TOKEN` | Secret | Replicate API 密钥 |
| `GEMINI_API_KEY` | Secret | Google Gemini API 密钥 |
| `NEXT_PUBLIC_SITE_URL` | Public | 公开的网站 URL |
| `DATABASE_URL` | Public | 数据库连接字符串 |

## 🔍 部署验证

### 1. 检查部署状态
```bash
npx wrangler pages deployment list --config wrangler.pages.toml
```

### 2. 查看日志
```bash
npx wrangler pages functions logs --config wrangler.pages.toml
```

### 3. 测试功能
- ✅ 访问主页：`https://your-domain.pages.dev`
- ✅ 测试 API：`https://your-domain.pages.dev/api/generate`
- ✅ 测试认证：登录功能
- ✅ 测试数据库：创建/读取数据
- ✅ 测试文件上传：R2 存储功能

## 🔧 故障排除

### 常见问题

#### 1. 构建失败
```bash
Error: Environment variable not found: DATABASE_URL
```
**解决方案**：
```bash
# 检查环境变量
npm run check-config

# 设置临时变量进行构建
DATABASE_URL="file:./dev.db" npm run build:pages
```

#### 2. 绑定未找到
```bash
Error: KV binding not found
```
**解决方案**：
- 检查 `wrangler.pages.toml` 中的绑定配置
- 确保 KV 命名空间 ID 正确
- 运行 `npx wrangler kv:namespace list` 验证

#### 3. 数据库连接失败
```bash
Error: D1 database not accessible
```
**解决方案**：
```bash
# 检查数据库状态
npx wrangler d1 info remove-anything-db

# 重新运行迁移
npx wrangler d1 migrations apply remove-anything-db
```

#### 4. API 路由 404
**解决方案**：
- 检查 `wrangler.pages.toml` 中的 functions 路由配置
- 确保 `.vercel/output` 目录包含 Functions

### 调试命令

```bash
# 查看构建输出结构
find .vercel/output -type f | head -20

# 检查 Functions 生成
ls -la .vercel/output/functions

# 本地测试 Pages Functions
npx wrangler pages dev .vercel/output --config wrangler.pages.toml
```

## 📊 性能优化

### 1. 缓存策略
- **静态资源**：自动 CDN 缓存
- **API 响应**：使用 KV 缓存频繁查询
- **数据库查询**：优化 Prisma 查询

### 2. 边缘优化
- **地理分布**：全球边缘节点
- **冷启动优化**：Functions 预热
- **图像优化**：Next.js Image 组件

### 3. 监控设置
```bash
# 设置告警
npx wrangler pages functions metrics --config wrangler.pages.toml

# 查看分析数据
# 访问 Cloudflare Dashboard → Analytics
```

## 🔄 持续部署

### GitHub Actions 示例

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build for Pages
        run: npm run build:pages
        env:
          DATABASE_URL: file:./dev.db
          SKIP_ENV_VALIDATION: true
          
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: remove-anything
          directory: .vercel/output
```

## 🎉 部署完成

恭喜！您的 Remove Anything 应用现在已经完全部署到 Cloudflare Pages + Functions！

### 下一步：
1. 🔧 配置自定义域名
2. 📊 设置监控和告警
3. 🔒 配置安全策略
4. 📈 优化性能指标

需要帮助？请参考：
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Next.js on Cloudflare 指南](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- 项目的其他文档文件 