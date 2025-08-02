import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

import { AccountHashids } from "@/db/dto/account.dto";
import { getUserCredit } from "@/db/queries/account";
import { redis } from "@/lib/redis";

export async function GET(req: NextRequest) {
  // 在构建时跳过数据库查询
  if (shouldSkipDatabaseQuery()) {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  console.time("stat");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  // console.timeLog("stat");

  // const ratelimit = new Ratelimit({
  //   redis,
  //   limiter: Ratelimit.slidingWindow(5, "5 s"),
  //   analytics: true,
  // });
  // const { success } = await ratelimit.limit(
  //   "account:info" + `_${req.ip ?? ""}`,
  // );
  console.timeLog("stat");

  // if (!success) {
  //   return new Response("Too Many Requests", {
  //     status: 429,
  //   });
  // }

  const accountInfo = await getUserCredit(user.id);
  console.timeEnd("stat");

  return NextResponse.json({
    ...accountInfo,
    id: AccountHashids.encode(Number(accountInfo.id)),
  });
}
