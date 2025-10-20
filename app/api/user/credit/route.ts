import { NextResponse, type NextRequest } from "next/server";
import { createProjectAuthProvider } from "@/modules/auth/adapter";
import { getUserCredit } from "@/db/queries/account";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 在构建时跳过数据库查询
    if (shouldSkipDatabaseQuery()) {
      console.log("🔧 构建时：跳过 /api/user/credit 查询");
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }

    const auth = createProjectAuthProvider();
    const user = await auth.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const credit = await getUserCredit(user.userId!);
    return NextResponse.json({ credit });
  } catch (error) {
    console.error("❌ /api/user/credit 错误:", error);
    
    // 在构建时或出现错误时返回503
    if (shouldSkipDatabaseQuery()) {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }
    
    return NextResponse.json(
      { error: "Failed to fetch user credit" },
      { status: 500 }
    );
  }
} 