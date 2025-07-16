# Cloudflare Workers 部署指南

本项目已重构为完全适配 Cloudflare 生态系统，使用以下服务：

- **Cloudflare Workers**: 运行时环境
- **Cloudflare D1**: 数据库
- **Cloudflare KV**: 缓存和速率限制
- **Cloudflare R2**: 文件存储
- **Cloudflare AI Gateway**: AI 服务

## 前置要求

1. 安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
2. 登录 Cloudflare 账户：`npx wrangler login`
3. 确保有足够的 Cloudflare 配额

## 快速部署

### 1. 环境配置

复制环境变量模板：
```bash
cp env.cloudflare.template .env.local
```

编辑 `.env.local` 文件，填入你的 Cloudflare 配置：
```env
# Cloudflare KV 配置
CLOUDFLARE_KV_NAMESPACE_ID=your-kv-namespace-id
CLOUDFLARE_KV_ACCOUNT_ID=your-account-id
CLOUDFLARE_KV_API_TOKEN=your-api-token

# 其他配置...
```

### 2. 创建 Cloudflare 资源

#### 创建 D1 数据库
```bash
npm run d1:create
```

#### 创建 KV 命名空间
```bash
npx wrangler kv:namespace create "remove-anything-kv"
```

#### 创建 R2 存储桶
```bash
npx wrangler r2 bucket create "remove-anything-storage"
```

### 3. 数据库迁移

```bash
# 本地开发环境
npm run d1:local

# 生产环境
npm run d1:deploy
```

### 4. 构建和部署

```bash
# 一键构建和部署
npm run deploy

# 或者分步执行
npm run build:cloudflare
npx wrangler deploy
```

## 开发环境

### 本地开发
```bash
npm run dev
```

### Wrangler 开发环境
```bash
npm run dev:wrangler
```

## 项目结构

### 核心文件

- `cloudflare-worker.js`: Workers 入口文件
- `wrangler.toml`: Cloudflare 配置文件
- `lib/db.ts`: D1 数据库适配器
- `lib/kv.ts`: KV 存储客户端
- `lib/r2.ts`: R2 存储适配器

### 数据库

- 使用 Prisma + D1 适配器
- 支持本地 SQLite 开发
- 生产环境自动切换到 D1

### 存储

- 静态文件：R2 存储
- 缓存和会话：KV 存储
- 数据库：D1

## 环境变量

### 必需的环境变量

```env
# Cloudflare KV
CLOUDFLARE_KV_NAMESPACE_ID=
CLOUDFLARE_KV_ACCOUNT_ID=
CLOUDFLARE_KV_API_TOKEN=

# 数据库
DATABASE_URL=file:./dev.db

# 其他服务...
```

### wrangler.toml 配置

```toml
# D1 数据库
[[d1_databases]]
binding = "DB"
database_name = "remove-anything-db"
database_id = "your-d1-database-id"

# KV 存储
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"

# R2 存储
[[r2_buckets]]
binding = "R2"
bucket_name = "remove-anything-storage"
```

## 故障排除

### 常见问题

1. **构建失败**: 检查 Node.js 版本和依赖
2. **部署失败**: 确认 Wrangler 登录状态和权限
3. **数据库连接失败**: 检查 D1 数据库 ID 和迁移状态
4. **KV 访问失败**: 确认 KV 命名空间 ID 和 API Token

### 调试命令

```bash
# 检查配置
npm run check-config

# 查看 Workers 日志
npx wrangler tail

# 本地测试
npx wrangler dev --local
```

## 性能优化

1. **缓存策略**: 使用 KV 缓存频繁访问的数据
2. **静态资源**: 将静态文件存储在 R2 中
3. **数据库查询**: 优化 Prisma 查询，使用索引
4. **CDN**: 利用 Cloudflare 的全球 CDN 网络

## 监控和日志

- 使用 Cloudflare Analytics 监控性能
- 通过 Wrangler Tail 查看实时日志
- 设置错误告警和监控

## 安全考虑

1. 环境变量不要提交到版本控制
2. 使用最小权限原则配置 API Token
3. 定期更新依赖包
4. 启用 Cloudflare 安全功能

## 扩展阅读

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [D1 数据库指南](https://developers.cloudflare.com/d1/)
- [KV 存储文档](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [R2 存储文档](https://developers.cloudflare.com/r2/) 