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
  syncTaskStatus as syncTaskStatusFromSdk,
} from "./sdk";

// 任务状态同步模块（通用）
export type {
  TaskStatusProvider,
  TaskStatusResult,
  TaskResult,
  TaskStatus,
  SyncOptions,
} from "./status-sync";

// 重新导出所有函数和类型，使用明确的导出语句
export {
  syncTaskStatus,
  syncTasksBatch,
  createRunningHubStatusProvider,
  createReplicateStatusProvider,
} from "./status-sync";

// 为兼容性，导出别名（从 status-sync 导出）
export { syncTaskStatus as syncTaskStatusGeneric } from "./status-sync";

// 适配器（需要项目特定实现）
// Prisma 适配器示例请查看 examples/ 目录

