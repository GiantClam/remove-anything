import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/db/prisma";
import { getCurrentUser } from "@/lib/auth-utils";
import {
  CompositionInputError,
  decodeCompositionImageDataUrl,
  readCompositionJson,
  validateCreateCompositionInput,
  validateUpdateCompositionInput,
} from "@/lib/background-composition-input";
import { isBackgroundCompositionResultKey } from "@/lib/background-composition-result-key";
import {
  createBackgroundCompositionResultReadUrl,
  deleteBackgroundCompositionResult,
  PrivateCompositionStorageError,
  uploadBackgroundCompositionResult,
} from "@/lib/background-composition-result-storage";
import { getErrorMessage } from "@/lib/handle-error";
import { ImageInputError } from "@/lib/image-input";
import { readTrustedImageAllowingPrivateR2 } from "@/lib/private-r2-image-input";
import { getToolRegistryEntry } from "@/lib/tool-registry";

export const dynamic = "force-dynamic";

const DEFAULT_HISTORY_PAGE = 1;
const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_PAGE = 10_000;
const MAX_HISTORY_LIMIT = 100;

function parseHistoryPaginationValue(
  rawValue: string | null,
  defaultValue: number,
  maximum: number,
) {
  if (rawValue === null) return defaultValue;
  if (!/^\d+$/.test(rawValue)) {
    throw new CompositionInputError(
      "INVALID_COMPOSITION_INPUT",
      "Invalid pagination parameters",
      400,
    );
  }
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new CompositionInputError(
      "INVALID_COMPOSITION_INPUT",
      "Invalid pagination parameters",
      400,
    );
  }
  return Math.min(value, maximum);
}

function redactInlineDataUrls(value: unknown): unknown {
  if (typeof value === "string") {
    return /^\s*data:/i.test(value) ? "data:[omitted]" : value;
  }
  if (Array.isArray(value)) return value.map(redactInlineDataUrls);
  if (value && typeof value === "object") {
    if (value instanceof Date) return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        redactInlineDataUrls(nested),
      ]),
    );
  }
  return value;
}

function redactComposition(value: Record<string, unknown>) {
  const { id, resultImageUrl, ...safeValue } = value;
  const safeResultUrl =
    typeof id === "number" &&
    isBackgroundCompositionResultKey(id, resultImageUrl)
      ? `/api/background-composition?compositionId=${id}`
      : null;
  return redactInlineDataUrls({
    ...safeValue,
    resultImageUrl: safeResultUrl,
  });
}

function parseCompositionId(rawValue: string | null) {
  if (rawValue === null) return null;
  if (!/^\d+$/.test(rawValue)) {
    throw new CompositionInputError(
      "INVALID_COMPOSITION_INPUT",
      "Invalid composition id",
      400,
    );
  }
  const compositionId = Number(rawValue);
  if (!Number.isSafeInteger(compositionId) || compositionId < 1) {
    throw new CompositionInputError(
      "INVALID_COMPOSITION_INPUT",
      "Invalid composition id",
      400,
    );
  }
  return compositionId;
}

const COMPOSITION_RESULT_RETENTION_MS = 24 * 60 * 60 * 1000;

function trustedAppOrigins(environment: Record<string, string | undefined>) {
  const origins = new Set<string>();
  for (const value of [
    environment.NEXT_PUBLIC_APP_URL,
    environment.NEXT_PUBLIC_SITE_URL,
    environment.NEXTAUTH_URL,
    environment.VERCEL_URL
      ? environment.VERCEL_URL.startsWith("http")
        ? environment.VERCEL_URL
        : `https://${environment.VERCEL_URL}`
      : undefined,
  ]) {
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (
        parsed.protocol === "https:" &&
        !parsed.username &&
        !parsed.password &&
        !parsed.hash
      ) {
        origins.add(parsed.origin);
      }
    } catch {
      // Invalid configuration never widens the trusted app origin set.
    }
  }
  return origins;
}

/**
 * Map owner-facing preview download URLs back to the durable private R2 URL
 * stored on the owned task. Status APIs never expose the private object URL.
 */
