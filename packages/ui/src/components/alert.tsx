import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const alertVariants = cva(
  'relative w-full rounded-[var(--radius-lg)] border p-4 transition-colors duration-200',
  {
    variants: {
      intent: {
        // Success intent (green)
        success:
          'bg-[var(--color-semantic-success)]/10 border-[var(--color-semantic-success)]/30 text-[var(--color-semantic-success)]',
        
        // Warning intent (yellow/orange)
        warning:
          'bg-[var(--color-semantic-warning)]/10 border-[var(--color-semantic-warning)]/30 text-[var(--color-semantic-warning)]',
        
        // Error intent (red)
        error:
          'bg-[var(--color-semantic-error)]/10 border-[var(--color-semantic-error)]/30 text-[var(--color-semantic-error)]',
        
        // Info intent (blue)
        info:
          'bg-[var(--color-semantic-info)]/10 border-[var(--color-semantic-info)]/30 text-[var(--color-semantic-info)]',
      },
      variant: {
        // Default: subtle background + border
        default: '',
        
        // Solid: full color background
        solid: '',
        
        // Outline: transparent bg, colored border
        outline: 'bg-transparent',
      },
      size: {
        sm: 'text-sm p-3',
        md: 'text-base p-4',
        lg: 'text-lg p-5',
      },
    },
    compoundVariants: [
      // Solid variants with white text
      {
        intent: 'success',
        variant: 'solid',
        className: 'bg-[var(--color-semantic-success)] border-[var(--color-semantic-success)] text-white',
      },
      {
        intent: 'warning',
        variant: 'solid',
        className: 'bg-[var(--color-semantic-warning)] border-[var(--color-semantic-warning)] text-white',
      },
      {
        intent: 'error',
        variant: 'solid',
        className: 'bg-[var(--color-semantic-error)] border-[var(--color-semantic-error)] text-white',
      },
      {
        intent: 'info',
        variant: 'solid',
        className: 'bg-[var(--color-semantic-info)] border-[var(--color-semantic-info)] text-white',
      },
    ],
    defaultVariants: {
      intent: 'info',
      variant: 'default',
      size: 'md',
    },
  }
);

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof alertVariants> {
  /**
   * Alert title (optional)
   */
  title?: React.ReactNode;
  /**
   * Icon to display (optional)
   */
  icon?: React.ReactNode;
  /**
   * Close button handler (optional)
   */
  onClose?: () => void;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      intent,
      variant,
      size,
      title,
      icon,
      onClose,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ intent, variant, size }), className)}
        {...props}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          {icon && (
            <div className="flex-shrink-0 mt-0.5">
              {icon}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {title && (
              <h5 className="mb-1 font-semibold leading-none tracking-tight">
                {title}
              </h5>
            )}
            <div className="text-sm leading-relaxed opacity-90">
              {children}
            </div>
          </div>

          {/* Close button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2"
              aria-label="Fermer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
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
        </div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export { Alert, alertVariants };
