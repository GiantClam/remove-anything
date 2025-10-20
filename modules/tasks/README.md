# Tasks 编排模块接入说明

- 提供接口
  - TaskRepository：持久化记录
  - TaskQueue：持久化队列
  - RunningHubClient：运行时任务客户端

- 编排函数
```ts
import { createVideoTaskWithR2Url, syncTaskStatus } from "@/modules/tasks/sdk";
```

- Prisma 适配器（本项目示例）
```ts
import { createPrismaTaskRepository } from "@/modules/tasks/adapters/prisma-repo";
import { createPrismaTaskQueue } from "@/modules/tasks/adapters/prisma-queue";
import { createRunningHubClient } from "@/modules/runninghub/adapter";

const repo = createPrismaTaskRepository();
const queue = createPrismaTaskQueue();
const rh = createRunningHubClient();

const result = await createVideoTaskWithR2Url({
  model: 'sora2-video-watermark-removal',
  userId: 'user-1',
  workflowId: process.env.SOME_WORKFLOW_ID!,
  r2Url: 'https://.../video.mp4',
}, { repo, queue, rh });
```

