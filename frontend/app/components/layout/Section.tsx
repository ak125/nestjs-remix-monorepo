import { cn } from "~/lib/utils";

/**
 * Section — Unified section wrapper that replaces both PageSection and DarkSection.
 *
 * Provides consistent spacing, backgrounds, and container widths across all pages.
 * Mobile-first with fluid spacing tokens.
 *
 * @example
 * // Light section (default)
 * <Section>Content here</Section>
 *
 * // Dark navy section with decorative elements
 * <Section variant="dark" decorations>
 *   <SectionHeader title="Features" dark />
 *   <ResponsiveGrid>...</ResponsiveGrid>
 * </Section>
 *
 * // Slate background, narrow width
 * <Section variant="slate" size="narrow" spacing="sm">
 *   <FAQ />
 * </Section>
 */

const VARIANT_CLASSES = {
  white: "bg-white",
  slate: "bg-slate-50",
  dark: "bg-gradient-to-b from-navy-mid via-navy-mid-light to-navy-light text-white",
  "dark-solid": "bg-navy text-white",
  "navy-gradient":
    "bg-gradient-to-br from-navy via-navy-mid to-navy-light text-white",
  transparent: "bg-transparent",
} as const;

const SIZE_CLASSES = {
  narrow: "max-w-3xl",
  default: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-full",
} as const;

const SPACING_CLASSES = {
  none: "",
  xs: "py-section-xs",
  sm: "py-section-sm",
  md: "py-section-md",
  lg: "py-section-lg",
  xl: "py-section-xl",
} as const;

interface SectionProps {
  children: React.ReactNode;
  /** Visual variant */
  variant?: keyof typeof VARIANT_CLASSES;
  /** Container max-width */
  size?: keyof typeof SIZE_CLASSES;
  /** Vertical spacing */
  spacing?: keyof typeof SPACING_CLASSES;
  /** Show decorative grid pattern (dark variants only) */
  decorations?: boolean;
  /** Show glow effects (dark variants only) */
  glow?: boolean;
  /** HTML id for anchor links */
  id?: string;
  /** Additional classes */
  className?: string;
}

export default function Section({
  children,
  variant = "white",
  size = "wide",
  spacing = "md",
  decorations = false,
  glow = false,
  id,
  className,
}: SectionProps) {
  const isDark =
    variant === "dark" ||
    variant === "dark-solid" ||
    variant === "navy-gradient";

  return (
    <section
      id={id}
      className={cn(
        "relative overflow-hidden",
        SPACING_CLASSES[spacing],
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {/* Decorative grid pattern */}
      {isDark && decorations && (
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Glow effects */}
      {isDark && glow && (
        <>
          <div
            className="absolute -top-20 -right-20 w-80 h-80 bg-cta/[0.08] rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-20 -left-20 w-60 h-60 bg-navy-light/40 rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />
        </>
      )}

      <div
        className={cn("relative mx-auto w-full px-page", SIZE_CLASSES[size])}
      >
        {children}
      </div>
    </section>
  );
}
