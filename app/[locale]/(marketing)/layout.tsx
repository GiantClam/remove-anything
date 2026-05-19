import { unstable_setRequestLocale } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";

import { NavMobile } from "@/components/layout/mobile-nav";
import { NavBar } from "@/components/layout/navbar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteInteractiveProviders } from "@/components/providers/site-interactive-providers";
import {
  getScopedMessages,
  MARKETING_MESSAGE_NAMESPACES,
} from "@/lib/i18n/scoped-messages";
// import Promotion from "@/components/sections/promotion";

interface MarketingLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export default async function MarketingLayout({
  children,
  params,
}: MarketingLayoutProps) {
  unstable_setRequestLocale(params.locale);
  const messages = await getScopedMessages(
    params.locale,
    MARKETING_MESSAGE_NAMESPACES,
  );

  return (
    <NextIntlClientProvider messages={messages}>
      <SiteInteractiveProviders>
        <div className="flex min-h-screen flex-col">
          <NavMobile />
          <NavBar scroll={true} />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          {/* <Promotion locale={params.locale} /> */}
        </div>
      </SiteInteractiveProviders>
    </NextIntlClientProvider>
  );
}
