import { MarketingConfig } from "types";

export const marketingConfig: MarketingConfig = {
  mainNav: [
    {
      title: "removebg",
      href: "/remove-background",
    },
    {
      title: "removeObjects",
      href: "/remove-objects",
    },
    {
      title: "removeWatermark",
      href: "/remove-watermark",
    },
    {
      title: "pricing",
      href: "/pricing",
    },
    {
      title: "blog",
      href: "/blog",
    },
  ],
};

export const marketingToolGroups = [
  {
    title: "backgroundTools",
    items: [
      { title: "transparentPngMaker", href: "/transparent-png-maker" },
      { title: "whiteBackgroundMaker", href: "/white-background-maker" },
      { title: "changeBackgroundColor", href: "/change-background-color" },
    ],
  },
  {
    title: "batchTools",
    items: [
      { title: "batchImageCompressor", href: "/batch-image-compressor" },
      { title: "batchImageResizer", href: "/batch-image-resizer" },
      { title: "batchImageFormatConverter", href: "/batch-image-format-converter" },
    ],
  },
  {
    title: "formatConverters",
    items: [
      { title: "pngToJpg", href: "/png-to-jpg" },
      { title: "jpgToPng", href: "/jpg-to-png" },
      { title: "webpToPng", href: "/webp-to-png" },
    ],
  },
] as const;
