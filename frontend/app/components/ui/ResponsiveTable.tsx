import { useIsMobile } from '~/hooks/useMediaQuery';
import { cn } from '~/lib/utils';

export interface Column<T> {
	/** Unique key for the column */
	key: string;
	/** Column header text */
	header: string;
	/** Render function for cell content */
	render: (item: T, index: number) => React.ReactNode;
	/** Column alignment. Default: 'left' */
	align?: 'left' | 'center' | 'right';
	/** Hide column on mobile (still visible in card view) */
	hideOnMobile?: boolean;
	/** Width class (e.g., 'w-24', 'w-1/4') */
	width?: string;
}

export interface ResponsiveTableProps<T> {
	/** Data array to display */
	data: T[];
	/** Column definitions */
	columns: Column<T>[];
	/**
	 * Custom mobile card renderer
	 * If not provided, columns will be stacked vertically
	 */
	mobileCard?: (item: T, index: number) => React.ReactNode;
	/** Unique key extractor for each row */
	keyExtractor: (item: T, index: number) => string | number;
	/** Empty state message */
	emptyMessage?: string;
	/** Loading state */
	isLoading?: boolean;
	/** Table caption for accessibility */
	caption?: string;
	className?: string;
}

/**
 * ResponsiveTable - Adaptive table that switches to cards on mobile
 *
 * Pattern: Table on desktop → Cards on mobile
 * Eliminates horizontal scroll that causes mobile abandonment.
 *
 * @example
 * // Basic usage with auto-generated mobile cards
 * <ResponsiveTable
 *   data={orders}
 *   columns={[
 *     { key: 'id', header: 'N° Commande', render: (o) => o.id },
 *     { key: 'date', header: 'Date', render: (o) => formatDate(o.date) },
 *     { key: 'total', header: 'Total', render: (o) => formatPrice(o.total), align: 'right' },
 *   ]}
 *   keyExtractor={(o) => o.id}
 * />
 *
 * @example
 * // Custom mobile card design
 * <ResponsiveTable
 *   data={orders}
 *   columns={orderColumns}
 *   keyExtractor={(o) => o.id}
 *   mobileCard={(order) => (
 *     <OrderCard order={order} />
 *   )}
 * />
 */
export function ResponsiveTable<T>({
	data,
	columns,
	mobileCard,
	keyExtractor,
	emptyMessage = 'Aucun élément à afficher',
	isLoading = false,
	caption,
	className,
}: ResponsiveTableProps<T>) {
	const isMobile = useIsMobile();

	// Loading state
	if (isLoading) {
		return (
			<div className="space-y-3">
				{[1, 2, 3].map((i) => (
					<div
						key={i}
						className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
					/>
				))}
			</div>
		);
	}

	// Empty state
	if (data.length === 0) {
		return (
			<div className="text-center py-12 text-gray-500 dark:text-gray-400">
				{emptyMessage}
			</div>
		);
	}

	// Mobile: Card view
	if (isMobile) {
		return (
			<div className={cn('space-y-3', className)}>
				{data.map((item, index) => {
					const key = keyExtractor(item, index);

					// Custom card renderer
					if (mobileCard) {
						return (
							<div key={key} className="animate-fadeIn">
								{mobileCard(item, index)}
							</div>
						);
					}

					// Default card layout (stacked columns)
					return (
						<div
							key={key}
							className={cn(
								'bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800',
								'p-4 space-y-2 shadow-sm'
							)}
						>
							{columns.map((col) => (
								<div
									key={col.key}
									className="flex justify-between items-start gap-2"
								>
									<span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
										{col.header}
									</span>
									<span
										className={cn(
											'text-sm font-medium text-right',
											col.align === 'right' && 'tabular-nums'
										)}
									>
										{col.render(item, index)}
									</span>
								</div>
							))}
						</div>
					);
				})}
			</div>
		);
	}

	// Desktop: Standard table
	return (
		<div className={cn('overflow-x-auto', className)}>
			<table className="w-full border-collapse">
				{caption && (
					<caption className="sr-only">{caption}</caption>
				)}
				<thead>
					<tr className="border-b border-gray-200 dark:border-gray-800">
						{columns
							.filter((col) => !col.hideOnMobile)
							.map((col) => (
								<th
									key={col.key}
									className={cn(
										'px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-400',
										'text-left',
										col.align === 'center' && 'text-center',
										col.align === 'right' && 'text-right',
										col.width
									)}
								>
									{col.header}
								</th>
							))}
					</tr>
				</thead>
				<tbody className="divide-y divide-gray-100 dark:divide-gray-800">
					{data.map((item, index) => (
						<tr
							key={keyExtractor(item, index)}
							className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
						>
							{columns
								.filter((col) => !col.hideOnMobile)
								.map((col) => (
									<td
										key={col.key}
										className={cn(
											'px-4 py-3 text-sm',
											col.align === 'center' && 'text-center',
											col.align === 'right' && 'text-right tabular-nums',
											col.width
										)}
									>
										{col.render(item, index)}
									</td>
								))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/**
 * MobileCard - Pre-styled card for custom mobile table rows
 */
export function MobileCard({
	children,
	onClick,
	className,
}: {
	children: React.ReactNode;
	onClick?: () => void;
	className?: string;
}) {
	const Component = onClick ? 'button' : 'div';

	return (
		<Component
			onClick={onClick}
			className={cn(
				'w-full text-left',
				'bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800',
				'p-4 shadow-sm',
				onClick && 'touch-target hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
				className
			)}
		>
			{children}
		</Component>
	);
}
