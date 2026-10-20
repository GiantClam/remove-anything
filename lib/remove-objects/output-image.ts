import { env } from "@/env.mjs";
import { getR2ObjectKey } from "@/lib/r2-object-key";
import { persistRunningHubOutput } from "@/lib/runninghub-output";

export function isR2PublicUrl(url?: string | null) {
  return Boolean(getR2ObjectKey(url, env.R2_URL_BASE));
}

export async function saveObjectRemovalImageToR2(
  imageUrl: string,
  _taskId: string,
  recordId: number,
): Promise<string> {
  return persistRunningHubOutput(imageUrl, "object", recordId);
}
