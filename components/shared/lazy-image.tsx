"use client";

import Image from "next/image";
import { useState, useEffect, useRef, ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface LazyImageProps extends ComponentProps<typeof Image> {
  fallback?: string;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
}

/**
 * LazyImage组件 - 封装懒加载图片
 * - 自动添加 loading="lazy" 和 decoding="async"
 * - 支持 IntersectionObserver 提前加载（rootMargin）
 * - 支持模糊占位符
 */
export default function LazyImage({
  src,
  alt,
  className,
  fallback,
  placeholder = "empty",
  blurDataURL,
  priority = false,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority); // 优先图片立即加载
  const [imgSrc, setImgSrc] = useState<string>(src as string);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // 如果是优先图片，直接加载
    if (priority) {
      setIsInView(true);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // IntersectionObserver 实现懒加载
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "200px", // 提前200px开始加载
        threshold: 0.01,
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [priority]);

  const handleError = () => {
    if (fallback && !hasError) {
      setHasError(true);
      setImgSrc(fallback);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
    >
      {/* 占位符 */}
      {!isLoaded && placeholder === "blur" && blurDataURL && (
        <Image
          src={blurDataURL}
          alt=""
          fill
          className="absolute inset-0 object-cover blur-sm scale-110"
          aria-hidden="true"
          unoptimized
        />
      )}
      {!isLoaded && placeholder === "empty" && (
        <div className="absolute inset-0 bg-muted animate-pulse" aria-hidden="true" />
      )}

      {/* 实际图片 */}
      {isInView && (
        <Image
          src={imgSrc}
          alt={alt || ""}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={handleError}
          className={cn(
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          {...props}
        />
      )}
    </div>
  );
}

