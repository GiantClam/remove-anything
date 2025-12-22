# Tasks 模块

任务编排和状态同步模块，提供通用的任务管理功能。

## 功能

- 任务记录管理（Repository 模式）
- 任务队列（Queue 模式）
- 任务编排函数
- **任务状态同步**（新增）
  - 支持多种任务平台（RunningHub、Replicate）
  - 批量状态同步
  - 自动结果获取和处理

## 使用示例

### 1. 基本任务创建

```typescript
import { createVideoTaskWithR2Url } from "@modules/tasks";
import { createPrismaTaskRepository } from "./adapters/prisma-repo";
import { createRunningHubClient } from "@modules/runninghub";

const repo = createPrismaTaskRepository(prisma);
const rh = createRunningHubClient();

const result = await createVideoTaskWithR2Url(
  {
    model: "video-watermark-removal",
    userId: "user-1",
    workflowId: "workflow-123",
    r2Url: "https://.../video.mp4",
  },
  { repo, rh }
);
```

### 2. 任务状态同步（单个）

```typescript
import { 
  syncTaskStatusGeneric, 
  createRunningHubStatusProvider 
} from "@modules/tasks";
import { runninghubAPI } from "@modules/runninghub";

// 创建状态提供者
const statusProvider = createRunningHubStatusProvider({
  getTaskStatus: (taskId) => runninghubAPI.getTaskStatus(taskId),
  getTaskResult: (taskId) => runninghubAPI.getTaskResult(taskId),
});

// 同步单个任务
const result = await syncTaskStatusGeneric(
  taskRecord,
  statusProvider,
  repository,
  {
    fetchResultOnSuccess: true,
    onResultFetched: async (result, taskRecord) => {
      // 自定义结果处理，如上传到 R2
      const r2Url = await uploadToR2(result.outputUrl);
      return r2Url;
    },
  }
);
```

### 3. 批量任务状态同步（用于 Cron Job）

```typescript
import { 
  syncTasksBatch, 
  createRunningHubStatusProvider 
} from "@modules/tasks";

// 查找所有处理中的任务
const processingTasks = await repository.findMany({
  where: { status: "processing" },
  take: 50,
});

// 批量同步
const results = await syncTasksBatch(
  processingTasks,
  statusProvider,
  repository,
  {
    fetchResultOnSuccess: true,
  }
);

console.log(`同步完成: ${results.updated}/${results.total} 个任务已更新`);
```

### 4. 支持 Replicate 任务

```typescript
import { 
  syncTaskStatusGeneric, 
  createReplicateStatusProvider 
} from "@modules/tasks";

const replicateProvider = createReplicateStatusProvider({
  getTaskStatus: (predictionId) => replicateAPI.getPrediction(predictionId),
});

const result = await syncTaskStatusGeneric(
  taskRecord,
  replicateProvider,
  repository
);
```

## 适配器实现

### Prisma Repository 适配器

```typescript
import { TaskRepository, TaskRecord } from "@modules/tasks";

export function createPrismaTaskRepository(prisma: PrismaClient): TaskRepository {
  return {
    async create(data) {
      const record = await prisma.taskRecord.create({ data });
      return {
        id: record.id,
        userId: record.userId,
        model: record.model,
        status: record.status,
        inputUrl: record.inputUrl,
        outputUrl: record.outputUrl,
        externalTaskId: record.externalTaskId,
        errorMsg: record.errorMsg,
      };
    },
    
    async update(id, data) {
      await prisma.taskRecord.update({
        where: { id },
        data,
      });
    },
    
    async findByExternalId(model, externalId) {
      const record = await prisma.taskRecord.findFirst({
        where: { model, externalTaskId: externalId },
      });
      // ... 转换为 TaskRecord
    },
  };
}
```

## API 参考

### `syncTaskStatusGeneric`

同步单个任务状态。

**参数：**
- `taskRecord: TaskRecord` - 任务记录
- `statusProvider: TaskStatusProvider` - 状态提供者
- `repository: TaskRepository` - 任务仓库
- `options?: SyncOptions` - 同步选项

**返回：**
```typescript
{ status: TaskStatus; updated: boolean }
```

### `syncTasksBatch`

批量同步任务状态（适用于 Cron Job）。

**参数：**
- `taskRecords: TaskRecord[]` - 任务记录数组
- `statusProvider: TaskStatusProvider` - 状态提供者
- `repository: TaskRepository` - 任务仓库
- `options?: SyncOptions` - 同步选项

**返回：**
```typescript
{
  total: number;
  updated: number;
  succeeded: number;
  failed: number;
  stillProcessing: number;
  errors: string[];
}
```

### `createRunningHubStatusProvider`

创建 RunningHub 状态提供者。

### `createReplicateStatusProvider`

创建 Replicate 状态提供者。

## 在 Cron Job 中使用

```typescript
// app/api/cron/task-sync/route.ts
import { syncTasksBatch, createRunningHubStatusProvider } from "@modules/tasks";
import { runninghubAPI } from "@modules/runninghub";

export async function GET(req: NextRequest) {
  // 查找处理中的任务
  const tasks = await findProcessingTasks();
  
  // 创建状态提供者
  const provider = createRunningHubStatusProvider({
    getTaskStatus: runninghubAPI.getTaskStatus,
    getTaskResult: runninghubAPI.getTaskResult,
  });
  
  // 批量同步
  const results = await syncTasksBatch(tasks, provider, repository);
  
  return NextResponse.json({ success: true, results });
}
```
