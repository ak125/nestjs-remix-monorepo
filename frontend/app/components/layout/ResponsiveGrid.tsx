import { cn } from '~/lib/utils';

export type GridGap = 'none' | 'sm' | 'md' | 'lg';

export interface ResponsiveGridProps {
	children: React.ReactNode;
	/**
	 * Number of columns at each breakpoint
	 * Default: { base: 1, sm: 2, lg: 3, xl: 4 } - E-commerce product grid
	 */
	cols?: {
		base?: 1 | 2 | 3 | 4 | 5 | 6;
		sm?: 1 | 2 | 3 | 4 | 5 | 6;
		md?: 1 | 2 | 3 | 4 | 5 | 6;
		lg?: 1 | 2 | 3 | 4 | 5 | 6;
		xl?: 1 | 2 | 3 | 4 | 5 | 6;
	};
	/** Gap size between items. Default: 'md' */
	gap?: GridGap;
	className?: string;
}

// Gap classes with responsive scaling
const gapClasses: Record<GridGap, string> = {
	none: 'gap-0',
	sm: 'gap-2 sm:gap-3', // 8px → 12px
	md: 'gap-3 sm:gap-4 lg:gap-6', // 12px → 16px → 24px
	lg: 'gap-4 sm:gap-6 lg:gap-8', // 16px → 24px → 32px
};

// Column classes mapping
const colClassMap = {
	1: 'grid-cols-1',
	2: 'grid-cols-2',
	3: 'grid-cols-3',
	4: 'grid-cols-4',
	5: 'grid-cols-5',
	6: 'grid-cols-6',
};

const smColClassMap = {
	1: 'sm:grid-cols-1',
	2: 'sm:grid-cols-2',
	3: 'sm:grid-cols-3',
	4: 'sm:grid-cols-4',
	5: 'sm:grid-cols-5',
	6: 'sm:grid-cols-6',
};

const mdColClassMap = {
	1: 'md:grid-cols-1',
	2: 'md:grid-cols-2',
	3: 'md:grid-cols-3',
	4: 'md:grid-cols-4',
	5: 'md:grid-cols-5',
	6: 'md:grid-cols-6',
};

const lgColClassMap = {
	1: 'lg:grid-cols-1',
	2: 'lg:grid-cols-2',
	3: 'lg:grid-cols-3',
	4: 'lg:grid-cols-4',
	5: 'lg:grid-cols-5',
	6: 'lg:grid-cols-6',
};

const xlColClassMap = {
	1: 'xl:grid-cols-1',
	2: 'xl:grid-cols-2',
	3: 'xl:grid-cols-3',
	4: 'xl:grid-cols-4',
	5: 'xl:grid-cols-5',
	6: 'xl:grid-cols-6',
};

/**
 * ResponsiveGrid - CSS Grid with responsive column configuration
 *
 * Optimized for e-commerce product listings with sensible defaults.
 *
 * @example
 * // Default product grid (1 → 2 → 3 → 4 columns)
 * <ResponsiveGrid>
 *   {products.map(p => <ProductCard key={p.id} product={p} />)}
 * </ResponsiveGrid>
 *
 * @example
 * // Custom configuration
 * <ResponsiveGrid cols={{ base: 2, md: 3, xl: 5 }} gap="lg">
 *   {items.map(item => <ItemCard key={item.id} item={item} />)}
 * </ResponsiveGrid>
 *
 * @example
 * // Two-column layout
 * <ResponsiveGrid cols={{ base: 1, md: 2 }} gap="lg">
 *   <MainContent />
 *   <Sidebar />
 * </ResponsiveGrid>
 */
export function ResponsiveGrid({
	children,
	cols = { base: 1, sm: 2, lg: 3, xl: 4 },
	gap = 'md',
	className,
}: ResponsiveGridProps) {
	const colClasses = [
		cols.base && colClassMap[cols.base],
		cols.sm && smColClassMap[cols.sm],
		cols.md && mdColClassMap[cols.md],
		cols.lg && lgColClassMap[cols.lg],
		cols.xl && xlColClassMap[cols.xl],
	]
		.filter(Boolean)
		.join(' ');

	return (
		<div className={cn('grid', colClasses, gapClasses[gap], className)}>
			{children}
		</div>
	);
}

/**
 * ProductGrid - Pre-configured grid for product listings
 * 1 col mobile → 2 col tablet → 3 col laptop → 4 col desktop
 */
export function ProductGrid({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<ResponsiveGrid
			cols={{ base: 1, sm: 2, lg: 3, xl: 4 }}
			gap="md"
			className={className}
		>
			{children}
		</ResponsiveGrid>
	);
}

/**
 * TwoColumnLayout - Common two-column responsive layout
 * Stacked on mobile, side-by-side on tablet+
 */
export function TwoColumnLayout({
	children,
	className,
	reversed = false,
}: {
	children: React.ReactNode;
	className?: string;
	/** Reverse order on desktop (sidebar first) */
	reversed?: boolean;
}) {
	return (
		<ResponsiveGrid
			cols={{ base: 1, md: 2 }}
			gap="lg"
			className={cn(reversed && 'md:[&>*:first-child]:order-2', className)}
		>
			{children}
		</ResponsiveGrid>
	);
}
