import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { getErrorMessage } from "@/lib/handle-error";
import { getUserBackgroundRemovalTasks, getBackgroundRemovalTaskStats } from "@/db/queries/background-removal";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const status = searchParams.get('status');

    console.log("🔍 获取用户任务历史:", {
      userId: user.id,
      limit,
      page,
      status
    });

    // 获取任务列表
    const tasks = await getUserBackgroundRemovalTasks(user.id, limit);
    
    // 获取统计信息
    const stats = await getBackgroundRemovalTaskStats(user.id);

    // 根据状态过滤任务
    let filteredTasks = tasks;
    if (status) {
      filteredTasks = tasks.filter(task => task.taskStatus === status);
    }

    return NextResponse.json({
      success: true,
      tasks: filteredTasks,
      stats,
      pagination: {
        page,
        limit,
        total: tasks.length,
        hasMore: tasks.length === limit
      }
    });

  } catch (error) {
    console.error("❌ 获取用户任务历史失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
