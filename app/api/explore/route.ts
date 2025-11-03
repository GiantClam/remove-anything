import { NextRequest, NextResponse } from "next/server";
import { getFluxDataByPage } from "@/actions/flux-action";
import { z } from "zod";

const searchParamsSchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(12),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const values = searchParamsSchema.parse(
      Object.fromEntries(url.searchParams)
    );
    const { page, limit } = values;

    const result = await getFluxDataByPage({
      page,
      pageSize: limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Explore API error:", error);
    return NextResponse.json(
      {
        data: {
          total: 0,
          page: 1,
          pageSize: 12,
          data: [],
        },
        error: "Failed to load images",
      },
      { status: 500 }
    );
  }
}

