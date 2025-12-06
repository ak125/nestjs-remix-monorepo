import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../lib/utils";

/**
 * 🎛️ FilterSection - Composant réutilisable pour sections de filtres
 *
 * Encapsule header + contenu avec variants pour différents états
 * Utilisé dans PiecesFilterSidebar pour réduire duplication de code
 */

const filterSectionVariants = cva("space-y-3", {
  variants: {
    variant: {
      default: "",
      compact: "space-y-2",
      spacious: "space-y-4",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const filterSectionHeaderVariants = cva(
  "text-xs font-semibold flex items-center gap-2",
  {
    variants: {
      variant: {
        default: "text-foreground",
        muted: "text-muted-foreground",
        primary: "text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface FilterSectionProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof filterSectionVariants> {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  headerVariant?: VariantProps<typeof filterSectionHeaderVariants>["variant"];
}

const FilterSection = React.forwardRef<HTMLDivElement, FilterSectionProps>(
  (
    {
      className,
      variant,
      title,
      icon,
      badge,
      headerVariant = "default",
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(filterSectionVariants({ variant }), className)}
        {...props}
      >
        <div
          className={cn(
            filterSectionHeaderVariants({ variant: headerVariant }),
            "mb-3",
          )}
        >
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <h4>{title}</h4>
          {badge && <span className="ml-auto">{badge}</span>}
        </div>
        <div className="space-y-2">{children}</div>
      </div>
    );
  },
);
FilterSection.displayName = "FilterSection";

/**
 * FilterOption - Wrapper pour options de filtre individuelles
 */
const filterOptionVariants = cva(
  "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-200",
  {
    variants: {
      state: {
        default: "border border-transparent hover:bg-accent",
        selected: "bg-primary/10 border border-primary/30 shadow-sm",
        disabled: "opacity-50 cursor-not-allowed bg-muted",
      },
    },
    defaultVariants: {
      state: "default",
    },
  },
);

interface FilterOptionProps
  extends React.HTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof filterOptionVariants> {
  isSelected?: boolean;
  isDisabled?: boolean;
}

const FilterOption = React.forwardRef<HTMLLabelElement, FilterOptionProps>(
  ({ className, state, isSelected, isDisabled, children, ...props }, ref) => {
    // Auto-determine state if not explicitly set
    const computedState =
      state || (isDisabled ? "disabled" : isSelected ? "selected" : "default");

    return (
      <label
        ref={ref}
        className={cn(
          filterOptionVariants({ state: computedState }),
          className,
        )}
        {...props}
      >
        {children}
      </label>
    );
  },
);
FilterOption.displayName = "FilterOption";

export {
  FilterSection,
  FilterOption,
  filterSectionVariants,
  filterOptionVariants,
};
