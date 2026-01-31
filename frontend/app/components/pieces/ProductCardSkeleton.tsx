/**
 * ProductCardSkeleton - Skeleton Loading State for Product Cards
 *
 * @description Prevents CLS (Cumulative Layout Shift) by reserving space
 * while product data is loading. Matches exact dimensions of PieceCard.
 *
 * @performance
 * - Fixed dimensions prevent layout shifts (CLS = 0)
 * - CSS animations only (no JS)
 * - Minimal DOM nodes
 */

import { memo } from "react";

interface ProductCardSkeletonProps {
  /** Number of skeleton cards to render */
  count?: number;
}

/**
 * Single skeleton card matching PieceCard dimensions
 */
const SkeletonCard = memo(function SkeletonCard() {
  return (
    <div className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Image skeleton - matches ProductGallery dimensions */}
      <div className="relative aspect-square bg-gray-100 animate-pulse">
        {/* Badge skeleton (top-left) */}
        <div className="absolute top-3 left-3 h-6 w-16 bg-gray-200 rounded-full" />
        {/* Reliability score skeleton (top-right) */}
        <div className="absolute top-3 right-3 h-8 w-8 bg-gray-200 rounded-full" />
      </div>

      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {/* Brand logo skeleton */}
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Title skeleton */}
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Reference skeleton */}
        <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />

        {/* Price skeleton */}
        <div className="flex items-baseline gap-1 pt-2">
          <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-8 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Stock indicator skeleton */}
        <div className="flex items-center gap-2 pt-1">
          <div className="h-2 w-2 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Button skeleton */}
        <div className="h-10 w-full bg-gray-200 rounded-lg animate-pulse mt-3" />
      </div>
    </div>
  );
});

/**
 * Grid of skeleton cards for loading state
 * Prevents layout shift by matching exact grid structure
 */
export const ProductCardSkeleton = memo(function ProductCardSkeleton({
  count = 6,
}: ProductCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={`skeleton-${index}`} />
      ))}
    </>
  );
});

/**
 * Wrapper component for use in grid layout
 * Includes the grid container structure
 */
export const ProductGridSkeleton = memo(function ProductGridSkeleton({
  count = 12,
}: ProductCardSkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <ProductCardSkeleton count={count} />
    </div>
  );
});

export default ProductCardSkeleton;
