"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Link as I18nLink } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface TaskItem {
  id: string;
  imageUrl?: string | null;
  inputPrompt?: string | null;
}

interface PreviewGalleryProps {
  initialData: TaskItem[];
}

export default function PreviewGallery({ initialData }: PreviewGalleryProps) {
  const [items, setItems] = useState<TaskItem[]>(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);

  // 加载更多图片
  const loadMore = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      // 暂时不加载更多，或者改为加载背景移除/水印移除的示例
      setHasMore(false);
    } catch (error) {
      console.error("Failed to load more images:", error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  // IntersectionObserver 实现滚动分页
  useEffect(() => {
    if (!loadMoreRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading]);

  // 移动端长按预览
  const handleTouchStart = (index: number) => {
    setTouchStartTime(Date.now());
  };

  const handleTouchEnd = (index: number) => {
    if (touchStartTime && Date.now() - touchStartTime > 500) {
      // 长按超过500ms，显示预览
      setHoveredIndex(index);
      setTimeout(() => setHoveredIndex(null), 2000);
    }
    setTouchStartTime(null);
  };

  return (
    <>
      <div
        role="list"
        className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4"
        style={{
          // 使用 aspect-ratio 占位，防止 CLS
          gridAutoRows: "minmax(300px, auto)",
        }}
      >
        {items?.map((item, index) => (
          <div
            className="mt-6 relative group"
            data-id={item.id}
            key={item.id}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onTouchStart={() => handleTouchStart(index)}
            onTouchEnd={() => handleTouchEnd(index)}
          >
            <div className="checkerboard relative flex items-start justify-center rounded-xl overflow-visible">
              <I18nLink
                href={`/face/${item.id}`}
                className={cn(
                  "cursor-pointer block transition-transform duration-300 ease-out",
                  hoveredIndex === index 
                    ? "scale-150 z-50 shadow-2xl relative" 
                    : "scale-100 hover:scale-105"
                )}
              >
                {item.imageUrl && (
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                    <Image
                      className="rounded-lg object-cover w-full h-full transition-transform duration-300"
                      width={400}
                      height={400}
                      alt={`AI background removal example: ${item.inputPrompt || "processed image result"}`}
                      src={item.imageUrl}
                      loading={index < 12 ? "eager" : "lazy"}
                      fetchPriority={index < 12 ? "high" : "low"}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />
                  </div>
                )}
              </I18nLink>
              <div className="tags absolute bottom-0 left-0 flex w-full pointer-events-none">
                <span className="apple-tag rounded-md px-2 py-1 text-white line-clamp-2 overflow-hidden text-ellipsis">
                  {item.inputPrompt}
                </span>
              </div>
              <Link
                className="absolute right-1 top-1 z-10"
                target="_blank"
                href={`https://pinterest.com/pin/create/button/?url=https://pinterest.com/pin/create/button/?description=${encodeURIComponent(
                  `${item.inputPrompt!} Generator by remove-anything.com`
                )}&url=${encodeURIComponent(item.imageUrl!)}`}
              >
                <span className="[&>svg]:h-7 [&>svg]:w-7 [&>svg]:fill-[#e60023]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 496 512"
                  >
                    <path d="M496 256c0 137-111 248-248 248-25.6 0-50.2-3.9-73.4-11.1 10.1-16.5 25.2-43.5 30.8-65 3-11.6 15.4-59 15.4-59 8.1 15.4 31.7 28.5 56.8 28.5 74.8 0 128.7-68.8 128.7-154.3 0-81.9-66.9-143.2-152.9-143.2-107 0-163.9 71.8-163.9 150.1 0 36.4 19.4 81.7 50.3 96.1 4.7 2.2 7.2 1.2 8.3-3.3 .8-3.4 5-20.3 6.9-28.1 .6-2.5 .3-4.7-1.7-7.1-10.1-12.5-18.3-35.3-18.3-56.6 0-54.7 41.4-107.6 112-107.6 60.9 0 103.6 41.5 103.6 100.9 0 67.1-33.9 113.6-78 113.6-24.3 0-42.6-20.1-36.7-44.8 7-29.5 20.5-61.3 20.5-82.6 0-19-10.2-34.9-31.4-34.9-24.9 0-44.9 25.7-44.9 60.2 0 22 7.4 36.8 7.4 36.8s-24.5 103.8-29 123.2c-5 21.4-3 51.6-.9 71.2C65.4 450.9 0 361.1 0 256 0 119 111 8 248 8s248 111 248 248z"></path>
                  </svg>
                </span>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* 加载更多触发器 */}
      {hasMore && (
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
          {loading && (
            <div className="text-muted-foreground">加载中...</div>
          )}
        </div>
      )}
    </>
  );
}

