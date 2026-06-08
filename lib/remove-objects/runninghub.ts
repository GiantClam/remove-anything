import type { RunningHubNodeInput } from "../../modules/runninghub/sdk";

export type ObjectRemovalStatus =
  | "pending"
  | "starting"
  | "processing"
  | "succeeded"
  | "failed";

type RunningHubStatusLike =
  | string
  | {
      status?: string | null;
    }
  | null
  | undefined;

export type FrameEditorBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function getEnvValue(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

function getStatusValue(rawStatus: RunningHubStatusLike) {
  if (typeof rawStatus === "string") return rawStatus;
  if (rawStatus && typeof rawStatus.status === "string") return rawStatus.status;
  return "";
}

export function buildDetectNodeInfoList(imageUrl: string, prompt: string): RunningHubNodeInput[] {
  return [
    {
      nodeId: getEnvValue("RUNNINGHUB_OBJECT_DETECT_IMAGE_NODE_ID", "image"),
      fieldName: getEnvValue("RUNNINGHUB_OBJECT_DETECT_IMAGE_FIELD_NAME", "image"),
      fieldValue: imageUrl,
    },
    {
      nodeId: getEnvValue("RUNNINGHUB_OBJECT_DETECT_PROMPT_NODE_ID", "prompt"),
      fieldName: getEnvValue("RUNNINGHUB_OBJECT_DETECT_PROMPT_FIELD_NAME", "prompt"),
      fieldValue: prompt.trim(),
    },
  ];
}

export function buildFrameEditorInfo(
  bbox: FrameEditorBox,
  options?: {
    positiveCoords?: Array<{ x: number; y: number }>;
    negativeCoords?: Array<{ x: number; y: number }>;
    frameIndex?: number;
  },
) {
  return JSON.stringify({
    positive_coords: options?.positiveCoords || [],
    negative_coords: options?.negativeCoords || [],
    bbox: [bbox],
    frame_index: options?.frameIndex ?? 0,
  });
}

export function buildSegmentNodeInfoList(
  imageUrl: string,
  bbox: FrameEditorBox,
): RunningHubNodeInput[] {
  return [
    {
      nodeId: getEnvValue("RUNNINGHUB_OBJECT_SEGMENT_IMAGE_NODE_ID", "19"),
      fieldName: getEnvValue("RUNNINGHUB_OBJECT_SEGMENT_IMAGE_FIELD_NAME", "image"),
      fieldValue: imageUrl,
    },
    {
      nodeId: getEnvValue("RUNNINGHUB_OBJECT_SEGMENT_FRAME_EDITOR_NODE_ID", "25"),
      fieldName: getEnvValue("RUNNINGHUB_OBJECT_SEGMENT_FRAME_EDITOR_FIELD_NAME", "info"),
      fieldValue: buildFrameEditorInfo(bbox),
    },
  ];
}

export function buildRemoveNodeInfoList(
  imageUrl: string,
  maskUrl: string,
  prompt?: string,
): RunningHubNodeInput[] {
  const trimmedPrompt = prompt?.trim();

  return [
    {
      nodeId: getEnvValue("RUNNINGHUB_OBJECT_REMOVE_IMAGE_NODE_ID", "94"),
      fieldName: getEnvValue("RUNNINGHUB_OBJECT_REMOVE_IMAGE_FIELD_NAME", "image"),
      fieldValue: imageUrl,
    },
    {
      nodeId: getEnvValue("RUNNINGHUB_OBJECT_REMOVE_MASK_NODE_ID", "103"),
      fieldName: getEnvValue("RUNNINGHUB_OBJECT_REMOVE_MASK_FIELD_NAME", "image"),
      fieldValue: maskUrl,
    },
    ...(trimmedPrompt
      ? [
          {
            nodeId: getEnvValue("RUNNINGHUB_OBJECT_REMOVE_PROMPT_NODE_ID", "6"),
            fieldName: getEnvValue("RUNNINGHUB_OBJECT_REMOVE_PROMPT_FIELD_NAME", "text"),
            fieldValue: trimmedPrompt,
          },
        ]
      : []),
  ];
}

export function normalizeRunningHubStatus(rawStatus: RunningHubStatusLike): ObjectRemovalStatus {
  const value = getStatusValue(rawStatus).toLowerCase();

  if (value === "starting" || value === "submitted") return "starting";
  if (value === "processing" || value === "running" || value === "executing") return "processing";
  if (value === "success" || value === "succeeded") return "succeeded";
  if (value === "failed" || value === "error") return "failed";

  return "pending";
}

export function getRunningHubOutputFileUrl(outputData: unknown): string | null {
  if (!Array.isArray(outputData)) {
    return null;
  }

  for (const item of outputData) {
    if (
      item &&
      typeof item === "object" &&
      "fileUrl" in item &&
      typeof item.fileUrl === "string" &&
      item.fileUrl
    ) {
      const fileName =
        "fileName" in item && typeof item.fileName === "string"
          ? item.fileName.toLowerCase()
          : "";
      const fileUrl = item.fileUrl.toLowerCase();

      if (fileName.includes("mask") || fileUrl.includes("mask")) {
        return item.fileUrl;
      }
    }
  }

  for (const item of outputData) {
    if (
      item &&
      typeof item === "object" &&
      "fileUrl" in item &&
      typeof item.fileUrl === "string" &&
      item.fileUrl
    ) {
      return item.fileUrl;
    }
  }

  return null;
}
