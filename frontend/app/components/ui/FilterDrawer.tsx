import { Filter, X } from 'lucide-react';
import { useIsMobile } from '~/hooks/useMediaQuery';
import { cn } from '~/lib/utils';
import { Button } from './button';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetClose,
} from './sheet';

export interface FilterDrawerProps {
	children: React.ReactNode;
	/** Controlled open state */
	isOpen: boolean;
	/** Callback when open state changes */
	onOpenChange: (open: boolean) => void;
	/** Title shown in the header. Default: 'Filtres' */
	title?: string;
	/** Show active filter count badge */
	activeCount?: number;
	/** Footer content (e.g., Apply/Reset buttons) */
	footer?: React.ReactNode;
	/** Desktop sidebar width. Default: 'w-64' */
	sidebarWidth?: string;
	className?: string;
}

/**
 * FilterDrawer - Responsive filter panel
 *
 * Pattern: Sidebar on desktop → Bottom sheet on mobile
 * Bottom sheet is the optimal mobile pattern for filters (thumb zone).
 *
 * @example
 * // Basic usage
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <FilterDrawer isOpen={isOpen} onOpenChange={setIsOpen}>
 *   <FilterSection title="Marque">
 *     <Checkbox label="Valeo" />
 *     <Checkbox label="Bosch" />
 *   </FilterSection>
 * </FilterDrawer>
 *
 * @example
 * // With footer actions
 * <FilterDrawer
 *   isOpen={isOpen}
 *   onOpenChange={setIsOpen}
 *   activeCount={3}
 *   footer={
 *     <div className="flex gap-2">
 *       <Button variant="outline" onClick={handleReset}>Réinitialiser</Button>
 *       <Button onClick={handleApply}>Appliquer</Button>
 *     </div>
 *   }
 * >
 *   {filterContent}
 * </FilterDrawer>
 */
export function FilterDrawer({
	children,
	isOpen,
	onOpenChange,
	title = 'Filtres',
	activeCount,
	footer,
	sidebarWidth = 'w-64',
	className,
}: FilterDrawerProps) {
	const isMobile = useIsMobile();

	// Mobile: Bottom sheet
	if (isMobile) {
		return (
			<Sheet open={isOpen} onOpenChange={onOpenChange}>
				<SheetContent
					side="bottom"
					className={cn(
						// Height with max to prevent full screen
						'h-[85vh] max-h-[85vh]',
						// Rounded top corners for modern look
						'rounded-t-xl',
						// Safe area padding for iPhone
						'pb-safe',
						// Remove default padding, we'll add our own
						'p-0',
						className
					)}
				>
					{/* Header */}
					<SheetHeader className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b p-4">
						<div className="flex items-center justify-between">
							<SheetTitle className="flex items-center gap-2">
								<Filter className="h-5 w-5" />
								{title}
								{activeCount !== undefined && activeCount > 0 && (
									<span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
										{activeCount}
									</span>
								)}
							</SheetTitle>
							<SheetClose asChild>
								<Button variant="ghost" size="icon" className="touch-target">
									<X className="h-5 w-5" />
									<span className="sr-only">Fermer</span>
								</Button>
							</SheetClose>
						</div>
					</SheetHeader>

					{/* Scrollable content */}
					<div className="flex-1 overflow-y-auto overscroll-contain p-4">
						{children}
					</div>

					{/* Footer */}
					{footer && (
						<div className="sticky bottom-0 z-10 bg-white dark:bg-gray-900 border-t p-4 pb-safe">
							{footer}
						</div>
					)}
				</SheetContent>
			</Sheet>
		);
	}

	// Desktop: Static sidebar
	return (
		<aside
			className={cn(
				'hidden lg:block flex-shrink-0',
				sidebarWidth,
				className
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-semibold flex items-center gap-2">
					<Filter className="h-5 w-5" />
					{title}
					{activeCount !== undefined && activeCount > 0 && (
						<span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
							{activeCount}
						</span>
					)}
				</h2>
			</div>

			{/* Content */}
			<div className="space-y-6">{children}</div>

			{/* Footer */}
			{footer && <div className="mt-6 pt-4 border-t">{footer}</div>}
		</aside>
	);
}

/**
 * FilterTrigger - Button to open the filter drawer on mobile
 *
 * @example
 * <FilterTrigger onClick={() => setIsOpen(true)} activeCount={3} />
 */
export function FilterTrigger({
	onClick,
	activeCount,
	className,
}: {
	onClick: () => void;
	activeCount?: number;
	className?: string;
}) {
	return (
		<Button
			variant="outline"
			onClick={onClick}
			className={cn('lg:hidden touch-target gap-2', className)}
		>
			<Filter className="h-4 w-4" />
			Filtres
			{activeCount !== undefined && activeCount > 0 && (
				<span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
					{activeCount}
				</span>
			)}
		</Button>
	);
}

/**
 * FilterSection - Group related filters together
 *
 * @example
 * <FilterSection title="Prix" defaultOpen>
 *   <PriceRangeSlider />
 * </FilterSection>
 */
export function FilterSection({
	title,
	children,
	defaultOpen = true,
	className,
}: {
	title: string;
	children: React.ReactNode;
	defaultOpen?: boolean;
	className?: string;
}) {
	return (
		<details open={defaultOpen} className={cn('group', className)}>
			<summary className="flex items-center justify-between cursor-pointer list-none py-2 font-medium text-sm hover:text-primary transition-colors">
				{title}
				<span className="text-gray-400 group-open:rotate-180 transition-transform">
					▼
				</span>
			</summary>
			<div className="pt-2 pb-4 space-y-2">{children}</div>
		</details>
	);
}
