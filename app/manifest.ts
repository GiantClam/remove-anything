import { MetadataRoute } from "next";
import { env } from "@/env.mjs";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Free Background Remover - Remove Background from Image AI",
    short_name: "Background Remover",
    description: "Instantly remove the background from any image with our free AI-powered tool. High-quality, fast, and easy to use.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      {
        src: "/favicon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/favicon-512x512.png", 
        sizes: "512x512",
        type: "image/png",
      },
    ],
    categories: ["photo", "utilities", "productivity"],
    lang: "en",
    scope: "/",
    orientation: "portrait-primary",
  };
}
