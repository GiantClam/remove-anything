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
                 href: "/app/generate",
                 icon: "Eraser"
               },
               {
                 title: "BatchBackgroundRemoval",
                 href: "/app/batch-remove-background",
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
