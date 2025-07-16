# 🎨 Remove Anything - AI 背景去除工具

Remove Anything 是一个基于 AI 的智能背景去除工具，帮助用户轻松去除图片中的任何物体或背景，获得完美的透明背景效果。

## ✨ 功能特性

- 🎯 **智能背景去除** - 使用先进的 AI 模型精确去除背景
- 🧹 **物体移除** - 去除图片中不需要的物体和元素
- 🔄 **批量处理** - 支持多张图片同时处理
- 📱 **响应式设计** - 完美适配各种设备
- 🔐 **用户认证** - 完整的用户管理系统
- 🌍 **多语言支持** - 支持多种语言界面
- 💳 **支付集成** - Stripe 支付系统集成
- 📊 **使用统计** - 实时统计和性能监控

## 🛠️ 技术栈

- **前端框架**: Next.js 14 (App Router)
- **UI 组件**: Shadcn UI + Radix UI
- **样式**: Tailwind CSS
- **数据库**: Cloudflare D1 (SQLite)
- **存储**: Cloudflare R2 (S3 兼容)
- **缓存**: Cloudflare KV
- **AI 服务**: Cloudflare AI Gateway + Replicate
- **认证**: NextAuth.js
- **支付**: Stripe
- **部署**: Cloudflare Workers

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn
- Cloudflare 账户

### 安装依赖

```bash
npm install
```

### 环境变量配置

创建 `.env.local` 文件并配置以下环境变量：

```env
# 数据库
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"

# Stripe
STRIPE_SECRET_KEY="your-stripe-secret-key"
STRIPE_PUBLISHABLE_KEY="your-stripe-publishable-key"
STRIPE_WEBHOOK_SECRET="your-stripe-webhook-secret"

# Cloudflare
CLOUDFLARE_ACCOUNT_ID="your-cloudflare-account-id"
CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"

# AI 服务
REPLICATE_API_TOKEN="your-replicate-api-token"
```

### 数据库设置

```bash
# 生成 Prisma 客户端
npx prisma generate

# 运行数据库迁移
npx prisma db push

# 查看数据库 (可选)
npx prisma studio
```

### 开发模式

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建和部署

```bash
# 构建应用
npm run build

# 部署到 Cloudflare Workers
npx wrangler deploy
```

## 📁 项目结构

```
remove-anything/
├── app/                    # Next.js App Router 页面
│   ├── [locale]/          # 国际化路由
│   │   ├── (app)/         # 应用页面
│   │   ├── (auth)/        # 认证页面
│   │   └── (marketing)/   # 营销页面
│   └── api/               # API 路由
├── components/            # React 组件
│   ├── ui/               # 基础 UI 组件
│   ├── forms/            # 表单组件
│   └── sections/         # 页面区块组件
├── lib/                  # 工具库
├── db/                   # 数据库相关
├── config/               # 配置文件
├── content/              # 内容文件
├── public/               # 静态资源
└── styles/               # 样式文件
```

## 🌍 国际化

项目支持多语言，使用 `next-intl` 进行国际化管理：

- 英语 (en)
- 中文 (zh)
- 繁体中文 (tw)
- 阿拉伯语 (ar)
- 德语 (de)
- 西班牙语 (es)
- 法语 (fr)
- 日语 (ja)
- 韩语 (ko)
- 葡萄牙语 (pt)

## 🔧 配置说明

### Cloudflare Workers 配置

项目配置为在 Cloudflare Workers 上运行，支持：

- **D1 数据库**: 用于数据存储
- **R2 存储**: 用于文件存储
- **KV 缓存**: 用于缓存数据
- **AI Gateway**: 用于 AI 服务调用

### 部署配置

`wrangler.toml` 文件包含完整的部署配置，包括：

- Worker 名称和兼容性设置
- 数据库绑定
- 存储绑定
- 环境变量配置
- 多环境支持 (开发、预发布、生产)

## 📊 性能优化

- **静态生成**: 使用 Next.js 静态生成优化性能
- **图片优化**: 自动图片压缩和格式转换
- **代码分割**: 自动代码分割减少包大小
- **缓存策略**: 多层缓存提升响应速度

## 🔒 安全特性

- **认证授权**: 完整的用户认证和权限管理
- **API 保护**: API 路由安全保护
- **数据验证**: 输入数据验证和清理
- **HTTPS**: 强制 HTTPS 连接

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系我们

- 项目主页: [https://remove-anything.com](https://remove-anything.com)
- 问题反馈: [GitHub Issues](https://github.com/your-username/remove-anything/issues)
- 邮箱: support@remove-anything.com

## 🙏 致谢

感谢以下开源项目的支持：

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Cloudflare](https://cloudflare.com/)
- [Stripe](https://stripe.com/)
- [Replicate](https://replicate.com/)

---

⭐ 如果这个项目对你有帮助，请给我们一个星标！