function parseBackgroundPreviewTaskId(
  sourceUrl: string,
  environment: Record<string, string | undefined>,
): string | null {
  let pathname: string;
  let search: string;
  if (sourceUrl.startsWith("/")) {
    if (sourceUrl.startsWith("//")) return null;
    try {
      const parsed = new URL(sourceUrl, "https://composition.invalid");
      pathname = parsed.pathname;
      search = parsed.search;
    } catch {
      return null;
    }
  } else {
    try {
      const parsed = new URL(sourceUrl);
      if (
        parsed.protocol !== "https:" ||
        parsed.username ||
        parsed.password ||
        parsed.hash ||
        !trustedAppOrigins(environment).has(parsed.origin)
      ) {
        return null;
      }
      pathname = parsed.pathname;
      search = parsed.search;
    } catch {
      return null;
    }
  }
  if (pathname !== "/api/download-background") return null;
  const taskId = new URLSearchParams(search).get("taskId")?.trim();
  return taskId || null;
}

async function assertOwnedCompositionSources(
  userId: string,
  foregroundImageUrl: string,
  backgroundType: string,
  backgroundData: unknown,
): Promise<{ foregroundImageUrl: string; backgroundData: unknown }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - COMPOSITION_RESULT_RETENTION_MS);
  const activeOwnedTask = {
    userId,
    taskStatus: "succeeded",
    retentionCleanedAt: null,
    createdAt: { gte: cutoff },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
  const sourceEnvironment = {
    ...process.env,
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL,
  };
  const findOwnedSource = async (sourceUrl: string) => {
    const lookups = await Promise.all([
      prisma.backgroundRemovalTask.findFirst({
        where: { ...activeOwnedTask, outputImageUrl: sourceUrl },
        select: { id: true },
      }),
      prisma.objectRemovalTask.findFirst({
        where: { ...activeOwnedTask, outputImageUrl: sourceUrl },
        select: { id: true },
      }),
      prisma.taskData.findFirst({
        where: { ...activeOwnedTask, imageUrl: sourceUrl },
        select: { id: true },
      }),
    ]);
    return lookups.some(Boolean);
  };
  const resolveOwnedForegroundUrl = async (sourceUrl: string) => {
    const previewTaskId = parseBackgroundPreviewTaskId(
      sourceUrl,
      sourceEnvironment,
    );
    if (previewTaskId) {
      const ownedTask = await prisma.backgroundRemovalTask.findFirst({
        where: { ...activeOwnedTask, replicateId: previewTaskId },
        select: { outputImageUrl: true },
      });
      if (!ownedTask?.outputImageUrl) {
        throw new CompositionInputError(
          "COMPOSITION_SOURCE_UNAVAILABLE",
          "Composition source is unavailable",
          404,
        );
      }
      return ownedTask.outputImageUrl;
    }
    return sourceUrl;
  };

  const resolvedForegroundUrl =
    await resolveOwnedForegroundUrl(foregroundImageUrl);
  if (!(await findOwnedSource(resolvedForegroundUrl))) {
    throw new CompositionInputError(
      "COMPOSITION_SOURCE_UNAVAILABLE",
      "Composition source is unavailable",
      404,
    );
  }

  if (resolvedForegroundUrl.startsWith("/")) {
    throw new CompositionInputError(
      "COMPOSITION_SOURCE_UNAVAILABLE",
      "Composition source is unavailable",
      404,
    );
  }
  const tool = getToolRegistryEntry("remove-background");
  if (!tool) {
    throw new CompositionInputError(
      "TOOL_CONFIG_UNAVAILABLE",
      "Image validation settings are unavailable",
      503,
    );
  }
  const imageOptions = {
    maxBytes: tool.limits.maxFileSizeMb * 1024 * 1024,
    allowedMimeTypes: tool.inputFormats,
    maxPixels: tool.limits.maxPixels,
  };
  // Private R2 cutouts are owner-scoped; bare GET returns 400 Authorization.
  await readTrustedImageAllowingPrivateR2(
    resolvedForegroundUrl,
    imageOptions,
    { environment: sourceEnvironment },
  );

  let resolvedBackgroundData = backgroundData;
  if (backgroundType === "image") {
    const imageUrl =
      backgroundData && typeof backgroundData === "object"
        ? (backgroundData as { imageUrl?: unknown }).imageUrl
        : null;
    if (typeof imageUrl !== "string") {
      throw new CompositionInputError(
        "COMPOSITION_SOURCE_UNAVAILABLE",
        "Composition source is unavailable",
        404,
      );
    }
    const resolvedBackgroundUrl = await resolveOwnedForegroundUrl(imageUrl);
    const publicImage = await prisma.backgroundImage.findFirst({
      where: { imageUrl: resolvedBackgroundUrl, isPublic: true },
      select: { id: true },
    });
    // Catalog rows keep their public URL; owned cutouts resolve to private R2.
    const ownedImage = await findOwnedSource(resolvedBackgroundUrl);
    if (!publicImage && !ownedImage) {
      throw new CompositionInputError(
        "COMPOSITION_SOURCE_UNAVAILABLE",
        "Composition source is unavailable",
        404,
      );
    }
    if (resolvedBackgroundUrl.startsWith("/"))
      throw new CompositionInputError(
        "COMPOSITION_SOURCE_UNAVAILABLE",
        "Composition source is unavailable",
        404,
      );
    await readTrustedImageAllowingPrivateR2(
      resolvedBackgroundUrl,
      imageOptions,
      { environment: sourceEnvironment },
    );
    if (
      backgroundData &&
      typeof backgroundData === "object" &&
      resolvedBackgroundUrl !== imageUrl
    ) {
      resolvedBackgroundData = {
        ...(backgroundData as Record<string, unknown>),
        imageUrl: resolvedBackgroundUrl,
      };
    }
  }

  if (backgroundType === "template") {
    const template =
      backgroundData && typeof backgroundData === "object"
        ? (backgroundData as { templateId?: unknown; imageUrl?: unknown })
        : {};
    const templateId = template.templateId;
    const templateImageUrl = template.imageUrl;
    const allowedTemplates = new Set([
      "office",
      "nature",
      "abstract",
      "studio",
      "beach",
      "city",
    ]);
    if (
      typeof templateId !== "string" ||
      !allowedTemplates.has(templateId) ||
      (templateImageUrl !== undefined &&
        templateImageUrl !== `/templates/${templateId}.jpg`)
    ) {
      throw new CompositionInputError(
        "COMPOSITION_SOURCE_UNAVAILABLE",
        "Composition source is unavailable",
        404,
      );
    }
  }

  return {
    foregroundImageUrl: resolvedForegroundUrl,
    backgroundData: resolvedBackgroundData,
  };
}

