import type { AbstractIntlMessages } from "next-intl";
import { getMessages } from "next-intl/server";

type IntlMessages = Awaited<ReturnType<typeof getMessages>>;

function pickTopLevelNamespaces(
  messages: IntlMessages,
  namespaces: readonly string[],
): AbstractIntlMessages {
  return namespaces.reduce<AbstractIntlMessages>((acc, namespace) => {
    const value = messages[namespace];

    if (value !== undefined) {
      acc[namespace] = value as AbstractIntlMessages[string];
    }

    return acc;
  }, {} as AbstractIntlMessages);
}

export async function getScopedMessages(
  locale: string,
  namespaces: readonly string[],
) {
  const messages = await getMessages({ locale });
  return pickTopLevelNamespaces(messages, namespaces);
}

export const MARKETING_MESSAGE_NAMESPACES = [
  "Navigation",
  "LocaleSwitcher",
  "NewsLetter",
  "PricingPage",
  "IndexPage",
  "RemoveBackgroundPage",
  "Upload",
  "BatchRemoveBackground",
  "BatchWatermarkRemoval",
  "Playground",
  "Sora2VideoWatermarkRemovalPage",
] as const;

export const APP_MESSAGE_NAMESPACES = [
  "Navigation",
  "LocaleSwitcher",
  "AppNavigation",
  "DashboardHome",
  "History",
  "Orders",
  "Billings",
  "GiftCode",
  "PricingPage",
  "Playground",
  "Upload",
  "BatchRemoveBackground",
  "BatchWatermarkRemoval",
  "Sora2VideoWatermarkRemovalPage",
] as const;

export const ADMIN_MESSAGE_NAMESPACES = [
  "LocaleSwitcher",
] as const;
