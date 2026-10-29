export const objectGeometryRouteState = {
  createCalls: 0,
  statusCalls: 0,
  resultCalls: 0,
  cancelCalls: 0,
  createDeadlineAt: undefined as number | undefined,
  statusDeadlineAt: undefined as number | undefined,
  resultDeadlineAt: undefined as number | undefined,
  reset() {
    this.createCalls = 0;
    this.statusCalls = 0;
    this.resultCalls = 0;
    this.cancelCalls = 0;
    this.createDeadlineAt = undefined;
    this.statusDeadlineAt = undefined;
    this.resultDeadlineAt = undefined;
  },
};

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const runninghubAPI = {
  async createObjectDetectTask(
    _nodeInfoList?: unknown,
    options?: { deadlineAt?: number },
  ) {
    objectGeometryRouteState.createCalls++;
    objectGeometryRouteState.createDeadlineAt = options?.deadlineAt;
    return "detect-test-task";
  },
  async createObjectSegmentTask(
    _nodeInfoList?: unknown,
    options?: { deadlineAt?: number },
  ) {
    objectGeometryRouteState.createCalls++;
    objectGeometryRouteState.createDeadlineAt = options?.deadlineAt;
    return "segment-test-task";
  },
  async getTaskStatus(_taskId?: string, options?: { deadlineAt?: number }) {
    objectGeometryRouteState.statusCalls++;
    objectGeometryRouteState.statusDeadlineAt = options?.deadlineAt;
    return { data: { status: "succeeded" } };
  },
  async getTaskResult(_taskId?: string, options?: { deadlineAt?: number }) {
    objectGeometryRouteState.resultCalls++;
    objectGeometryRouteState.resultDeadlineAt = options?.deadlineAt;
    return {
      data: [
        {
          fileName: "mask.png",
          fileUrl: "https://files.example.test/mask.png",
        },
      ],
    };
  },
  async cancelTask() {
    objectGeometryRouteState.cancelCalls++;
    return true;
  },
};
