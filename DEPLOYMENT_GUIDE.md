# 🚀 FluxAI 部署指南

本指南将帮助你部署 FluxAI 项目到 Cloudflare Workers 平台。

## 📋 前置要求

- Node.js 18+ 
- npm 或 yarn
- Cloudflare 账户
- Git 账户

## 🔧 环境配置

### 1. 克隆项目

```bash
git clone https://github.com/your-username/fluxai.git
cd fluxai
npm install
```

### 2. 配置环境变量

复制环境变量模板：

```bash
cp env.template .env.local
```

编辑 `.env.local` 文件，填入你的真实配置值。参考 `CLOUDFLARE_QUICK_SETUP.md` 获取 Cloudflare 服务配置。

### 3. 配置 wrangler.toml

编辑 `wrangler.toml` 文件，将占位符替换为你的真实值：

```toml
name = "your-worker-name"  # 替换为你的 Worker 名称
```

## ☁️ Cloudflare 服务配置

### 1. 创建 KV 命名空间

```bash
# 创建生产环境 KV
npx wrangler kv:namespace create "YOUR_KV_NAME"

# 创建预览环境 KV
npx wrangler kv:namespace create "YOUR_KV_NAME" --preview
```

### 2. 创建 R2 存储桶

```bash
# 创建 R2 存储桶
npx wrangler r2 bucket create "your-r2-bucket-name"
```

### 3. 创建 D1 数据库

```bash
# 创建 D1 数据库
npx wrangler d1 create "your-d1-database-name"

# 运行数据库迁移
npx wrangler d1 migrations apply "your-d1-database-name" --local
npx wrangler d1 migrations apply "your-d1-database-name"
```

### 4. 配置 AI Gateway

在 Cloudflare 控制台中：
1. 进入 AI > AI Gateway
2. 创建新的 Gateway
3. 配置 AI 模型路由
4. 获取 Gateway URL 和 Token

## 🚀 部署步骤

### 1. 构建项目

```bash
npm run build
```

### 2. 部署到 Cloudflare Workers

```bash
npx wrangler deploy
```

### 3. 验证部署

访问你的 Worker URL 确认部署成功。

## 🔄 多环境部署

### 开发环境

```bash
npx wrangler deploy --env development
```

### 预发布环境

```bash
npx wrangler deploy --env staging
```

### 生产环境

```bash
npx wrangler deploy
```

## 📊 监控和日志

### 查看日志

```bash
# 查看实时日志
npx wrangler tail

# 查看特定环境的日志
npx wrangler tail --env development
```

### 性能监控

在 Cloudflare 控制台中查看：
- Worker 性能指标
- 请求统计
- 错误率

## 🔧 故障排除

### 常见问题

1. **构建失败**
   - 检查 Node.js 版本
   - 清理缓存：`npm run clean`
   - 重新安装依赖：`rm -rf node_modules && npm install`

2. **环境变量错误**
   - 确认 `.env.local` 配置正确
   - 检查 `wrangler.toml` 中的绑定配置

3. **数据库连接失败**
   - 确认 D1 数据库已创建
   - 检查数据库迁移是否成功
   - 验证数据库绑定配置

4. **静态文件 404**
   - 检查 `wrangler.toml` 中的 `[site]` 配置
   - 确认构建输出目录正确

### 调试模式

```bash
# 本地开发模式
npx wrangler dev

# 带调试信息的部署
npx wrangler deploy --debug
```

## 🔒 安全配置

### 环境变量安全

- 不要在代码中硬编码敏感信息
- 使用 Cloudflare 的环境变量功能
- 定期轮换 API 密钥

### 访问控制

- 配置适当的 CORS 策略
- 实施速率限制
- 启用 Cloudflare 安全功能

## 📈 性能优化

### 构建优化

- 启用代码分割
- 优化图片资源
- 使用 CDN 缓存

### 运行时优化

- 配置适当的缓存策略
- 优化数据库查询
- 使用 KV 缓存热点数据

## 🔄 持续部署

### GitHub Actions

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## 📞 支持

如果遇到问题：

1. 查看 [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
2. 检查项目 Issues
3. 联系技术支持

---

🎉 恭喜！你的 FluxAI 应用已成功部署到 Cloudflare Workers！ 