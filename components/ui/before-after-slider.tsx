"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  className?: string;
  beforeLabel?: string;
  afterLabel?: string;
  alt?: string;
  allowZoom?: boolean;
  showLabels?: boolean;
}

/**
 * Lightweight before/after comparison slider.
 * Uses an input range to mask the before image and reveal the after result.
 */
export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  className,
  beforeLabel = "Before",
  afterLabel = "After",
  alt = "Comparison preview",
  allowZoom = false,
  showLabels = true,
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);

  // Refs for high-frequency updates without React re-render
  const beforeImgRef = useRef<HTMLImageElement | null>(null);
  const dividerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const posRef = useRef<number>(50);

  const applyVisuals = useCallback((pos: number) => {
    const beforeEl = beforeImgRef.current;
    const dividerEl = dividerRef.current;
    if (beforeEl) beforeEl.style.clipPath = `inset(0 ${100 - pos}% 0 0)`;
    if (dividerEl) dividerEl.style.transform = `translateX(${pos}%)`;
  }, []);

  useEffect(() => {
    // initial paint
    applyVisuals(posRef.current);
  }, [applyVisuals]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(event.target.value);
      posRef.current = next;
      // schedule visual update in RAF to avoid main-thread thrash
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => applyVisuals(next));
      // keep state in sync for labels/aria (not used for visual updates)
      setPosition(next);
    },
    [applyVisuals],
  );

  // Attach wheel listener with passive:false to allow preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!allowZoom) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => {
      el.removeEventListener("wheel", handler as EventListener);
    };
  }, [allowZoom]);

  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full select-none touch-none overscroll-none", className)}
    >
      <div className="relative overflow-hidden rounded-xl bg-muted">
        <img
          src={afterSrc}
          alt={alt}
          className="h-full w-full object-contain max-h-[500px] max-w-[500px]"
          draggable={false}
          decoding="async"
          loading="eager"
        />
        <img
          ref={beforeImgRef}
          src={beforeSrc}
          alt={alt}
          className="absolute inset-0 h-full w-full object-contain max-h-[500px] max-w-[500px]"
          style={{ willChange: "clip-path" }}
          draggable={false}
          decoding="async"
          loading="eager"
        />
        <div
          ref={dividerRef}
          className="pointer-events-none absolute inset-y-0 flex items-center transform-gpu"
          style={{ willChange: "transform", transform: `translateX(${position}%)` }}
        >
          <div className="relative h-full w-px bg-white/70">
            <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 shadow-md">
              <span className="text-xs font-medium text-foreground">↔</span>
            </div>
          </div>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={handleChange}
        className="absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
        aria-label="Adjust comparison"
      />

      {showLabels && (
        <div className="mt-3 flex justify-between text-xs font-semibold text-muted-foreground">
          <span>{beforeLabel}</span>
          <span>{afterLabel}</span>
        </div>
      )}
    </div>
  );
}
