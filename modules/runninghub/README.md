# RunningHub 模块接入说明

- 环境变量
  - RUNNINGHUB_API_BASE_URL
  - RUNNINGHUB_API_KEY
  - RUNNINGHUB_WORKFLOW_ID（可选）
  - NEXTAUTH_URL（可选，用于 webhook 回调 URL）

- 使用方式
```ts
import { RunningHubAPI } from "@/modules/runninghub/sdk";

const api = new RunningHubAPI();
const taskId = await api.createTaskGeneric({
  workflowId: process.env.SOME_WORKFLOW_ID!,
  nodeInfoList: [{ nodeId: '205', fieldName: 'video', fieldValue: 'https://...' }],
});
```

- 通过任务编排 SDK 注入（推荐）
```ts
import { createRunningHubClient } from "@/modules/runninghub/adapter";
import { createVideoTaskWithR2Url } from "@/modules/tasks/sdk";

const rh = createRunningHubClient();
// 与 TaskRepository/TaskQueue 一起注入到编排函数
```

