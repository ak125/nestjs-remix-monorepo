import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../lib/utils';

// Déclaration TypeScript pour gtag (Google Analytics)
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
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
        
        // Conversion intent (CTA optimisé conversion avec gradient)
        conversion: 'bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-primary-400)] text-[var(--text-inverse)] hover:from-[var(--color-primary-600)] hover:to-[var(--color-primary-500)] shadow-lg hover:shadow-xl active:scale-[0.98]',
        
        // Urgent intent (Urgence avec pulse animation)
        urgent: 'bg-[var(--color-error)] text-[var(--text-inverse)] hover:bg-[var(--color-error-dark)] shadow-xl animate-pulse-soft',
      },
      size: {
        xs: 'h-7 px-2 text-xs',
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
        xl: 'h-14 px-8 text-xl',
        icon: 'h-10 w-10 p-0',
        // Hero size pour CTAs principaux (optimisé mobile)
        hero: 'h-16 px-10 text-2xl min-h-[64px] font-bold',
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
      // Breathing: Espacement respirant autour du CTA (+15% conversion)
      breathing: {
        true: 'my-6 mx-auto',
        false: '',
      },
      // Mobile-first: Pleine largeur sur mobile, auto sur desktop
      fullWidthMobile: {
        true: 'w-full md:w-auto',
        false: 'w-auto',
      },
    },
    defaultVariants: {
      intent: 'primary',
      size: 'md',
      tone: 'brand',
      radius: 'md',
      density: 'comfy',
      breathing: false,
      fullWidthMobile: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  // Analytics tracking
  trackingLabel?: string;
  trackingData?: Record<string, unknown>;
  // Animations
  showSuccessAnimation?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  // Icons
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      intent,
      size,
      tone,
      radius,
      density,
      breathing,
      fullWidthMobile,
      asChild = false,
      onClick,
      children,
      disabled,
      trackingLabel,
      trackingData,
      showSuccessAnimation = false,
      isLoading = false,
      loadingText = 'Chargement...',
      iconLeft,
      iconRight,
      ...props
    },
    ref
  ) => {
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [showSuccess, setShowSuccess] = React.useState(false);

    const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
      // Tracking analytics si configuré
      if (trackingLabel && typeof globalThis !== 'undefined') {
        const win = globalThis as any;
        if (win.window && win.window.gtag) {
          win.window.gtag('event', 'cta_click', {
            event_label: trackingLabel,
            button_variant: intent,
            button_size: size,
            ...trackingData,
          });
        }
      }

      if (onClick) {
        setIsProcessing(true);
        try {
          await onClick(event);
          
          // Animation succès si activée
          if (showSuccessAnimation) {
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
          }
        } finally {
          setIsProcessing(false);
        }
      }
    };

    const isButtonDisabled = disabled || isProcessing || isLoading;
    const currentlyLoading = isLoading || isProcessing;

    // Contenu du bouton
    let buttonContent = children;
    
    if (currentlyLoading) {
      buttonContent = (
        <>
          <LoadingSpinner size={size || 'md'} />
          <span>{loadingText}</span>
        </>
      );
    } else if (showSuccess) {
      buttonContent = (
        <>
          <SuccessIcon />
          <span>Succès !</span>
        </>
      );
    } else {
      buttonContent = (
        <>
          {iconLeft && <span className="inline-flex items-center">{iconLeft}</span>}
          {children}
          {iconRight && <span className="inline-flex items-center">{iconRight}</span>}
        </>
      );
    }

    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ intent, size, tone, radius, density, breathing, fullWidthMobile, className }))}
          ref={ref}
          {...props}
        >
          {buttonContent}
        </Slot>
      );
    }

    return (
      <button
        className={cn(
          buttonVariants({ intent, size, tone, radius, density, breathing, fullWidthMobile, className }),
          showSuccess && 'bg-[var(--color-success)] hover:bg-[var(--color-success-dark)]'
        )}
        ref={ref}
        onClick={handleClick}
        disabled={isButtonDisabled}
        {...props}
      >
        {buttonContent}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ============================================================================
// Helper Components
// ============================================================================

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon' | 'hero';
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md' }) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6',
    hero: 'w-6 h-6',
    icon: 'w-5 h-5',
  };

  return (
    <svg
      className={cn('animate-spin', sizeClasses[size])}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

const SuccessIcon: React.FC = () => {
  return (
    <svg
      className="w-5 h-5"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
};

// ============================================================================
// Pre-configured Variant Exports (DX optimisé)
// ============================================================================

export const ConversionCTA = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'intent' | 'size'>>(
  (props, ref) => (
    <Button
      ref={ref}
      intent="conversion"
      size="hero"
      breathing
      showSuccessAnimation
      {...props}
    />
  )
);
ConversionCTA.displayName = 'ConversionCTA';

export const UrgentCTA = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'intent'>>(
  (props, ref) => (
    <Button
      ref={ref}
      intent="urgent"
      showSuccessAnimation
      {...props}
    />
  )
);
UrgentCTA.displayName = 'UrgentCTA';

export const MobileCTA = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'size' | 'fullWidthMobile' | 'breathing'>>(
  (props, ref) => (
    <Button
      ref={ref}
      size="lg"
      fullWidthMobile
      breathing
      {...props}
    />
  )
);
MobileCTA.displayName = 'MobileCTA';

export const SecondaryCTA = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'intent'>>(
  (props, ref) => (
    <Button
      ref={ref}
      intent="secondary"
      {...props}
    />
  )
);
SecondaryCTA.displayName = 'SecondaryCTA';

export const GhostCTA = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'intent' | 'breathing'>>(
  (props, ref) => (
    <Button
      ref={ref}
      intent="ghost"
      breathing={false}
      {...props}
    />
  )
);
GhostCTA.displayName = 'GhostCTA';

// ============================================================================
// CSS Animations Export
// ============================================================================

export const buttonAnimations = `
@keyframes pulse-soft {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.95;
    transform: scale(1.02);
  }
}

.animate-pulse-soft {
  animation: pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
`;

export { Button, buttonVariants };
