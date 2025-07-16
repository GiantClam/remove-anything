# Wrangler 本地开发指南

本指南将指导你如何使用 Wrangler 设置本地开发环境，以便在开发过程中使用真实的 Cloudflare 服务。

## 简介

Wrangler 是 Cloudflare Workers 的官方命令行工具。它允许你在本地开发和测试 Workers 应用程序，并轻松部署到 Cloudflare。

我们的项目使用了以下 Cloudflare 服务：
- **KV**: 键值存储，用于缓存和速率限制
- **R2**: 对象存储，用于文件存储
- **Workers AI**: AI 模型托管

## 安装步骤

### 1. 安装 Wrangler

```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare 账户

```bash
wrangler login
```

此命令将打开浏览器，引导你登录 Cloudflare 账户并授权 Wrangler。

### 3. 自动设置开发环境

我们提供了一个自动设置脚本，它将：
- 创建 KV 命名空间
- 创建 R2 存储桶
- 更新 wrangler.toml
- 生成 .env.local 文件

运行以下命令：

```bash
npm run setup-local
```

按照提示操作，完成设置。

### 4. 手动设置（如自动设置失败）

#### 创建 KV 命名空间

```bash
# 创建主 KV 命名空间
wrangler kv:namespace create "next-money-kv"

# 创建预览 KV 命名空间
wrangler kv:namespace create "next-money-kv-preview" --preview
```

将输出中的 ID 和 preview_id 复制到 wrangler.toml 中。

#### 创建 R2 存储桶

```bash
# 创建主 R2 存储桶
wrangler r2 bucket create next-money-storage

# 创建预览 R2 存储桶
wrangler r2 bucket create next-money-storage-preview
```

#### 更新 wrangler.toml

确保 wrangler.toml 包含正确的绑定配置：

```toml
[[kv_namespaces]]
binding = "KV"
preview_id = "你的预览KV命名空间ID"
id = "你的KV命名空间ID"

[[r2_buckets]]
binding = "R2"
bucket_name = "next-money-storage"
preview_bucket_name = "next-money-storage-preview"
```

#### 获取账户 ID

```bash
wrangler whoami
```

记下输出中的 Account ID。

#### 创建 API Token

1. 前往 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击右上角个人资料 > API Tokens
3. 点击"Create Token"
4. 选择"Create Custom Token"
5. 添加以下权限：
   - Account > Cloudflare Workers > Edit
   - Account > Account Settings > Read
   - Zone > Zone Settings > Read
6. 将生成的 API Token 保存到 .env.local 中

## 使用方法

### 使用 Wrangler 本地开发服务器

```bash
npm run dev:wrangler
```

这将启动 Wrangler 开发服务器，它会模拟 Cloudflare Workers 环境，包括 KV、R2 和 AI 绑定。

### 使用普通 Next.js 开发服务器

```bash
npm run dev
```

在这种模式下，代码将使用 .env.local 中配置的环境变量连接到 Cloudflare 服务。

## 环境变量与绑定的关系

我们的项目支持两种访问 Cloudflare 服务的方式：

1. **通过环境变量**（适用于本地开发）
   - 使用 .env.local 中的配置
   - 通过 Cloudflare API 访问服务

2. **通过 Cloudflare 绑定**（适用于部署和 wrangler dev）
   - 使用 wrangler.toml 中的绑定配置
   - 直接访问 Cloudflare 服务，无需 API Token

我们的代码自动检测当前环境并选择合适的访问方式。

## KV 操作示例

```typescript
// 从请求中获取绑定
import { createBindingsFromRequest } from '@/app/api/_cloudflare-adapter';

export async function GET(req: NextRequest) {
  const { kv } = createBindingsFromRequest(req);
  
  // 读取数据
  const value = await kv.get('my-key');
  
  // 写入数据
  await kv.set('my-key', { foo: 'bar' });
  
  // 返回响应
  return NextResponse.json({ value });
}
```

## R2 操作示例

```typescript
// 从请求中获取绑定
import { createBindingsFromRequest } from '@/app/api/_cloudflare-adapter';

export async function GET(req: NextRequest) {
  const { r2 } = createBindingsFromRequest(req);
  
  // 上传文件
  await r2.put('my-file.jpg', fileBuffer);
  
  // 下载文件
  const file = await r2.get('my-file.jpg');
  
  // 返回响应
  return new Response(file.body);
}
```

## 部署到 Cloudflare Pages

```bash
npm run deploy:cloudflare
```

此命令将构建应用程序并部署到 Cloudflare Pages，使用 wrangler.toml 中的绑定配置。

## 故障排除

### KV 绑定不可用

确保你的 wrangler.toml 包含正确的 KV 命名空间配置：

```toml
[[kv_namespaces]]
binding = "KV"
preview_id = "你的预览KV命名空间ID"
id = "你的KV命名空间ID"
```

### R2 绑定不可用

确保你的 wrangler.toml 包含正确的 R2 存储桶配置：

```toml
[[r2_buckets]]
binding = "R2"
bucket_name = "next-money-storage"
preview_bucket_name = "next-money-storage-preview"
```

### API Token 权限问题

确保你的 API Token 具有以下权限：
- Account > Cloudflare Workers > Edit
- Account > Account Settings > Read
- Zone > Zone Settings > Read

### 检查环境变量配置

运行以下命令检查配置：

```bash
npm run check-config
```

## 总结

使用 Wrangler 进行本地开发可以提供更接近生产环境的体验，让你能够测试与真实 Cloudflare 服务的交互。通过本指南，你应该能够设置和使用 Wrangler 开发环境，以及理解如何在代码中使用 Cloudflare 绑定。

如果遇到任何问题，请查看 [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/) 或 [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/)。 