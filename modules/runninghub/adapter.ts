import type { RunningHubClient } from "@/modules/tasks/sdk";
import { RunningHubAPI } from "./sdk";

export function createRunningHubClient(config?: { baseUrl?: string; apiKey?: string; defaultWorkflowId?: string }): RunningHubClient {
  const api = new RunningHubAPI({ baseUrl: config?.baseUrl, apiKey: config?.apiKey, defaultWorkflowId: config?.defaultWorkflowId });
  return {
    createTaskGeneric: (opts) => api.createTaskGeneric(opts),
    getTaskStatus: (taskId) => api.getTaskStatus(taskId),
    getTaskResult: (taskId) => api.getTaskResult(taskId),
  };
}


