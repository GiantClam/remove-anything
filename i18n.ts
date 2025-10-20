import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";

import { locales } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !locales.includes(locale as any)) {
    locale = "en"; // fallback to default locale
  }

  return {
    locale,
    messages: (
      await (locale === "en"
        ? // When using Turbopack, this will enable HMR for `en`
          import("./messages/en.json")
        : import(`./messages/${locale}.json`))
    ).default,
  };
});
