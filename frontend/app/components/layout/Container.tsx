import { cn } from '~/lib/utils';

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface ContainerProps {
	children: React.ReactNode;
	/** Max width constraint. Default: 'xl' (1280px) */
	size?: ContainerSize;
	/** Add horizontal padding. Default: true */
	padding?: boolean;
	/** Center content horizontally. Default: true */
	centered?: boolean;
	/** HTML element to render. Default: 'div' */
	as?: 'div' | 'section' | 'article' | 'main' | 'aside';
	className?: string;
}

const maxWidthClasses: Record<ContainerSize, string> = {
	sm: 'max-w-screen-sm', // 640px
	md: 'max-w-screen-md', // 768px
	lg: 'max-w-screen-lg', // 1024px
	xl: 'max-w-screen-xl', // 1280px
	'2xl': 'max-w-screen-2xl', // 1536px
	full: 'max-w-full',
};

/**
 * Container - Responsive wrapper with consistent max-width and padding
 *
 * @example
 * // Standard usage
 * <Container>
 *   <h1>Page Title</h1>
 * </Container>
 *
 * @example
 * // Full width section
 * <Container size="full" padding={false}>
 *   <Hero />
 * </Container>
 *
 * @example
 * // Narrow content
 * <Container size="md">
 *   <ArticleContent />
 * </Container>
 */
export function Container({
	children,
	size = 'xl',
	padding = true,
	centered = true,
	as: Component = 'div',
	className,
}: ContainerProps) {
	return (
		<Component
			className={cn(
				'w-full',
				maxWidthClasses[size],
				centered && 'mx-auto',
				// Responsive padding: 16px mobile → 24px tablet → 32px desktop
				padding && 'px-4 sm:px-6 lg:px-8',
				className
			)}
		>
			{children}
		</Component>
	);
}

/**
 * Section - Container variant for page sections with vertical spacing
 */
export function Section({
	children,
	size = 'xl',
	padding = true,
	className,
	...props
}: ContainerProps & { spacing?: 'sm' | 'md' | 'lg' | 'xl' }) {
	return (
		<Container
			as="section"
			size={size}
			padding={padding}
			className={cn(
				// Fluid vertical spacing
				'py-8 sm:py-12 lg:py-16',
				className
			)}
			{...props}
		>
			{children}
		</Container>
	);
}
