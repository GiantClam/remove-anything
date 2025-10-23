import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/db/prisma";
import { uploadToR2 } from "@/lib/upload";
import { getErrorMessage } from "@/lib/handle-error";

export const dynamic = 'force-dynamic';

// 创建背景合成任务
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id;

    const data = await req.json();
    const {
      foregroundImageUrl,
      backgroundType,
      backgroundData,
      compositionParams
    } = data;

    if (!foregroundImageUrl || !backgroundType || !backgroundData || !compositionParams) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 创建合成任务记录
    const composition = await prisma.backgroundComposition.create({
      data: {
        userId,
        foregroundImageUrl,
        backgroundType,
        backgroundData,
        compositionParams,
        status: 'pending'
      }
    });

    // 在客户端进行图片合成，这里只记录任务
    // 实际的合成将在客户端完成，然后上传结果
    
    return NextResponse.json({
      success: true,
      data: {
        id: composition.id,
        status: composition.status
      }
    });
  } catch (error) {
    console.error("创建背景合成任务失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// 更新合成结果
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id;

    const data = await req.json();
    const { compositionId, resultImageDataUrl } = data;

    if (!compositionId || !resultImageDataUrl) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 查找合成任务
    const composition = await prisma.backgroundComposition.findFirst({
      where: {
        id: compositionId,
        userId: userId || undefined
      }
    });

    if (!composition) {
      return NextResponse.json(
        { error: "Composition not found" },
        { status: 404 }
      );
    }

    // 将base64图片转换为File并上传到R2
    const base64Data = resultImageDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const file = new File([buffer], `composition-${compositionId}.png`, { type: 'image/png' });
    
    const resultImageUrl = await uploadToR2(file);

    // 更新合成任务
    const updatedComposition = await prisma.backgroundComposition.update({
      where: { id: compositionId },
      data: {
        resultImageUrl,
        resultImageSize: buffer.length,
        status: 'completed',
        completedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedComposition
    });
  } catch (error) {
    console.error("更新合成结果失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// 获取合成历史
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const [compositions, total] = await Promise.all([
      prisma.backgroundComposition.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          backgroundImage: true
        }
      }),
      prisma.backgroundComposition.count({ where: { userId } })
    ]);

    return NextResponse.json({
      success: true,
      data: compositions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("获取合成历史失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
