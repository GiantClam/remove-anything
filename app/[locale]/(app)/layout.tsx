import { unstable_setRequestLocale } from "next-intl/server";
import dynamic from "next/dynamic";

import UserPoints from "@/components/dashboard/points";
import { SearchCommand } from "@/components/dashboard/search-command";

// 使用动态导入避免SSR问题
const DashboardSidebar = dynamic(() => 
  import("@/components/layout/dashboard-sidebar").then(mod => ({ default: mod.DashboardSidebar })), 
  { ssr: false }
);
const MobileSheetSidebar = dynamic(() => 
  import("@/components/layout/dashboard-sidebar").then(mod => ({ default: mod.MobileSheetSidebar })), 
  { ssr: false }
);
import { DashboardNav } from "@/components/layout/dashboard-sidenav";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { NavBar, NavbarUserInfo } from "@/components/layout/navbar";
import { SiteFooter } from "@/components/layout/site-footer";
import MaxWidthWrapper from "@/components/shared/max-width-wrapper";
import { dashboardConfig } from "@/config/dashboard";

interface DashboardLayoutProps {
  children?: React.ReactNode;
  params: { locale: string };
}
export default function DashboardLayout({
  children,
  params: { locale },
}: DashboardLayoutProps) {
  unstable_setRequestLocale(locale);

  const filteredLinks = dashboardConfig.sidebarNav.map((section) => ({
    ...section,
  }));

  return (
    <MaxWidthWrapper className="max-w-[1650px] px-0">
      <div className="relative flex min-h-screen w-full">
        <DashboardSidebar links={filteredLinks} />

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-50 flex h-14 items-center gap-3 bg-background px-4 lg:h-[60px] xl:px-10">
            <MobileSheetSidebar links={filteredLinks} />

            <div className="w-full flex-1">
              <div className="hidden md:block">
                <SearchCommand links={filteredLinks} />
              </div>
            </div>

            {/* <Notifications /> */}
            <UserPoints />
            <ModeToggle />
            <NavbarUserInfo />
          </header>

          <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 xl:px-10">
            {children}
          </main>
        </div>
      </div>
    </MaxWidthWrapper>
  );
}
