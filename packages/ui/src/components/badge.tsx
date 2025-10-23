import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-full border font-medium transition-colors',
  {
    variants: {
      variant: {
        // Primary variant (brand)
        default:
          'bg-[var(--color-primary-600)] text-white border-transparent',
        
        // Secondary variant (neutral)
        secondary:
          'bg-[var(--color-secondary-500)] text-white border-transparent',
        
        // Success variant (green)
        success:
          'bg-[var(--color-semantic-success)] text-white border-transparent',
        
        // Warning variant (yellow/orange)
        warning:
          'bg-[var(--color-semantic-warning)] text-white border-transparent',
        
        // Error variant (red)
        error:
          'bg-[var(--color-semantic-error)] text-white border-transparent',
        
        // Info variant (blue)
        info:
          'bg-[var(--color-semantic-info)] text-white border-transparent',
        
        // Outline variants (transparent background)
        outline:
          'bg-transparent border-[var(--border-primary)] text-[var(--text-primary)]',
        
        'outline-success':
          'bg-transparent border-[var(--color-semantic-success)] text-[var(--color-semantic-success)]',
        
        'outline-warning':
          'bg-transparent border-[var(--color-semantic-warning)] text-[var(--color-semantic-warning)]',
        
        'outline-error':
          'bg-transparent border-[var(--color-semantic-error)] text-[var(--color-semantic-error)]',
        
        'outline-info':
          'bg-transparent border-[var(--color-semantic-info)] text-[var(--color-semantic-info)]',
        
        // Subtle variants (light background)
        subtle:
          'bg-[var(--color-primary-600)]/10 border-transparent text-[var(--color-primary-600)]',
        
        'subtle-success':
          'bg-[var(--color-semantic-success)]/10 border-transparent text-[var(--color-semantic-success)]',
        
        'subtle-warning':
          'bg-[var(--color-semantic-warning)]/10 border-transparent text-[var(--color-semantic-warning)]',
        
        'subtle-error':
          'bg-[var(--color-semantic-error)]/10 border-transparent text-[var(--color-semantic-error)]',
        
        'subtle-info':
          'bg-[var(--color-semantic-info)]/10 border-transparent text-[var(--color-semantic-info)]',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-sm',
        lg: 'px-3 py-1 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /**
   * Icon to display before text (optional)
   */
  icon?: React.ReactNode;
  /**
   * Close button handler (optional) - makes badge dismissible
   */
  onRemove?: () => void;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant,
      size,
      icon,
      onRemove,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      >
        {icon && (
          <span className="flex-shrink-0">
            {icon}
          </span>
        )}
        
        <span>{children}</span>
        
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="flex-shrink-0 ml-0.5 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-offset-1"
            aria-label="Supprimer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };
