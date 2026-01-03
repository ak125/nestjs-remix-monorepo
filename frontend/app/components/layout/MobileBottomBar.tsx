import { cn } from '~/lib/utils';

export interface MobileBottomBarProps {
	children: React.ReactNode;
	/**
	 * Show on tablet too (up to lg breakpoint)
	 * Default: false (hidden at md+)
	 */
	showOnTablet?: boolean;
	/**
	 * Add shadow above the bar
	 * Default: true
	 */
	shadow?: boolean;
	/**
	 * Background style
	 * Default: 'solid'
	 */
	background?: 'solid' | 'blur' | 'transparent';
	className?: string;
}

const backgroundClasses = {
	solid: 'bg-white dark:bg-gray-900',
	blur: 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg',
	transparent: 'bg-transparent',
};

/**
 * MobileBottomBar - Sticky bottom action bar for mobile
 *
 * Critical e-commerce pattern: CTA always visible for +15-25% conversion.
 * Automatically handles iPhone safe area (notch/Dynamic Island).
 *
 * @example
 * // Product page - Add to cart button
 * <MobileBottomBar>
 *   <Button className="w-full touch-target-lg">
 *     Ajouter au panier - 49,99 €
 *   </Button>
 * </MobileBottomBar>
 *
 * @example
 * // Cart page - Checkout with price
 * <MobileBottomBar>
 *   <div className="flex items-center justify-between gap-4">
 *     <div>
 *       <div className="text-sm text-gray-500">Total</div>
 *       <div className="text-lg font-bold">149,99 €</div>
 *     </div>
 *     <Button className="flex-1 touch-target-lg">
 *       Commander
 *     </Button>
 *   </div>
 * </MobileBottomBar>
 *
 * @example
 * // With blur effect
 * <MobileBottomBar background="blur" shadow={false}>
 *   <FilterButtons />
 * </MobileBottomBar>
 */
export function MobileBottomBar({
	children,
	showOnTablet = false,
	shadow = true,
	background = 'solid',
	className,
}: MobileBottomBarProps) {
	return (
		<div
			className={cn(
				// Positioning
				'fixed bottom-0 left-0 right-0 z-50',
				// Border
				'border-t border-gray-200 dark:border-gray-800',
				// Background
				backgroundClasses[background],
				// Shadow
				shadow && 'shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]',
				// Padding with safe area for iPhone
				'p-4 pb-safe',
				// Responsive visibility
				showOnTablet ? 'lg:hidden' : 'md:hidden',
				className
			)}
		>
			{children}
		</div>
	);
}

/**
 * MobileBottomBarSpacer - Adds padding at the bottom of the page
 * to prevent content from being hidden behind the MobileBottomBar
 *
 * @example
 * <main>
 *   <ProductContent />
 *   <MobileBottomBarSpacer />
 * </main>
 * <MobileBottomBar>
 *   <CTAButton />
 * </MobileBottomBar>
 */
export function MobileBottomBarSpacer({
	showOnTablet = false,
	className,
}: {
	showOnTablet?: boolean;
	className?: string;
}) {
	return (
		<div
			className={cn(
				// Height to match MobileBottomBar (padding + button height + safe area)
				'h-20 pb-safe',
				// Match visibility with MobileBottomBar
				showOnTablet ? 'lg:hidden' : 'md:hidden',
				className
			)}
			aria-hidden="true"
		/>
	);
}
