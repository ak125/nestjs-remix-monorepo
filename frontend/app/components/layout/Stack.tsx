import { cn } from '~/lib/utils';

export type StackDirection = 'vertical' | 'horizontal' | 'responsive';
export type StackGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

export interface StackProps {
	children: React.ReactNode;
	/**
	 * Direction of the stack
	 * - 'vertical': Column layout (default)
	 * - 'horizontal': Row layout
	 * - 'responsive': Column on mobile, row on sm+ breakpoint
	 */
	direction?: StackDirection;
	/** Gap between children */
	gap?: StackGap;
	/** Cross-axis alignment (align-items) */
	align?: StackAlign;
	/** Main-axis distribution (justify-content) */
	justify?: StackJustify;
	/** Allow wrapping for horizontal stacks */
	wrap?: boolean;
	/** HTML element to render */
	as?: 'div' | 'section' | 'article' | 'nav' | 'ul' | 'ol';
	className?: string;
}

const directionClasses: Record<StackDirection, string> = {
	vertical: 'flex-col',
	horizontal: 'flex-row',
	responsive: 'flex-col sm:flex-row',
};

const gapClasses: Record<StackGap, string> = {
	none: 'gap-0',
	xs: 'gap-1', // 4px
	sm: 'gap-2', // 8px
	md: 'gap-4', // 16px
	lg: 'gap-6', // 24px
	xl: 'gap-8', // 32px
	'2xl': 'gap-12', // 48px
};

const alignClasses: Record<StackAlign, string> = {
	start: 'items-start',
	center: 'items-center',
	end: 'items-end',
	stretch: 'items-stretch',
	baseline: 'items-baseline',
};

const justifyClasses: Record<StackJustify, string> = {
	start: 'justify-start',
	center: 'justify-center',
	end: 'justify-end',
	between: 'justify-between',
	around: 'justify-around',
	evenly: 'justify-evenly',
};

/**
 * Stack - Flexbox layout component for consistent spacing
 *
 * @example
 * // Vertical stack (default)
 * <Stack gap="md">
 *   <Card />
 *   <Card />
 * </Stack>
 *
 * @example
 * // Horizontal with alignment
 * <Stack direction="horizontal" align="center" justify="between">
 *   <Logo />
 *   <Navigation />
 * </Stack>
 *
 * @example
 * // Responsive: column on mobile, row on tablet+
 * <Stack direction="responsive" gap="lg">
 *   <ProductImage />
 *   <ProductDetails />
 * </Stack>
 */
export function Stack({
	children,
	direction = 'vertical',
	gap = 'md',
	align = 'stretch',
	justify = 'start',
	wrap = false,
	as: Component = 'div',
	className,
}: StackProps) {
	return (
		<Component
			className={cn(
				'flex',
				directionClasses[direction],
				gapClasses[gap],
				alignClasses[align],
				justifyClasses[justify],
				wrap && 'flex-wrap',
				className
			)}
		>
			{children}
		</Component>
	);
}

/**
 * HStack - Horizontal stack shortcut
 */
export function HStack({
	children,
	gap = 'md',
	align = 'center',
	justify = 'start',
	wrap = false,
	className,
}: Omit<StackProps, 'direction'>) {
	return (
		<Stack
			direction="horizontal"
			gap={gap}
			align={align}
			justify={justify}
			wrap={wrap}
			className={className}
		>
			{children}
		</Stack>
	);
}

/**
 * VStack - Vertical stack shortcut
 */
export function VStack({
	children,
	gap = 'md',
	align = 'stretch',
	justify = 'start',
	className,
}: Omit<StackProps, 'direction' | 'wrap'>) {
	return (
		<Stack
			direction="vertical"
			gap={gap}
			align={align}
			justify={justify}
			className={className}
		>
			{children}
		</Stack>
	);
}
