export const env = {
  REPLICATE_WEBHOOK_SECRET: `whsec_${Buffer.from("test-replicate-webhook-secret-with-more-than-32-bytes").toString("base64")}`,
  REPLICATE_OUTPUT_URL_PREFIXES: "https://replicate.delivery/pbxt/",
  R2_URL_BASE: "https://r2.example.test/assets",
};

export const replicateWebhookState = {
  reads: 0,
  writes: 0,
  task: {
    id: 17,
    replicateId: "prediction-17",
    taskStatus: "processing",
    outputImageUrl: null as string | null,
  },
  failPut: false,
  failUpdate: false,
  uploads: [] as Array<{
    filename: string;
    bytes: Buffer;
    options: { path: string; ContentType?: string; acl?: string };
  }>,
};

export function resetReplicateWebhookState() {
  Object.assign(replicateWebhookState, {
    reads: 0,
    writes: 0,
    task: {
      id: 17,
      replicateId: "prediction-17",
      taskStatus: "processing",
      outputImageUrl: null,
    },
    failPut: false,
    failUpdate: false,
    uploads: [],
  });
  env.REPLICATE_WEBHOOK_SECRET = `whsec_${Buffer.from("test-replicate-webhook-secret-with-more-than-32-bytes").toString("base64")}`;
  env.REPLICATE_OUTPUT_URL_PREFIXES = "https://replicate.delivery/pbxt/";
}

export async function findBackgroundRemovalTaskByReplicateId(id: string) {
  replicateWebhookState.reads++;
  return id === replicateWebhookState.task.replicateId
    ? { ...replicateWebhookState.task }
    : null;
}

export async function updateBackgroundRemovalTask(
  id: string,
  data: Record<string, unknown>,
) {
  if (replicateWebhookState.failUpdate) throw new Error("database unavailable");
  if (id !== replicateWebhookState.task.replicateId)
    throw new Error("unknown task");
  replicateWebhookState.writes++;
  Object.assign(replicateWebhookState.task, data);
  return { ...replicateWebhookState.task };
}

export const createR2S3Service = () => ({
  putItemInBucket: async (
    filename: string,
    bytes: Buffer,
    options: { path: string; ContentType?: string; acl?: string },
  ) => {
    if (replicateWebhookState.failPut) throw new Error("R2 unavailable");
    replicateWebhookState.uploads.push({ filename, bytes, options });
    return {
      completedUrl: `${env.R2_URL_BASE}/${options.path}/${filename}`,
    };
  },
});
