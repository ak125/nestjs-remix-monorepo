import { cn } from "~/lib/utils";

/**
 * ResponsiveGrid — Auto-adaptive grid using CSS auto-fill/auto-fit.
 *
 * Mobile-first: starts with a minimum column width and automatically
 * calculates the number of columns based on available space.
 * No breakpoint-specific column counts needed.
 *
 * @example
 * // Product cards: min 250px each
 * <ResponsiveGrid minChildWidth="250px" gap="md">
 *   {products.map(p => <ProductCard key={p.id} product={p} />)}
 * </ResponsiveGrid>
 *
 * // Brand logos: min 100px each
 * <ResponsiveGrid minChildWidth="100px" gap="sm" fill="auto-fill">
 *   {brands.map(b => <BrandLogo key={b.id} brand={b} />)}
 * </ResponsiveGrid>
 *
 * // Fixed columns (traditional breakpoint approach)
 * <ResponsiveGrid cols={{ base: 1, sm: 2, lg: 3 }} gap="md">
 *   {items.map(item => <Card key={item.id} item={item} />)}
 * </ResponsiveGrid>
 */

const GAP_CLASSES = {
  none: "gap-0",
  xs: "gap-1.5 sm:gap-2",
  sm: "gap-2 sm:gap-3",
  md: "gap-3 sm:gap-4 lg:gap-5",
  lg: "gap-4 sm:gap-5 lg:gap-6",
  xl: "gap-5 sm:gap-6 lg:gap-8",
} as const;

interface ResponsiveGridAutoProps {
  children: React.ReactNode;
  /** Minimum width for each child (CSS value). Grid auto-calculates columns. */
  minChildWidth: string;
  /** Gap between items */
  gap?: keyof typeof GAP_CLASSES;
  /** auto-fill (empty cols remain) or auto-fit (cols stretch to fill) */
  fill?: "auto-fill" | "auto-fit";
  /** Additional classes */
  className?: string;
}

interface ResponsiveGridFixedProps {
  children: React.ReactNode;
  /** Fixed column counts per breakpoint */
  cols: {
    base?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  /** Gap between items */
  gap?: keyof typeof GAP_CLASSES;
  /** Additional classes */
  className?: string;
}

type ResponsiveGridProps = ResponsiveGridAutoProps | ResponsiveGridFixedProps;

function isAutoProps(
  props: ResponsiveGridProps,
): props is ResponsiveGridAutoProps {
  return "minChildWidth" in props;
}

// Map of column count to Tailwind class
const COL_MAP: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
  8: "grid-cols-8",
  9: "grid-cols-9",
  10: "grid-cols-10",
  11: "grid-cols-11",
  12: "grid-cols-12",
};

const SM_COL_MAP: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
  7: "sm:grid-cols-7",
  8: "sm:grid-cols-8",
  9: "sm:grid-cols-9",
};

const MD_COL_MAP: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
  7: "md:grid-cols-7",
  8: "md:grid-cols-8",
  9: "md:grid-cols-9",
};

const LG_COL_MAP: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
  7: "lg:grid-cols-7",
  8: "lg:grid-cols-8",
  9: "lg:grid-cols-9",
};

const XL_COL_MAP: Record<number, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
  7: "xl:grid-cols-7",
  8: "xl:grid-cols-8",
  9: "xl:grid-cols-9",
};

export default function ResponsiveGrid(props: ResponsiveGridProps) {
  const { children, gap = "md", className } = props;

  if (isAutoProps(props)) {
    const { minChildWidth, fill = "auto-fit" } = props;
    return (
      <div
        className={cn("grid", GAP_CLASSES[gap], className)}
        style={{
          gridTemplateColumns: `repeat(${fill}, minmax(${minChildWidth}, 1fr))`,
        }}
      >
        {children}
      </div>
    );
  }

  // Fixed columns mode
  const { cols } = props;
  const colClasses = [
    cols.base ? COL_MAP[cols.base] : "grid-cols-1",
    cols.sm ? SM_COL_MAP[cols.sm] : undefined,
    cols.md ? MD_COL_MAP[cols.md] : undefined,
    cols.lg ? LG_COL_MAP[cols.lg] : undefined,
    cols.xl ? XL_COL_MAP[cols.xl] : undefined,
  ].filter(Boolean);

  return (
    <div className={cn("grid", ...colClasses, GAP_CLASSES[gap], className)}>
      {children}
    </div>
  );
}
