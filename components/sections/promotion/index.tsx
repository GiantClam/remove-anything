import { auth } from "@/lib/auth-utils";

import { getChargeProduct, getClaimed } from "@/db/queries/charge-product";

import { PromotionBanner } from "./promotion-banner";

export default async function Promotion({ locale }: { locale: string }) {
  try {
    // 添加超时处理
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), 5000);
    });

    const queryPromise = getChargeProduct(locale);
    
    const { data: chargeProduct } = await Promise.race([queryPromise, timeoutPromise]) as any;
    
    let claimed = true;
    const targetDate = new Date("2024-08-20T20:20:00+08:00");
    const oneMonthLater = new Date(
      targetDate.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
    const now = new Date();

    if (now >= oneMonthLater) {
      return null;
    }

    return (
      <PromotionBanner
        title="限时优惠"
        description="立即获取优惠积分，享受更多AI服务"
        ctaText="立即获取"
        ctaLink="/pricing"
        variant="success"
      />
    );
  } catch (error) {
    console.error("❌ Promotion 组件错误:", error);
    // 如果出错，不显示促销横幅，但不影响页面加载
    return null;
  }
}
