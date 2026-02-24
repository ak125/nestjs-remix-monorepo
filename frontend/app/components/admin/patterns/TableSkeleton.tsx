/**
 * TableSkeleton - Skeleton loading pour tables admin
 *
 * Affiche N rows x N cols de barres animate-pulse.
 * Utilise directement Skeleton de shadcn/ui.
 */

import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

interface TableSkeletonProps {
  /** Number of columns */
  columns: number;
  /** Number of rows (default 5) */
  rows?: number;
  /** Show checkbox column */
  showCheckbox?: boolean;
  /** CSS class */
  className?: string;
}

export function TableSkeleton({
  columns,
  rows = 5,
  showCheckbox = false,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn("w-full space-y-2 p-4", className)}>
      {/* Header skeleton */}
      <div className="flex gap-4 pb-2 border-b">
        {showCheckbox && <Skeleton className="h-4 w-4 rounded" />}
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={`h-${i}`}
            className="h-4 flex-1 rounded"
            style={{ maxWidth: i === 0 ? "180px" : "120px" }}
          />
        ))}
      </div>

      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={`r-${rowIdx}`} className="flex items-center gap-4 py-2">
          {showCheckbox && <Skeleton className="h-4 w-4 rounded" />}
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton
              key={`c-${rowIdx}-${colIdx}`}
              className={cn(
                "h-4 rounded flex-1",
                colIdx === 0 && "max-w-[180px]",
                colIdx > 0 && "max-w-[120px]",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
