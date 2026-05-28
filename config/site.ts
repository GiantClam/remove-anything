import { SidebarNavItem, SiteConfig } from "types";
import { env } from "@/env.mjs";

const site_url = env.NEXT_PUBLIC_SITE_URL;

export const siteConfig: SiteConfig = {
  name: "Remove Anything",
  description:
    "Remove unwanted objects, backgrounds, and watermarks from images with AI-powered editing tools built for fast cleanup and export.",
  url: site_url,
  ogImage: `${site_url}/og.png`,
  links: {
    twitter: "https://www.remove-anything.com",
    github: "https://www.remove-anything.com",
  },
  mailSupport: "support@remove-anything.com",
};