function compositionDeadline(composition: {
  createdAt?: Date | string | null;
}) {
  const createdAt =
    composition.createdAt instanceof Date
      ? composition.createdAt
      : composition.createdAt
        ? new Date(composition.createdAt)
        : null;
  const createdDeadline =
    createdAt && Number.isFinite(createdAt.getTime())
      ? createdAt.getTime() + COMPOSITION_RESULT_RETENTION_MS
      : null;
  if (createdDeadline === null) return null;
  return createdDeadline;
}

// 创建背景合成任务
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = validateCreateCompositionInput(await readCompositionJson(req));
    const ownedSources = await assertOwnedCompositionSources(
      userId,
      data.foregroundImageUrl,
      data.backgroundType,
      data.backgroundData,
    );

    // 创建合成任务记录
    const composition = await prisma.backgroundComposition.create({
      data: {
        userId,
        foregroundImageUrl: ownedSources.foregroundImageUrl,
        backgroundType: data.backgroundType,
        backgroundData: ownedSources.backgroundData,
        compositionParams: data.compositionParams,
        status: "pending",
      },
    });

    // 在客户端进行图片合成，这里只记录任务
    // 实际的合成将在客户端完成，然后上传结果

    return NextResponse.json(
      {
        success: true,
        data: {
          id: composition.id,
          status: composition.status,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (
      error instanceof CompositionInputError ||
      error instanceof ImageInputError
    ) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("创建背景合成任务失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// 更新合成结果
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { compositionId, resultImageDataUrl } =
      validateUpdateCompositionInput(await readCompositionJson(req));

    // 查找合成任务
    const composition = await prisma.backgroundComposition.findFirst({
      where: {
        id: compositionId,
        userId,
      },
    });

    if (!composition) {
      return NextResponse.json(
        { error: "Composition not found" },
        { status: 404 },
      );
    }

    const deadline = compositionDeadline(composition);
    if (
      composition.status !== "pending" ||
      deadline === null ||
      deadline <= Date.now()
    ) {
      return NextResponse.json(
        {
          error: "Composition can no longer be updated",
          code:
            deadline === null || deadline <= Date.now()
              ? "COMPOSITION_RESULT_EXPIRED"
              : "COMPOSITION_NOT_PENDING",
        },
        { status: deadline === null || deadline <= Date.now() ? 410 : 409 },
      );
    }

    const image = await decodeCompositionImageDataUrl(
      resultImageDataUrl,
      ["image/png"],
      `composition-${compositionId}.png`,
    );
    if (deadline <= Date.now()) {
      return NextResponse.json(
        {
          error: "Composition can no longer be updated",
          code: "COMPOSITION_RESULT_EXPIRED",
        },
        { status: 410 },
      );
    }
    const resultImageKey = await uploadBackgroundCompositionResult(
      compositionId,
      image.file,
    );

    // 更新合成任务
    let updatedComposition;
    try {
      updatedComposition = await prisma.backgroundComposition.update({
        where: {
          id: compositionId,
          userId,
          status: "pending",
          createdAt: {
            gt: new Date(Date.now() - COMPOSITION_RESULT_RETENTION_MS),
          },
        },
        data: {
          // This field stores a private-bucket object key. It is never exposed
          // directly and is accepted by the result route only in this format.
          resultImageUrl: resultImageKey,
          resultImageSize: image.bytes.length,
          status: "completed",
          completedAt: new Date(),
        },
      });
    } catch (error) {
      try {
        await deleteBackgroundCompositionResult(resultImageKey, compositionId);
      } catch (cleanupError) {
        console.error("背景合成结果孤儿对象清理失败:", cleanupError);
      }
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        data: redactComposition(updatedComposition),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (
      error instanceof CompositionInputError ||
      error instanceof ImageInputError ||
      error instanceof PrivateCompositionStorageError
    ) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("更新合成结果失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// 获取合成历史
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const compositionId = parseCompositionId(
      url.searchParams.get("compositionId"),
    );

    if (compositionId !== null) {
      const composition = await prisma.backgroundComposition.findFirst({
        where: { id: compositionId, userId },
      });
      if (!composition) {
        return NextResponse.json(
          { error: "Composition not found" },
          { status: 404 },
        );
      }
      const deadline = compositionDeadline(composition);
      if (
        composition.status !== "completed" ||
        deadline === null ||
        deadline <= Date.now()
      ) {
        return NextResponse.json(
          {
            error: "Composition result is unavailable",
            code: "COMPOSITION_RESULT_EXPIRED",
          },
          { status: 410 },
        );
      }
      if (!composition.resultImageUrl) {
        return NextResponse.json(
          {
            error: "Composition result is unavailable",
            code: "RESULT_MIGRATION_REQUIRED",
          },
          { status: 409 },
        );
      }
      if (
        !isBackgroundCompositionResultKey(
          compositionId,
          composition.resultImageUrl,
        )
      ) {
        return NextResponse.json(
          {
            error: "Composition result is awaiting private storage migration",
            code: "RESULT_MIGRATION_REQUIRED",
          },
          { status: 409 },
        );
      }

      try {
        const signedUrlExpiresIn = Math.min(
          60,
          Math.floor((deadline - Date.now()) / 1000),
        );
        if (signedUrlExpiresIn < 1) {
          return NextResponse.json(
            {
              error: "Composition result is unavailable",
              code: "COMPOSITION_RESULT_EXPIRED",
            },
            { status: 410 },
          );
        }
        const resultImageUrl = await createBackgroundCompositionResultReadUrl(
          composition.resultImageUrl,
          compositionId,
          signedUrlExpiresIn,
        );
        return NextResponse.json(
          {
            success: true,
            data: {
              id: composition.id,
              status: composition.status,
              resultImageUrl,
              expiresAt: new Date(deadline).toISOString(),
            },
          },
          { headers: { "Cache-Control": "private, no-store" } },
        );
      } catch (error) {
        if (error instanceof PrivateCompositionStorageError) {
          return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.status },
          );
        }
        throw error;
      }
    }

    const page = parseHistoryPaginationValue(
      url.searchParams.get("page"),
      DEFAULT_HISTORY_PAGE,
      MAX_HISTORY_PAGE,
    );
    const limit = parseHistoryPaginationValue(
      url.searchParams.get("limit"),
      DEFAULT_HISTORY_LIMIT,
      MAX_HISTORY_LIMIT,
    );

    const [compositions, total] = await Promise.all([
      prisma.backgroundComposition.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          backgroundImage: true,
        },
      }),
      prisma.backgroundComposition.count({ where: { userId } }),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: compositions.map(redactComposition),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof CompositionInputError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("获取合成历史失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
