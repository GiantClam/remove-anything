"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Icons } from "@/components/shared/icons";
import { BeforeAfterSlider } from "@/components/ui/before-after-slider";
import type { FrameEditorBox } from "@/lib/remove-objects/runninghub";

type EditorCanvasProps = {
  imageUrl: string;
  resultImageUrl?: string;
  state?: "idle" | "editing" | "detecting" | "ready" | "processing" | "succeeded" | "failed";
  errorMessage?: string;
  mode: "brush" | "erase" | "box";
  brushSize: number;
  importMaskUrl?: string | null;
  importMaskVersion?: number;
  undoSignal?: number;
  redoSignal?: number;
  resetSignal?: number;
  disabled?: boolean;
  onMaskChange: (payload: { hasMask: boolean; blob?: Blob }) => void;
  onBoxSelectionChange?: (bbox: FrameEditorBox | null) => void;
};

const OVERLAY_FILL = "rgba(239, 68, 68, 0.55)";
const BOX_STROKE = "rgba(250, 204, 21, 0.95)";

function toCanvasSafeUrl(src: string) {
  if (!src || src.startsWith("/") || src.startsWith("blob:") || src.startsWith("data:")) {
    return src;
  }

  return `/api/proxy-image?url=${encodeURIComponent(src)}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = src;
  });
}

export function EditorCanvas({
  imageUrl,
  resultImageUrl,
  state = "editing",
  errorMessage,
  mode,
  brushSize,
  importMaskUrl,
  importMaskVersion = 0,
  undoSignal = 0,
  redoSignal = 0,
  resetSignal = 0,
  disabled,
  onMaskChange,
  onBoxSelectionChange,
}: EditorCanvasProps) {
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const committedBoxRef = useRef<FrameEditorBox | null>(null);
  const previewBoxRef = useRef<FrameEditorBox | null>(null);
  const historyRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const lastUndoSignalRef = useRef(undoSignal);
  const lastRedoSignalRef = useRef(redoSignal);
  const lastResetSignalRef = useRef(resetSignal);
  const lastImportVersionRef = useRef(importMaskVersion);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const canvasImageUrl = toCanvasSafeUrl(imageUrl);
  const canvasMaskUrl = importMaskUrl ? toCanvasSafeUrl(importMaskUrl) : null;
  const canvasResultUrl = resultImageUrl ? toCanvasSafeUrl(resultImageUrl) : null;

  const clearSelectionOverlay = useCallback(() => {
    const selectionCanvas = selectionCanvasRef.current;
    const context = selectionCanvas?.getContext("2d");
    if (!selectionCanvas || !context) {
      return;
    }

    context.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
  }, []);

  const drawSelectionOverlay = useCallback(() => {
    const selectionCanvas = selectionCanvasRef.current;
    const context = selectionCanvas?.getContext("2d");
    if (!selectionCanvas || !context) {
      return;
    }

    context.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);

    const drawBox = (bbox: FrameEditorBox, dashed: boolean) => {
      context.save();
      context.strokeStyle = BOX_STROKE;
      context.fillStyle = "rgba(250, 204, 21, 0.12)";
      context.lineWidth = 3;
      if (dashed) {
        context.setLineDash([10, 8]);
      }
      context.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
      context.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
      context.restore();
    };

    if (committedBoxRef.current) {
      drawBox(committedBoxRef.current, false);
    }

    if (previewBoxRef.current) {
      drawBox(previewBoxRef.current, true);
    }
  }, []);

  const exportMask = useCallback(async () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) {
      onMaskChange({ hasMask: false });
      return;
    }

    const context = maskCanvas.getContext("2d");
    if (!context) {
      onMaskChange({ hasMask: false });
      return;
    }

    const imageData = context.getImageData(
      0,
      0,
      maskCanvas.width,
      maskCanvas.height,
    );
    let hasMask = false;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 0) {
        hasMask = true;
        break;
      }
    }

    if (!hasMask) {
      onMaskChange({ hasMask: false });
      return;
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = maskCanvas.width;
    exportCanvas.height = maskCanvas.height;
    const exportContext = exportCanvas.getContext("2d");
    if (!exportContext) {
      onMaskChange({ hasMask: true });
      return;
    }

    const exportImage = exportContext.createImageData(
      exportCanvas.width,
      exportCanvas.height,
    );

    for (let i = 0; i < imageData.data.length; i += 4) {
      const alpha = imageData.data[i + 3];
      const value = alpha > 0 ? 255 : 0;
      exportImage.data[i] = value;
      exportImage.data[i + 1] = value;
      exportImage.data[i + 2] = value;
      exportImage.data[i + 3] = 255;
    }

    exportContext.putImageData(exportImage, 0, 0);

    exportCanvas.toBlob((blob) => {
      onMaskChange({ hasMask: true, blob: blob || undefined });
    }, "image/png");
  }, [onMaskChange]);

  function getMaskContext() {
    return maskCanvasRef.current?.getContext("2d") || null;
  }

  function normalizeBox(
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): FrameEditorBox {
    const x = Math.min(from.x, to.x);
    const y = Math.min(from.y, to.y);
    return {
      x,
      y,
      w: Math.abs(to.x - from.x),
      h: Math.abs(to.y - from.y),
    };
  }

  function saveSnapshot() {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) {
      return;
    }

    historyRef.current.push(maskCanvas.toDataURL("image/png"));
    if (historyRef.current.length > 25) {
      historyRef.current.shift();
    }
    redoRef.current = [];
  }

  const restoreSnapshot = useCallback(async (dataUrl: string | undefined) => {
    const maskCanvas = maskCanvasRef.current;
    const context = getMaskContext();
    if (!maskCanvas || !context) {
      return;
    }

    context.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    if (!dataUrl) {
      await exportMask();
      return;
    }

    const image = await loadImage(dataUrl);
    context.drawImage(image, 0, 0, maskCanvas.width, maskCanvas.height);
    await exportMask();
  }, [exportMask]);

  function getCanvasPoint(event: { clientX: number; clientY: number }) {
    const canvas = maskCanvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function drawSegment(
    context: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) {
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = brushSize;

    if (mode === "erase") {
      context.globalCompositeOperation = "destination-out";
      context.strokeStyle = "rgba(0,0,0,1)";
    } else {
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = OVERLAY_FILL;
    }

    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.restore();
  }

  useEffect(() => {
    let cancelled = false;

    async function paintBaseImage() {
      const imageCanvas = imageCanvasRef.current;
      const selectionCanvas = selectionCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const imageContext = imageCanvas?.getContext("2d");
      const maskContext = maskCanvas?.getContext("2d");

      if (
        !imageCanvas ||
        !selectionCanvas ||
        !maskCanvas ||
        !imageContext ||
        !maskContext
      ) {
        return;
      }

      const image = await loadImage(canvasImageUrl);
      if (cancelled) {
        return;
      }

      imageCanvas.width = image.width;
      imageCanvas.height = image.height;
      selectionCanvas.width = image.width;
      selectionCanvas.height = image.height;
      maskCanvas.width = image.width;
      maskCanvas.height = image.height;

      setDimensions({ width: image.width, height: image.height });
      imageContext.clearRect(0, 0, image.width, image.height);
      imageContext.drawImage(image, 0, 0, image.width, image.height);
      clearSelectionOverlay();
      maskContext.clearRect(0, 0, image.width, image.height);
      committedBoxRef.current = null;
      previewBoxRef.current = null;
      dragStartRef.current = null;
      onBoxSelectionChange?.(null);
      historyRef.current = [];
      redoRef.current = [];
      saveSnapshot();
      await exportMask();
    }

    paintBaseImage().catch(() => {
      onMaskChange({ hasMask: false });
    });

    return () => {
      cancelled = true;
    };
  }, [canvasImageUrl, clearSelectionOverlay, exportMask, onBoxSelectionChange, onMaskChange]);

  useEffect(() => {
    if (!canvasMaskUrl || lastImportVersionRef.current === importMaskVersion) {
      return;
    }

    lastImportVersionRef.current = importMaskVersion;
    const context = getMaskContext();
    const maskCanvas = maskCanvasRef.current;
    if (!context || !maskCanvas) {
      return;
    }

    loadImage(canvasMaskUrl)
      .then((image) => {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = maskCanvas.width;
        tempCanvas.height = maskCanvas.height;
        const tempContext = tempCanvas.getContext("2d");
        if (!tempContext) {
          return;
        }

        tempContext.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = tempContext.getImageData(
          0,
          0,
          tempCanvas.width,
          tempCanvas.height,
        );

        for (let i = 0; i < pixels.data.length; i += 4) {
          const alpha = pixels.data[i + 3];
          const brightness =
            (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3;
          const shouldKeep = alpha > 24 && brightness > 120;

          pixels.data[i] = 239;
          pixels.data[i + 1] = 68;
          pixels.data[i + 2] = 68;
          pixels.data[i + 3] = shouldKeep ? 160 : 0;
        }

        tempContext.putImageData(pixels, 0, 0);
        context.drawImage(tempCanvas, 0, 0);
        saveSnapshot();
        exportMask();
      })
      .catch(() => {
        onMaskChange({ hasMask: false });
      });
  }, [canvasMaskUrl, exportMask, importMaskVersion, onMaskChange]);

  useEffect(() => {
    if (undoSignal === lastUndoSignalRef.current) {
      return;
    }

    lastUndoSignalRef.current = undoSignal;
    if (historyRef.current.length <= 1) {
      return;
    }

    const current = historyRef.current.pop();
    if (current) {
      redoRef.current.unshift(current);
    }

    void restoreSnapshot(historyRef.current.at(-1));
  }, [restoreSnapshot, undoSignal]);

  useEffect(() => {
    if (redoSignal === lastRedoSignalRef.current) {
      return;
    }

    lastRedoSignalRef.current = redoSignal;
    const next = redoRef.current.shift();
    if (!next) {
      return;
    }

    historyRef.current.push(next);
    void restoreSnapshot(next);
  }, [redoSignal, restoreSnapshot]);

  useEffect(() => {
    if (resetSignal === lastResetSignalRef.current) {
      return;
    }

    lastResetSignalRef.current = resetSignal;
    const maskCanvas = maskCanvasRef.current;
    const context = getMaskContext();
    if (!maskCanvas || !context) {
      return;
    }

    context.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    committedBoxRef.current = null;
    previewBoxRef.current = null;
    dragStartRef.current = null;
    clearSelectionOverlay();
    onBoxSelectionChange?.(null);
    historyRef.current = [];
    redoRef.current = [];
    saveSnapshot();
    void exportMask();
  }, [clearSelectionOverlay, exportMask, onBoxSelectionChange, resetSignal]);

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) {
      return;
    }

    const context = getMaskContext();
    const point = getCanvasPoint(event);
    if (!context || !point) {
      return;
    }

    if (mode === "box") {
      isDrawingRef.current = true;
      dragStartRef.current = point;
      previewBoxRef.current = null;
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    isDrawingRef.current = true;
    lastPointRef.current = point;
    drawSegment(context, point, point);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || disabled) {
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    if (mode === "box") {
      const start = dragStartRef.current;
      if (!start) {
        return;
      }

      previewBoxRef.current = normalizeBox(start, point);
      drawSelectionOverlay();
      return;
    }

    const context = getMaskContext();
    const previous = lastPointRef.current;
    if (!context || !previous) {
      return;
    }

    drawSegment(context, previous, point);
    lastPointRef.current = point;
  }

  function finishDrawing(event?: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) {
      return;
    }

    isDrawingRef.current = false;
    if (event) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (mode === "box") {
      const endPoint = event ? getCanvasPoint(event) : null;
      const startPoint = dragStartRef.current;
      dragStartRef.current = null;

      if (!startPoint || !endPoint) {
        previewBoxRef.current = null;
        drawSelectionOverlay();
        return;
      }

      const bbox = normalizeBox(startPoint, endPoint);
      previewBoxRef.current = null;

      if (bbox.w < 4 || bbox.h < 4) {
        committedBoxRef.current = null;
        clearSelectionOverlay();
        onBoxSelectionChange?.(null);
        return;
      }

      committedBoxRef.current = bbox;
      drawSelectionOverlay();
      onBoxSelectionChange?.(bbox);
      return;
    }

    lastPointRef.current = null;
    saveSnapshot();
    void exportMask();
  }

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Remove Object</h2>
        </div>
        {dimensions.width > 0 ? (
          <p className="text-xs text-muted-foreground">
            {dimensions.width} × {dimensions.height}
          </p>
        ) : null}
      </div>

      <div className="relative mx-auto h-[420px] w-full max-w-[420px] overflow-hidden rounded-xl border bg-muted/20">
        {canvasResultUrl && state === "succeeded" ? (
          <div className="flex size-full items-center justify-center">
            <BeforeAfterSlider
              beforeSrc={canvasImageUrl}
              afterSrc={canvasResultUrl}
              beforeLabel="Original"
              afterLabel="After"
              showLabels
              className="size-full"
            />
          </div>
        ) : (
          <>
            <canvas
              ref={imageCanvasRef}
              className="block size-full object-contain"
              aria-label="Source image"
            />
            <canvas
              ref={selectionCanvasRef}
              className="pointer-events-none absolute inset-0 size-full"
              aria-hidden="true"
            />
            <canvas
              ref={maskCanvasRef}
              className="absolute inset-0 size-full touch-none"
              aria-label="Editable mask"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrawing}
              onPointerLeave={() => {
                if (mode !== "box") {
                  finishDrawing();
                }
              }}
              onPointerCancel={() => finishDrawing()}
            />
          </>
        )}

        {state === "detecting" || state === "processing" ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
            <div className="w-[min(92%,420px)] rounded-2xl border bg-card/95 p-5 text-center shadow-sm">
              <div className="mb-3 flex justify-center">
                <Icons.spinner className="size-8 animate-spin text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {state === "detecting" ? "正在生成遮罩" : "正在移除物體"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {state === "detecting"
                  ? "SAM3.1 正在精修你的選區，接著會自動進入移除流程。"
                  : "Usually around 40 seconds, sometimes a bit longer."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {state === "detecting"
                  ? "不需要手動確認 mask。"
                  : "我們正在直接生成最終去除物體的圖片。"}
              </p>
            </div>
          </div>
        ) : null}

        {state === "failed" && errorMessage ? (
          <div className="absolute inset-x-3 top-3 z-10 rounded-xl border border-destructive/30 bg-background/95 px-3 py-2 shadow-sm">
            <p className="text-xs font-medium text-destructive">{errorMessage}</p>
          </div>
        ) : null}

        {state === "succeeded" ? (
          <div className="absolute left-3 top-3 z-10 rounded-full border border-primary/30 bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
            已生成最終圖片
          </div>
        ) : null}
      </div>

    </div>
  );
}
