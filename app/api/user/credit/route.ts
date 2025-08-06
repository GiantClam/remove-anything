import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { getUserCredit } from "@/db/queries/account";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const credit = await getUserCredit(user.id);
    return NextResponse.json({ credit });
  } catch (error) {
    console.error("Error fetching user credit:", error);
    return NextResponse.json(
      { error: "Failed to fetch user credit" },
      { status: 500 }
    );
  }
} 