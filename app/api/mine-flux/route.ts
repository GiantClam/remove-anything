import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';
import { z } from "zod";

import { model } from "@/config/constants";
import { FluxHashids } from "@/db/dto/flux.dto";
import { prisma } from "@/db/prisma";
import { FluxTaskStatus } from "@/db/type";
import { getErrorMessage } from "@/lib/handle-error";

const searchParamsSchema = z.object({
  page: z.coerce.number().default(1),
  pageSize: z.coerce.number().default(10),
  sort: z.string().optional(),
  model: z.enum([model.backgroundRemoval]).optional(),
});

export async function GET(req: NextRequest) {
  // 在构建时跳过数据库查询
  if (shouldSkipDatabaseQuery()) {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = user.id;
  
  // 开发模式：返回空数据
  const isDevMode = process.env.NODE_ENV === "development" && userId === "dev-user-123";
  if (isDevMode) {
    console.log("🔧 开发模式：使用测试用户账户");
    const url = new URL(req.url);
    const values = searchParamsSchema.parse(
      Object.fromEntries(url.searchParams),
    );
    const { page, pageSize } = values;
    
    return NextResponse.json({
      data: {
        total: 0,
        page,
        pageSize,
        data: [],
      },
    });
  }
  
  try {
    const url = new URL(req.url);
    const values = searchParamsSchema.parse(
      Object.fromEntries(url.searchParams),
    );
    const { page, pageSize, model } = values;
    const offset = (page - 1) * pageSize;
    const whereConditions: any = {
      userId,
      taskStatus: {
        in: [FluxTaskStatus.Succeeded, FluxTaskStatus.Processing],
      },
    };
    if (model) {
      whereConditions.model = model;
    }

    const [fluxData, total] = await Promise.all([
      prisma.fluxData.findMany({
        where: whereConditions,
        take: pageSize,
        skip: offset,
        orderBy: { createdAt: "desc" },
      }),
      prisma.fluxData.count({ where: whereConditions }),
    ]);

    return NextResponse.json({
      data: {
        total,
        page,
        pageSize,
        data: fluxData.map(
          ({ id, executeEndTime, executeStartTime, loraUrl, ...rest }) => ({
            ...rest,
            executeTime:
              executeEndTime && executeStartTime
                ? Number(`${executeEndTime - executeStartTime}`)
                : 0,
            id: FluxHashids.encode(id),
          }),
        ),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
