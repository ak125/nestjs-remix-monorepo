/**
 * ⏳ SKELETON LOADING COMPONENTS
 * 
 * Composants de chargement avec animations fluides
 * Durée: 1.5s ease-in-out
 */

import { cn } from "../../lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200", className)}
      {...props}
    />
  )
}

/**
 * 📦 ProductCard Skeleton
 */
function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 animate-fade-in">
      {/* Image */}
      <Skeleton className="aspect-square mb-3 rounded-lg" />
      
      {/* Badges */}
      <div className="flex gap-2 mb-3">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      {/* Title */}
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-1" />
      
      {/* Price */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * 🛒 CartItem Skeleton
 */
function CartItemSkeleton() {
  return (
    <div className="flex gap-3 p-4 bg-white rounded-lg border animate-fade-in">
      {/* Image */}
      <Skeleton className="w-20 h-20 rounded-lg flex-shrink-0" />
      
      {/* Content */}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-4 w-3/4" />
        
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-7 w-10" />
            <Skeleton className="h-7 w-7 rounded" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
    </div>
  );
}

/**
 * 🔍 Search Results Skeleton
 */
function SearchResultsSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * 📄 Page Skeleton
 */
function PageSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
        <Skeleton className="h-10 w-20 rounded-lg" />
      </div>

      {/* Content */}
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-44 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * 🎴 Card Skeleton
 */
function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 animate-fade-in space-y-3">
      <Skeleton className="h-6 w-1/3 mb-4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-2 mt-4">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}

export { 
  Skeleton,
  ProductCardSkeleton,
  CartItemSkeleton,
  SearchResultsSkeleton,
  PageSkeleton,
  CardSkeleton,
}