import { getRequestConfig } from "next-intl/server";

import { locales } from "@/config";

function deepMerge<T extends Record<string, any>>(base: T, override: Partial<T>): T {
  const result: Record<string, any> = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = (base as any)[key];
    const overVal = (override as any)[key];
    if (
      baseVal &&
      overVal &&
      typeof baseVal === "object" &&
      typeof overVal === "object" &&
      !Array.isArray(baseVal) &&
      !Array.isArray(overVal)
    ) {
      result[key] = deepMerge(baseVal, overVal);
    } else {
      result[key] = overVal;
    }
  }
  return result as T;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !locales.includes(locale as any)) {
    locale = "en";
  }

  const enMessages = (await import("../messages/en.json")).default as Record<string, any>;

  if (locale === "en") {
    return {
      locale,
      messages: enMessages,
    };
  }

  const localeMessages = (await import(`../messages/${locale}.json`)).default as Record<string, any>;
  const merged = deepMerge(enMessages, localeMessages);

  return {
    locale,
    messages: merged,
  };
});
