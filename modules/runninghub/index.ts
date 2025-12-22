// 可复用 RunningHub API 模块封装
// 统一导出入口，所有使用 RunningHub 的地方应该从这里导入

// 导出 SDK
export {
  RunningHubAPI,
  runninghubAPI,
} from "./sdk";

// 导出类型
export type {
  RunningHubUploadResponse,
  RunningHubCreateTaskResponse,
  RunningHubTaskStatus,
  RunningHubNodeInput,
  CreateTaskOptions,
  UploadFileOptions,
  RunningHubAPIConfig,
} from "./sdk";

// 导出适配器
export { createRunningHubClient } from "./adapter";

