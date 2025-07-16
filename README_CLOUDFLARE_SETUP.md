# Cloudflare 服务设置指南

这个项目已经从Redis迁移到Cloudflare服务，需要配置真实的Cloudflare服务才能正常运行。

## 🚀 快速开始

### 1. 创建配置文件
```bash
cp env.template .env.local
```

### 2. 创建 Cloudflare 服务
按照 [`CLOUDFLARE_QUICK_SETUP.md`](./CLOUDFLARE_QUICK_SETUP.md) 的详细指南创建：
- **KV 存储** - 用于缓存和限流
- **R2 存储** - 用于文件存储
- **AI Gateway** - 用于AI模型代理

### 3. 配置环境变量
在 `.env.local` 中填入从 Cloudflare 获取的真实值：

```bash
# 必需的 Cloudflare 服务
CLOUDFLARE_KV_NAMESPACE_ID=你的KV命名空间ID
CLOUDFLARE_KV_ACCOUNT_ID=你的账户ID
CLOUDFLARE_KV_API_TOKEN=你的API_Token

# 必需的 AI API
REPLICATE_API_TOKEN=r8_你的Replicate_Token
GEMINI_API_KEY=你的Gemini_API_Key
```

### 4. 验证配置
```bash
npm run check-config
```

如果看到 🎉 配置检查通过，则可以继续。

### 5. 启动项目
```bash
npm run build  # 验证构建
npm run dev    # 启动开发服务器
```

## 📚 文档

| 文件 | 用途 |
|------|------|
| [`CLOUDFLARE_QUICK_SETUP.md`](./CLOUDFLARE_QUICK_SETUP.md) | 详细的服务创建指南 |
| [`env.template`](./env.template) | 环境变量模板 |
| [`CLOUDFLARE_SETUP.md`](./CLOUDFLARE_SETUP.md) | 完整的迁移文档 |

## 🛠️ 工具

### 配置检查器
```bash
npm run check-config
```
检查所有环境变量是否正确设置，并验证格式。

### 构建测试
```bash
npm run build
```
验证所有服务配置是否正确。

## ⚠️ 重要提醒

1. **没有Mock服务** - 所有服务都需要真实的Cloudflare配置
2. **环境变量必需** - 缺少任何必需变量都会导致构建失败
3. **API 限制** - 注意各种API的使用限制和费用

## 🔧 常见问题

### 构建失败
```bash
Error: Cloudflare KV 环境变量配置不完整！
```
**解决方案**: 运行 `npm run check-config` 检查配置

### 无法创建KV
确保你的Cloudflare账户已激活，可能需要先添加一个域名。

### API Token 权限不足
确保API Token具有以下权限：
- `Account:Cloudflare Workers:Edit`
- `Account:Account:Read`
- `Zone:Zone:Read` (可选)

## 📦 服务依赖

| 服务 | 用途 | 是否必需 |
|------|------|----------|
| Cloudflare KV | 缓存、限流 | ✅ 必需 |
| Cloudflare R2 | 文件存储 | ✅ 必需 |
| Cloudflare AI Gateway | AI代理 | ✅ 必需 |
| Replicate | AI模型 | ✅ 必需 |
| Google Gemini | AI服务 | ✅ 必需 |
| Stripe | 支付 | ⚪ 可选 |
| Resend | 邮件 | ⚪ 可选 |

## 🚀 部署

项目可以部署到 Cloudflare Pages：

```bash
npm run build:cloudflare
npm run deploy:cloudflare
```

---

有问题？查看 [详细文档](./CLOUDFLARE_QUICK_SETUP.md) 或提交 Issue。 