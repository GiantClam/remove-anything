/** Hermetic boundaries for the real cleanup route and retention runner. */
export const retentionRouteState = {
  rows: [] as Record<string, any>[],
  reads: [] as Record<string, any>[],
  updates: [] as Record<string, any>[],
  auditDeletes: [] as Record<string, any>[],
  deletedKeys: [] as string[],
  storageCreates: 0,
};

const taskModels = [
  "taskData",
  "backgroundRemovalTask",
  "watermarkRemovalTask",
  "objectRemovalTask",
] as const;
export const retentionRoutePrisma = Object.fromEntries(
  taskModels.map((model) => [
    model,
    {
      findMany: async (args: Record<string, any>) => {
        retentionRouteState.reads.push({ model, args });
        if (model !== "backgroundRemovalTask") return [];
        if (
          args.where.taskStatus?.in ||
          args.where.retentionCleanedAt?.not === null
        )
          return [];
        return retentionRouteState.rows
          .filter((row) => !row.retentionCleanedAt)
          .slice(0, args.take)
          .map((row) => ({ ...row }));
      },
      update: async (args: Record<string, any>) => {
        retentionRouteState.updates.push({ model, args });
        const row = retentionRouteState.rows.find(
          (row) => row.id === args.where.id,
        );
        if (row) Object.assign(row, args.data);
        return row;
      },
      deleteMany: async (args: Record<string, any>) => {
        retentionRouteState.auditDeletes.push({ model, args });
        return { count: 0 };
      },
      count: async () => 0,
    },
  ]),
);
for (const model of [
  "backgroundComposition",
  "backgroundImage",
  "media",
  "user",
])
  retentionRoutePrisma[model] = { count: async () => 0 } as any;

export function createR2S3Service() {
  retentionRouteState.storageCreates++;
  return {
    deleteItemInBucket: async (key: string) => {
      retentionRouteState.deletedKeys.push(key);
    },
  };
}

export function createRetentionR2Storage() {
  return createR2S3Service();
}

export const runninghubAPI = {
  cancelTask: async (_taskId: string) => true,
  getTaskStatus: async (_taskId: string) => ({ code: 0, data: "SUCCESS" }),
};

export function resetRetentionRouteState() {
  retentionRouteState.rows = [
    {
      id: 1,
      taskStatus: "succeeded",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      outputImageUrl: "https://retention.example.test/tasks/1/output.png",
    },
  ];
  retentionRouteState.reads = [];
  retentionRouteState.updates = [];
  retentionRouteState.auditDeletes = [];
  retentionRouteState.deletedKeys = [];
  retentionRouteState.storageCreates = 0;
}
