/**
 * @deprecated 请使用 @/modules/runninghub 替代
 * 此文件保留仅用于向后兼容，新代码请直接从 @/modules/runninghub 导入
 */
export {
  RunningHubAPI,
  runninghubAPI,
  createRunningHubClient,
} from "@/modules/runninghub";

export type {
  RunningHubUploadResponse,
  RunningHubCreateTaskResponse,
  RunningHubTaskStatus,
  RunningHubNodeInput,
  CreateTaskOptions,
  UploadFileOptions,
  RunningHubAPIConfig,
} from "@/modules/runninghub";
