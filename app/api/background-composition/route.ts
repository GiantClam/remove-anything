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
import { getErrorMessage } from "@/lib/handle-error";
import { ImageInputError } from "@/lib/image-input";
import { uploadToR2 } from "@/lib/upload";

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

// 创建背景合成任务
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = validateCreateCompositionInput(await readCompositionJson(req));

    // 创建合成任务记录
    const composition = await prisma.backgroundComposition.create({
      data: {
        userId,
        foregroundImageUrl: data.foregroundImageUrl,
        backgroundType: data.backgroundType,
        backgroundData: data.backgroundData,
        compositionParams: data.compositionParams,
        status: "pending",
      },
    });

    // 在客户端进行图片合成，这里只记录任务
    // 实际的合成将在客户端完成，然后上传结果

    return NextResponse.json({
      success: true,
      data: {
        id: composition.id,
        status: composition.status,
      },
    });
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

    const image = await decodeCompositionImageDataUrl(
      resultImageDataUrl,
      ["image/png"],
      `composition-${compositionId}.png`,
    );
    const resultImageUrl = await uploadToR2(image.file);

    // 更新合成任务
    const updatedComposition = await prisma.backgroundComposition.update({
      where: { id: compositionId, userId },
      data: {
        resultImageUrl,
        resultImageSize: image.bytes.length,
        status: "completed",
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedComposition,
    });
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

    return NextResponse.json({
      success: true,
      data: compositions.map(redactInlineDataUrls),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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
