import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      intent: {
        // Primary intent (CTA principal)
        primary: 'bg-[var(--color-primary-600)] text-[var(--text-inverse)] hover:bg-[var(--color-primary-700)] active:bg-[var(--color-primary-800)]',
        
        // Accent intent (Action secondaire importante)
        accent: 'bg-[var(--color-accent-600)] text-[var(--text-inverse)] hover:bg-[var(--color-accent-700)] active:bg-[var(--color-accent-800)]',
        
        // Secondary intent (Action tertiaire)
        secondary: 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border-2 border-[var(--border-primary)]',
        
        // Success intent
        success: 'bg-[var(--color-success)] text-[var(--text-inverse)] hover:bg-[var(--color-success-dark)]',
        
        // Danger intent
        danger: 'bg-[var(--color-error)] text-[var(--text-inverse)] hover:brightness-95',
        
        // Ghost intent (transparent)
        ghost: 'bg-transparent text-[var(--color-primary-600)] hover:bg-[var(--bg-secondary)]',
        
        // Outline intent
        outline: 'border-2 border-[var(--color-primary-600)] bg-transparent text-[var(--color-primary-600)] hover:bg-[var(--color-primary-600)] hover:text-[var(--text-inverse)]',
        
        // Link intent
        link: 'text-[var(--color-primary-600)] underline-offset-4 hover:underline bg-transparent',
      },
      size: {
        xs: 'h-7 px-2 text-xs',
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
        xl: 'h-14 px-8 text-xl',
        icon: 'h-10 w-10 p-0',
      },
      tone: {
        brand: 'focus-visible:ring-[var(--color-brand-500)]',
        semantic: 'focus-visible:ring-[var(--color-success)]',
        neutral: 'focus-visible:ring-[var(--border-primary)]',
      },
      radius: {
        none: 'rounded-none',
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
        xl: 'rounded-xl',
        full: 'rounded-full',
      },
      density: {
        comfy: 'tracking-normal',
        compact: 'tracking-tight py-0',
      },
    },
    defaultVariants: {
      intent: 'primary',
      size: 'md',
      tone: 'brand',
      radius: 'md',
      density: 'comfy',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, intent, size, tone, radius, density, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ intent, size, tone, radius, density, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
