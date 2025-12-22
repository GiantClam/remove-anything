// Tasks 模块统一导出入口
// 核心接口和编排函数
export type {
  TaskRecord,
  CreateTaskParams,
  TaskRepository,
  TaskQueue,
  RunningHubClient,
  CreateVideoTaskOptions,
  OrchestratorDeps,
} from "./sdk";

export {
  createVideoTaskWithR2Url,
  syncTaskStatus,
} from "./sdk";

// 适配器（需要项目特定实现）
// Prisma 适配器示例请查看 examples/ 目录

