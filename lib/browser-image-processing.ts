"use client";

export type BrowserImageOutputFormat = "same" | "jpeg" | "png" | "webp";

export interface BrowserImageProcessResult {
  blob: Blob;
  originalBytes: number;
  outputBytes: number;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
  mimeType: string;
  fileName: string;
}

interface CompressOptions {
  format: Exclude<BrowserImageOutputFormat, "same">;
  quality: number;
}

interface ConvertOptions {
  format: Exclude<BrowserImageOutputFormat, "same">;
  quality: number;
}

interface ResizeOptions {
  format: BrowserImageOutputFormat;
  quality: number;
  maxWidth: number;
  maxHeight: number;
  allowUpscale?: boolean;
}

function clampQuality(quality: number) {
  return Math.min(1, Math.max(0.1, quality));
}

function getMimeType(
  format: BrowserImageOutputFormat,
  originalType: string,
): string {
  if (format === "same") {
    if (
      originalType === "image/jpeg" ||
      originalType === "image/png" ||
      originalType === "image/webp"
    ) {
      return originalType;
    }

    return "image/png";
  }

  switch (format) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
  }

  return "image/png";
}

function getExtension(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
}

function buildFileName(fileName: string, mimeType: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return `${baseName}.${getExtension(mimeType)}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    image.src = url;
  });
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to export image"));
          return;
        }

        resolve(blob);
      },
      mimeType,
      clampQuality(quality),
    );
  });
}

async function renderImage(
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  mimeType: string,
  quality: number,
) {
  const canvas = createCanvas(targetWidth, targetHeight);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available in this browser");
  }

  if (mimeType === "image/jpeg") {
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await canvasToBlob(canvas, mimeType, quality);

  return {
    blob,
    originalWidth: image.width,
    originalHeight: image.height,
    outputWidth: canvas.width,
    outputHeight: canvas.height,
  };
}

export async function compressImageInBrowser(
  file: File,
  options: CompressOptions,
): Promise<BrowserImageProcessResult> {
  const image = await loadImage(file);
  const mimeType = getMimeType(options.format, file.type);
  const rendered = await renderImage(
    image,
    image.width,
    image.height,
    mimeType,
    options.quality,
  );

  return {
    blob: rendered.blob,
    originalBytes: file.size,
    outputBytes: rendered.blob.size,
    originalWidth: rendered.originalWidth,
    originalHeight: rendered.originalHeight,
    outputWidth: rendered.outputWidth,
    outputHeight: rendered.outputHeight,
    mimeType,
    fileName: buildFileName(file.name, mimeType),
  };
}

export async function convertImageInBrowser(
  file: File,
  options: ConvertOptions,
): Promise<BrowserImageProcessResult> {
  const image = await loadImage(file);
  const mimeType = getMimeType(options.format, file.type);
  const rendered = await renderImage(
    image,
    image.width,
    image.height,
    mimeType,
    options.quality,
  );

  return {
    blob: rendered.blob,
    originalBytes: file.size,
    outputBytes: rendered.blob.size,
    originalWidth: rendered.originalWidth,
    originalHeight: rendered.originalHeight,
    outputWidth: rendered.outputWidth,
    outputHeight: rendered.outputHeight,
    mimeType,
    fileName: buildFileName(file.name, mimeType),
  };
}

export async function resizeImageInBrowser(
  file: File,
  options: ResizeOptions,
): Promise<BrowserImageProcessResult> {
  const image = await loadImage(file);
  const maxWidth = Math.max(1, Math.round(options.maxWidth));
  const maxHeight = Math.max(1, Math.round(options.maxHeight));
  const widthRatio = maxWidth / image.width;
  const heightRatio = maxHeight / image.height;
  const scale = Math.min(
    widthRatio,
    heightRatio,
    options.allowUpscale ? Number.POSITIVE_INFINITY : 1,
  );
  const outputWidth = Math.max(1, Math.round(image.width * scale));
  const outputHeight = Math.max(1, Math.round(image.height * scale));
  const mimeType = getMimeType(options.format, file.type);
  const rendered = await renderImage(
    image,
    outputWidth,
    outputHeight,
    mimeType,
    options.quality,
  );

  return {
    blob: rendered.blob,
    originalBytes: file.size,
    outputBytes: rendered.blob.size,
    originalWidth: image.width,
    originalHeight: image.height,
    outputWidth: rendered.outputWidth,
    outputHeight: rendered.outputHeight,
    mimeType,
    fileName: buildFileName(file.name, mimeType),
  };
}
