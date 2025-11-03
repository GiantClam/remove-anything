"use client";

import { useEffect, useState } from "react";
import NumberTicker from "@/components/magicui/number-ticker";
import { useTranslations } from "next-intl";

export default function SocialProofBar() {
  const [todayCount, setTodayCount] = useState(134726);
  const t = useTranslations("IndexPage");

  useEffect(() => {
    // 模拟实时更新，实际应该从API获取
    const interval = setInterval(() => {
      setTodayCount((prev) => prev + Math.floor(Math.random() * 3) + 1);
    }, 5000); // 每5秒更新一次

    return () => clearInterval(interval);
  }, []);

  const marquee = t("social.marquee");

  return (
    <div className="relative mb-6 overflow-hidden bg-gradient-to-r from-[#FF4F5E]/10 via-primary/10 to-[#FF4F5E]/10 border-b border-primary/20">
      <div className="flex items-center justify-center py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF4F5E] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF4F5E]"></span>
            </span>
            <span>{t("social.todayRemoved")}</span>
          </span>
          <NumberTicker
            value={todayCount}
            direction="up"
            className="text-[#FF4F5E] font-bold text-base tabular-nums"
          />
          <span>{t("social.objects")}</span>
        </div>
      </div>
      {/* 滚动动画背景 */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 animate-[slide_20s_linear_infinite] whitespace-nowrap">
          <span className="inline-block text-primary/5 text-2xl font-bold mr-8">
            {marquee}
          </span>
          <span className="inline-block text-primary/5 text-2xl font-bold mr-8">
            {marquee}
          </span>
          <span className="inline-block text-primary/5 text-2xl font-bold">
            {marquee}
          </span>
        </div>
      </div>
    </div>
  );
}

