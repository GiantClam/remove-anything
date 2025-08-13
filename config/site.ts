import { SidebarNavItem, SiteConfig } from "types";
import { env } from "@/env.mjs";

const site_url = env.NEXT_PUBLIC_SITE_URL;

export const siteConfig: SiteConfig = {
  name: "Free Background Remover",
  description:
    "Instantly remove the background from any image with our free AI-powered tool. High-quality, fast, and easy to use. Upload your photo and get a transparent background in seconds.",
  url: site_url,
  ogImage: `${site_url}/og.png`,
  links: {
    twitter: "https://x.com/koyaguo",
    github: "https://github.com/virgoone",
  },
  mailSupport: "support@remove-anything.com",
};
