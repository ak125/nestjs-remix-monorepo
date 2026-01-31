/**
 * LazyImage - Lazy Loading Image Component
 *
 * @description Optimizes LCP by deferring off-screen image loading.
 * Uses native loading="lazy" + Intersection Observer for reliable behavior.
 *
 * @performance
 * - Native lazy loading for supported browsers
 * - Intersection Observer fallback
 * - Blur placeholder to prevent CLS
 * - Responsive srcset support
 *
 * @example
 * <LazyImage
 *   src="/products/brake-pad.jpg"
 *   alt="Plaquettes de frein"
 *   width={300}
 *   height={300}
 *   priority={isAboveFold}
 * />
 */

import { useState, useEffect, useRef, memo } from "react";
import { cn } from "~/lib/utils";

interface LazyImageProps {
  /** Image source URL */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Optional width (for aspect ratio) */
  width?: number;
  /** Optional height (for aspect ratio) */
  height?: number;
  /** Additional CSS classes */
  className?: string;
  /** Priority loading (skip lazy for above-fold images) */
  priority?: boolean;
  /** Placeholder background color */
  placeholderColor?: string;
  /** onLoad callback */
  onLoad?: () => void;
  /** onError callback */
  onError?: () => void;
  /** Object-fit style */
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
  /** Srcset for responsive images */
  srcSet?: string;
  /** Sizes attribute for responsive images */
  sizes?: string;
}

export const LazyImage = memo(function LazyImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  placeholderColor = "#f3f4f6",
  onLoad,
  onError,
  objectFit = "contain",
  srcSet,
  sizes,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isInView) return;

    const img = imgRef.current;
    if (!img) return;

    // Check if native lazy loading is supported
    if ("loading" in HTMLImageElement.prototype) {
      // Native lazy loading - let browser handle it
      setIsInView(true);
      return;
    }

    // Fallback to Intersection Observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "200px", // Start loading 200px before entering viewport
        threshold: 0,
      },
    );

    observer.observe(img);

    return () => observer.disconnect();
  }, [priority, isInView]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Calculate aspect ratio padding if dimensions provided
  const aspectRatio = width && height ? height / width : undefined;

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        backgroundColor: placeholderColor,
        paddingBottom: aspectRatio ? `${aspectRatio * 100}%` : undefined,
      }}
    >
      {/* Placeholder shimmer effect */}
      {!isLoaded && !hasError && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ backgroundColor: placeholderColor }}
        >
          {/* Shimmer gradient */}
          <div
            className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
            }}
          />
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <svg
            className="w-12 h-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}

      {/* Actual image */}
      {(isInView || priority) && !hasError && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          width={width}
          height={height}
          srcSet={srcSet}
          sizes={sizes}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "transition-opacity duration-300",
            aspectRatio ? "absolute inset-0 w-full h-full" : "",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
          style={{ objectFit }}
        />
      )}
    </div>
  );
});

/**
 * Generates srcset for imgproxy-powered responsive images
 */
export function generateImgproxySrcSet(
  baseUrl: string,
  widths: number[] = [320, 640, 960, 1280],
): string {
  // If already an imgproxy URL, modify the width parameter
  // Otherwise, return the base URL as-is
  if (!baseUrl.includes("/rs:fit:")) {
    return baseUrl;
  }

  return widths
    .map((w) => {
      const modifiedUrl = baseUrl.replace(
        /\/rs:fit:\d+:\d+:/,
        `/rs:fit:${w}:${w}:`,
      );
      return `${modifiedUrl} ${w}w`;
    })
    .join(", ");
}

// CSS for shimmer animation (add to tailwind config or global styles)
// @keyframes shimmer {
//   100% { transform: translateX(100%); }
// }

export default LazyImage;
