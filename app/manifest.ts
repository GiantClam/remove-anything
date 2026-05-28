import { MetadataRoute } from "next";
import { env } from "@/env.mjs";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Remove Anything",
    short_name: "Remove Anything",
    description:
      "AI image eraser for removing objects, backgrounds, and watermarks from photos with clean exports and batch-friendly workflows.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png", 
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
