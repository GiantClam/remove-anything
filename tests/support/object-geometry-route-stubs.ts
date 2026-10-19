export const objectGeometryRouteState = {
  createCalls: 0,
  statusCalls: 0,
  resultCalls: 0,
  cancelCalls: 0,
  reset() {
    this.createCalls = 0;
    this.statusCalls = 0;
    this.resultCalls = 0;
    this.cancelCalls = 0;
  },
};

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const runninghubAPI = {
  async createObjectDetectTask() {
    objectGeometryRouteState.createCalls++;
    return "detect-test-task";
  },
  async createObjectSegmentTask() {
    objectGeometryRouteState.createCalls++;
    return "segment-test-task";
  },
  async getTaskStatus() {
    objectGeometryRouteState.statusCalls++;
    return { data: { status: "succeeded" } };
  },
  async getTaskResult() {
    objectGeometryRouteState.resultCalls++;
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
