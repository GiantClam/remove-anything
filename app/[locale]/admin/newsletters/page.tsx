import { prisma } from "@/db/prisma";

import NewsLatterCard from "./_mods/card";

export default async function AdminNewslettersPage() {
  // Get counts using Prisma queries instead of raw SQL for SQLite compatibility  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [todayCount, thisMonthCount, total] = await Promise.all([
    prisma.newsletters.count({
      where: {
        sentAt: {
          gte: today,
          lt: tomorrow
        }
      }
    }),
    prisma.newsletters.count({
      where: {
        sentAt: {
          gte: firstDayOfMonth,
          lt: firstDayOfNextMonth
        }
      }
    }),
    prisma.newsletters.count()
  ]);

  const count = {
    today_count: todayCount,
    this_month_count: thisMonthCount, 
    total: total
  };
  const nl = await prisma.newsletters.findMany({
    take: 100,
    orderBy: {
      sentAt: "desc",
    },
  });

  return <NewsLatterCard count={count ?? {}} dataSource={nl} />;
}
