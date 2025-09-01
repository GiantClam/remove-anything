import { DashboardConfig } from "types";

export const dashboardConfig: DashboardConfig = {
  mainNav: [
    {
      title: "Support",
      href: "/support",
      disabled: true,
    },
  ],
  sidebarNav: [
    {
      title: "App",
      items: [
        {
          title: "Index",
          href: "/app",
          icon: "HomeIcon",
        },
        {
          title: "BackgroundRemoval",
          href: "/app/remove-background",
          icon: "eraser"
        },
        {
          title: "BatchBackgroundRemoval",
          href: "/app/batch-remove-background",
          icon: "Images"
        },
        {
          title: "WatermarkRemoval",
          href: "/app/watermark-removal",
          icon: "eraser"
        },
        {
          title: "BatchWatermarkRemoval",
          href: "/app/batch-watermark-removal",
          icon: "Images"
        },
        {
          title: "History",
          href: "/app/history",
          icon: "History",
        },
        {
          title: "GiftCode",
          href: "/app/giftcode",
          icon: "Gift",
        },
        {
          title: "ChargeOrder",
          href: "/app/order",
          icon: "billing",
        },
      ],
    },
  ],
};
