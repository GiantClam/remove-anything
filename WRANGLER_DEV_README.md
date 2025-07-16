# Next.js + Wrangler 开发指南

本文档说明如何在本地使用 Wrangler 来运行项目，以便利用 Cloudflare Workers 环境提供的绑定。

## 设置步骤

### 1. 安装依赖

确保你已安装 Wrangler CLI:

```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare 账户

```bash
wrangler login
```

### 3. 设置本地开发环境

我们提供了一个自动设置脚本，它会创建必需的 Cloudflare 服务并更新配置:

```bash
npm run setup-local
```

## 开发模式使用

### 启动开发服务器

使用我们的自定义脚本启动 Wrangler 开发服务器:

```bash
npm run dev:wrangler
```

这个脚本会:
1. 检查是否有 Next.js 构建输出
2. 如果需要，自动构建应用
3. 启动 Wrangler 开发服务器

## 工作原理

### 项目结构

- **`wrangler.toml`**: 定义了 Cloudflare Workers 的配置和绑定
- **`scripts/dev-wrangler.js`**: 开发脚本，自动构建并启动 Wrangler
- **`lib/cloudflare-bindings.ts`**: 处理 Cloudflare 绑定的工具
- **`app/api/_cloudflare-adapter.ts`**: 在 API 路由中使用绑定的适配器

### 访问 Cloudflare 服务

项目支持两种访问 Cloudflare 服务的方式:

1. **API 模式**: 通过环境变量和 HTTP API (用于普通 Next.js 开发)
2. **绑定模式**: 通过 Workers 绑定 (用于 Wrangler 和生产环境)

代码会自动检测当前环境并选择合适的方式。

## 解决常见问题

### 构建错误

如果遇到构建问题，可以尝试:

```bash
# 清理构建缓存
rm -rf .next

# 重新构建
npm run build
```

### 找不到入口点错误

确保 `wrangler.toml` 中包含以下配置:

```toml
main = "./.next/standalone/server.js"

[site]
bucket = "./.next/static"
entry-point = "./.next/standalone"
```

### 绑定不可用

检查 Wrangler 是否正确创建了服务:

```bash
# 检查 KV 命名空间
wrangler kv:namespace list

# 检查 R2 存储桶
wrangler r2 bucket list
```

如果服务已创建但无法访问，尝试重新运行设置脚本:

```bash
npm run setup-local
```

### 如何验证绑定是否工作

在控制台中，你应该能看到类似这样的日志:

```
🌐 使用Cloudflare Workers KV绑定
```

而不是:

```
💻 使用本地开发模式 - Cloudflare API 调用
```

## 高级用法

### 直接使用 Wrangler 命令

如果需要更多控制，可以直接使用 Wrangler 命令:

```bash
wrangler dev --local --persist-to ./.wrangler/state --node-compat
```

### 调试 Wrangler 开发服务器

要查看详细日志:

```bash
wrangler dev --verbose
```

## 参考链接

- [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Next.js on Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/)

---

如果你遇到任何其他问题，请参考 `WRANGLER_GUIDE.md` 获取更详细的信息。 