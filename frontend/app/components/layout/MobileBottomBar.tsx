/**
 * MobileBottomBar - Sticky bottom bar for mobile CTAs
 *
 * Pattern: Fixed bottom bar visible only on mobile (md:hidden)
 * Used on Cart, Checkout, PLP for key actions in thumb zone.
 *
 * Features:
 * - Safe area padding (iPhone notch/home indicator)
 * - High z-index (above content, below modals)
 * - Slot-based content for flexibility
 *
 * @example
 * // Cart page
 * <MobileBottomBar>
 *   <Button className="flex-1">Commander (3 articles)</Button>
 * </MobileBottomBar>
 *
 * @example
 * // PLP with filter trigger
 * <MobileBottomBar>
 *   <FilterTrigger onClick={openFilters} activeCount={2} />
 *   <SortSelect value={sort} onChange={setSort} />
 * </MobileBottomBar>
 */

import { memo } from "react";
import { cn } from "~/lib/utils";

export interface MobileBottomBarProps {
  children: React.ReactNode;
  /** Additional classes */
  className?: string;
  /** Show border top. Default: true */
  border?: boolean;
  /** Background style. Default: 'solid' */
  variant?: "solid" | "blur";
}

export const MobileBottomBar = memo(function MobileBottomBar({
  children,
  className,
  border = true,
  variant = "solid",
}: MobileBottomBarProps) {
  return (
    <div
      className={cn(
        // Base: fixed bottom, full width, only on mobile
        "fixed bottom-0 left-0 right-0 z-40",
        "md:hidden",
        // Padding with safe area
        "px-4 py-3 pb-safe",
        // Background
        variant === "solid" && "bg-white",
        variant === "blur" && "bg-white/95 backdrop-blur-sm",
        // Border
        border && "border-t border-gray-200",
        // Shadow for elevation
        "shadow-[0_-2px_10px_rgba(0,0,0,0.1)]",
        className,
      )}
      role="toolbar"
      aria-label="Actions"
    >
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
});

/**
 * MobileBottomBarSpacer - Adds padding to prevent content from being hidden
 *
 * Add this at the bottom of your page content when using MobileBottomBar
 * to ensure the last content isn't hidden behind the fixed bar.
 */
export const MobileBottomBarSpacer = memo(function MobileBottomBarSpacer({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-20 md:hidden", // ~80px to account for bar + safe area
        className,
      )}
      aria-hidden="true"
    />
  );
});
