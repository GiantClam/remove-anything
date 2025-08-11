"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";

interface ClientDateProps {
  date: Date | string;
  className?: string;
}

/**
 * 客户端安全的日期显示组件
 * 避免服务器端和客户端时间格式不一致导致的水合错误
 */
export function ClientDate({ date, className }: ClientDateProps) {
  const [formattedDate, setFormattedDate] = useState("");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setFormattedDate(formatDate(date));
  }, [date]);

  // 避免水合错误：服务器端返回占位符，客户端显示真实日期
  if (!isClient) {
    return <span className={className}>Loading...</span>;
  }

  return <span className={className}>{formattedDate}</span>;
}
