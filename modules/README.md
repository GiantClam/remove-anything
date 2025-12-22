# Modules - 可复用业务模块集合

这是一个可复用的业务模块集合，包含 RunningHub、Tasks、Auth、Payments、Cloudflare Storage 等模块。这些模块设计为框架无关，可以在多个项目中复用。

## 📦 包含的模块

### 1. RunningHub
RunningHub API 客户端封装，用于创建和管理异步任务。

**功能：**
- 文件上传
- 任务创建和管理
- 任务状态查询
- 任务结果获取

**文档：** [runninghub/README.md](./runninghub/README.md)

### 2. Tasks
任务编排模块，提供任务创建、状态同步等功能。

**功能：**
- 任务记录管理（Repository 模式）
- 任务队列（Queue 模式）
- 任务编排函数
- 状态同步

**文档：** [tasks/README.md](./tasks/README.md)

### 3. Auth
认证模块，提供统一的认证接口。

**功能：**
- 认证会话管理
- 用户信息获取
- 适配器模式，支持多种认证系统

**文档：** [auth/README.md](./auth/README.md)

### 4. Payments (Stripe)
Stripe 支付模块封装。

**功能：**
- Checkout Session 创建
- 支付流程管理

**文档：** [payments/stripe/README.md](./payments/stripe/README.md)

### 5. Cloudflare Storage
Cloudflare R2 存储模块。

**功能：**
- 文件上传
- 预签名 URL 生成
- R2 客户端封装

**文档：** [cloudflare-storage/README.md](./cloudflare-storage/README.md)

## 🚀 安装和使用

### 方式一：作为 Git Submodule

```bash
# 在你的项目中添加 submodule
git submodule add https://github.com/GiantClam/aiwebmodules.git modules

# 或者使用 npm/yarn/pnpm 链接
cd modules
npm link
cd ../your-project
npm link @your-org/modules
```

### 方式二：直接复制到项目

```bash
# 复制 modules 文件夹到你的项目
cp -r modules /path/to/your-project/
```

### 方式三：发布为 npm 包（推荐）

```bash
# 在 modules 目录下
npm publish

# 在你的项目中使用
npm install @giantclam/aiwebmodules
```

## 📖 使用示例

### RunningHub

```typescript
import { runninghubAPI, createRunningHubClient } from '@giantclam/aiwebmodules/runninghub';

// 使用单例
const taskId = await runninghubAPI.createTaskGeneric({
  workflowId: 'workflow-123',
  nodeInfoList: [{ nodeId: '205', fieldName: 'video', fieldValue: 'https://...' }],
});

// 或创建自定义客户端
const client = createRunningHubClient({
  baseUrl: 'https://api.runninghub.com',
  apiKey: 'your-api-key',
});
```

### Tasks

```typescript
import { createVideoTaskWithR2Url } from '@giantclam/aiwebmodules/tasks';
import { createRunningHubClient } from '@giantclam/aiwebmodules/runninghub';
// 导入你实现的适配器
import { createPrismaTaskRepository } from './adapters/prisma-repo';
import { createPrismaTaskQueue } from './adapters/prisma-queue';

const repo = createPrismaTaskRepository(prisma);
const queue = createPrismaTaskQueue(prisma);
const rh = createRunningHubClient();

const result = await createVideoTaskWithR2Url(
  {
    model: 'video-watermark-removal',
    userId: 'user-1',
    workflowId: 'workflow-123',
    r2Url: 'https://.../video.mp4',
  },
  { repo, queue, rh }
);
```

### Auth

```typescript
import { createAuthProvider } from '@giantclam/aiwebmodules/examples/auth/adapter.example';

const auth = createAuthProvider({
  getCurrentUser: async () => {
    // 你的认证逻辑
    return { id: 'user-1', email: 'user@example.com', name: 'User' };
  },
});

const user = await auth.getCurrentUser();
```

### Cloudflare Storage

```typescript
import { uploadBufferToR2, generatePresignedPutUrl } from '@giantclam/aiwebmodules/cloudflare-storage';

const publicUrl = await uploadBufferToR2(
  Buffer.from('content'),
  'uploads/file.txt',
  'text/plain',
  {
    endpoint: 'https://...',
    accessKeyId: '...',
    secretAccessKey: '...',
    bucket: 'my-bucket',
    publicBaseUrl: 'https://cdn.example.com',
  }
);
```

## 🔧 适配器实现

模块使用适配器模式，你需要为你的项目实现相应的适配器。参考示例：

- **Prisma 适配器：** [examples/prisma-adapters/](./examples/prisma-adapters/)
- **Auth 适配器：** [examples/auth/](./examples/auth/)

## 📝 环境变量

各模块需要的环境变量请参考各模块的 README 文件。

## 🏗️ 开发

```bash
# 安装依赖
npm install

# 类型检查
npm run type-check

# 构建
npm run build

# 代码检查
npm run lint
```

## 📄 License

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📚 更多文档

- [RunningHub 模块](./runninghub/README.md)
- [Tasks 模块](./tasks/README.md)
- [Auth 模块](./auth/README.md)
- [Payments 模块](./payments/stripe/README.md)
- [Cloudflare Storage 模块](./cloudflare-storage/README.md)
- [适配器示例](./examples/README.md)

