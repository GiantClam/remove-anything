# RunningHub 模块接入说明

- 环境变量
  - RUNNINGHUB_API_BASE_URL
  - RUNNINGHUB_API_KEY
  - RUNNINGHUB_WORKFLOW_ID（可选）
  - NEXTAUTH_URL（可选，用于 webhook 回调 URL）
  - RUNNINGHUB_WEBHOOK_SECRET（可选，至少 32 字符；未配置时仅使用轮询，不发送无鉴权回调地址）
  - RUNNINGHUB_OUTPUT_URL_PREFIXES（已核实的输出 HTTPS origin/path 前缀列表，逗号分隔；无默认源）

回调配置和发布门槛见 [callback runbook](../../openspec/changes/p0-growth-funnel-foundation/callback-security-runbook.md)。

- 使用方式（统一从 @/modules/runninghub 导入）

**方式一：直接使用 API 类**
```ts
import { RunningHubAPI, runninghubAPI } from "@/modules/runninghub";

// 使用单例实例
const taskId = await runninghubAPI.createTaskGeneric({
  workflowId: process.env.SOME_WORKFLOW_ID!,
  nodeInfoList: [{ nodeId: '205', fieldName: 'video', fieldValue: 'https://...' }],
});

// 或创建新实例
const api = new RunningHubAPI();
const taskId = await api.createTaskGeneric({ ... });
```

**方式二：通过任务编排 SDK 注入（推荐）**
```ts
import { createRunningHubClient } from "@/modules/runninghub";
import { createVideoTaskWithR2Url } from "@/modules/tasks/sdk";

const rh = createRunningHubClient();
// 与 TaskRepository 一起注入到编排函数。
// 可选的 OrchestratorDeps.queue 仅为源码兼容保留，不会被编排器调用。
```

