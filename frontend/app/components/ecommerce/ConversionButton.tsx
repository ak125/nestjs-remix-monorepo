/**
 * ConversionButton - CTA optimisé pour la conversion
 * 
 * Principes psychologiques appliqués:
 * - Couleur rouge/orangé = déclencheur d'action (urgence)
 * - Espacement respirant = +15% taux de clic
 * - Mobile-first = boutons grands et centrés
 * - Feedback visuel immédiat = confiance
 * 
 * @example
 * ```tsx
 * <ConversionButton
 *   onClick={addToCart}
 *   variant="primary"
 *   size="large"
 *   fullWidthOnMobile
 * >
 *   Ajouter au panier
 * </ConversionButton>
 * ```
 */

import { type ReactNode, type ButtonHTMLAttributes, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ConversionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** Contenu du bouton */
  children: ReactNode;
  
  /** Variant psychologique */
  variant?: 'primary' | 'secondary' | 'ghost' | 'urgent';
  
  /** Taille optimisée pour le contexte */
  size?: 'small' | 'medium' | 'large' | 'hero';
  
  /** Pleine largeur sur mobile (mobile-first) */
  fullWidthOnMobile?: boolean;
  
  /** Pleine largeur sur tous les écrans */
  fullWidth?: boolean;
  
  /** Icône à gauche */
  iconLeft?: ReactNode;
  
  /** Icône à droite */
  iconRight?: ReactNode;
  
  /** État de chargement */
  isLoading?: boolean;
  
  /** Texte de chargement */
  loadingText?: string;
  
  /** Callback avec tracking automatique */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  
  /** Label pour analytics (optionnel, children utilisé par défaut) */
  trackingLabel?: string;
  
  /** Données analytics supplémentaires */
  trackingData?: Record<string, unknown>;
  
  /** Espacement autour du bouton (respirant) */
  breathing?: boolean;
  
  /** Animation de succès après clic */
  showSuccessAnimation?: boolean;
}

// ============================================================================
// VARIANTS DE COULEURS (PSYCHOLOGIE)
// ============================================================================

const VARIANT_CLASSES = {
  // Primary: Rouge/Orangé = Action urgente (conversion max)
  primary: 'bg-gradient-to-r from-[#FF3B30] to-[#FF6B30] text-white hover:from-[#E63428] hover:to-[#E65B28] active:from-[#CC2F24] active:to-[#CC4F24] shadow-lg hover:shadow-xl active:shadow-md',
  
  // Secondary: Bleu foncé = Action secondaire (confiance)
  secondary: 'bg-[#0F4C81] text-white hover:bg-[#0D3F6B] active:bg-[#0B3255] shadow-md hover:shadow-lg active:shadow-sm',
  
  // Ghost: Transparent = Action tertiaire (non-intrusif)
  ghost: 'bg-transparent text-[#0F4C81] border-2 border-[#0F4C81] hover:bg-[#0F4C81] hover:text-white active:bg-[#0D3F6B]',
  
  // Urgent: Rouge pulsant = Urgence maximale (stock faible)
  urgent: 'bg-[#C0392B] text-white hover:bg-[#A93226] active:bg-[#922B21] shadow-xl animate-pulse-soft',
} as const;

// ============================================================================
// TAILLES (MOBILE-FIRST)
// ============================================================================

const SIZE_CLASSES = {
  // Small: Boutons secondaires (min 44px pour touch)
  small: 'px-4 py-2 text-sm min-h-[44px] gap-2',
  
  // Medium: Boutons standards (min 48px recommandé)
  medium: 'px-6 py-3 text-base min-h-[48px] gap-2',
  
  // Large: Boutons primaires (min 56px optimal)
  large: 'px-8 py-4 text-lg min-h-[56px] gap-3',
  
  // Hero: CTA principal page (min 64px impact max)
  hero: 'px-10 py-5 text-xl min-h-[64px] gap-4',
} as const;

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function ConversionButton({
  children,
  variant = 'primary',
  size = 'large',
  fullWidthOnMobile = true,
  fullWidth = false,
  iconLeft,
  iconRight,
  isLoading = false,
  loadingText = 'Chargement...',
  onClick,
  trackingLabel,
  trackingData,
  breathing = true,
  showSuccessAnimation = false,
  disabled,
  className = '',
  ...props
}: ConversionButtonProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // ========================================
  // GESTION DU CLIC AVEC TRACKING
  // ========================================
  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isLoading || isProcessing || disabled) return;

    // Analytics tracking
    const label = trackingLabel || (typeof children === 'string' ? children : 'CTA Click');
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'cta_click', {
        label,
        variant,
        size,
        ...trackingData,
      });
    }

    // Exécuter le callback
    if (onClick) {
      setIsProcessing(true);
      try {
        await onClick(event);
        
        // Animation de succès
        if (showSuccessAnimation) {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 2000);
        }
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // ========================================
  // CLASSES CSS (MOBILE-FIRST)
  // ========================================
  const baseClasses = 'font-heading font-bold rounded-lg transition-all duration-300 ease-out flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const widthClasses = fullWidth 
    ? 'w-full' 
    : fullWidthOnMobile 
      ? 'w-full md:w-auto' 
      : 'w-auto';
  
  const breathingClasses = breathing 
    ? 'my-6 mx-auto' // Espacement vertical respirant (+15% conversion)
    : '';

  const successClasses = showSuccess 
    ? 'bg-[#27AE60] scale-105' 
    : '';

  const combinedClasses = `
    ${baseClasses}
    ${VARIANT_CLASSES[variant]}
    ${SIZE_CLASSES[size]}
    ${widthClasses}
    ${breathingClasses}
    ${successClasses}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  // ========================================
  // CONTENU DU BOUTON
  // ========================================
  const buttonContent = (isLoading || isProcessing) ? (
    <>
      <LoadingSpinner size={size} />
      <span>{loadingText}</span>
    </>
  ) : showSuccess ? (
    <>
      <SuccessIcon />
      <span>Ajouté ✓</span>
    </>
  ) : (
    <>
      {iconLeft && <span className="flex-shrink-0">{iconLeft}</span>}
      <span>{children}</span>
      {iconRight && <span className="flex-shrink-0">{iconRight}</span>}
    </>
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading || isProcessing}
      className={combinedClasses}
      {...props}
    >
      {buttonContent}
    </button>
  );
}

// ============================================================================
// VARIANTS PRÉ-CONFIGURÉS
// ============================================================================

/** CTA principal - Conversion maximale */
export function PrimaryCTA(props: Omit<ConversionButtonProps, 'variant' | 'size'>) {
  return (
    <ConversionButton 
      variant="primary" 
      size="hero" 
      breathing 
      showSuccessAnimation 
      {...props} 
    />
  );
}

/** CTA urgent - Stock faible */
export function UrgentCTA(props: Omit<ConversionButtonProps, 'variant'>) {
  return (
    <ConversionButton 
      variant="urgent" 
      showSuccessAnimation 
      {...props} 
    />
  );
}

/** CTA mobile - Optimisé tactile */
export function MobileCTA(props: Omit<ConversionButtonProps, 'size' | 'fullWidthOnMobile'>) {
  return (
    <ConversionButton 
      size="large" 
      fullWidthOnMobile 
      breathing 
      {...props} 
    />
  );
}

/** CTA comparaison - Action secondaire */
export function SecondaryCTA(props: Omit<ConversionButtonProps, 'variant'>) {
  return (
    <ConversionButton 
      variant="secondary" 
      {...props} 
    />
  );
}

/** CTA discret - Action tertiaire */
export function GhostCTA(props: Omit<ConversionButtonProps, 'variant' | 'breathing'>) {
  return (
    <ConversionButton 
      variant="ghost" 
      breathing={false} 
      {...props} 
    />
  );
}

// ============================================================================
// COMPOSANTS AUXILIAIRES
// ============================================================================

function LoadingSpinner({ size }: { size: ConversionButtonProps['size'] }) {
  const spinnerSize = size === 'hero' ? 'w-6 h-6' : size === 'large' ? 'w-5 h-5' : 'w-4 h-4';
  
  return (
    <svg 
      className={`animate-spin ${spinnerSize}`} 
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
}

function SuccessIcon() {
  return (
    <svg 
      className="w-5 h-5" 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 20 20" 
      fill="currentColor"
    >
      <path 
        fillRule="evenodd" 
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
        clipRule="evenodd" 
      />
    </svg>
  );
}

// ============================================================================
// GROUPE DE BOUTONS (HIÉRARCHIE VISUELLE)
// ============================================================================

interface CTAGroupProps {
  /** Bouton principal */
  primary: ReactNode;
  
  /** Bouton secondaire (optionnel) */
  secondary?: ReactNode;
  
  /** Layout */
  layout?: 'horizontal' | 'vertical' | 'stack-mobile';
  
  /** Inverse l'ordre des boutons */
  reverse?: boolean;
}

export function CTAGroup({ 
  primary, 
  secondary, 
  layout = 'stack-mobile', 
  reverse = false 
}: CTAGroupProps) {
  const containerClasses = 
    layout === 'vertical' 
      ? 'flex flex-col gap-4' 
      : layout === 'horizontal' 
        ? 'flex flex-row gap-4 items-center justify-center' 
        : 'flex flex-col md:flex-row gap-4 items-stretch md:items-center md:justify-center';

  const buttons = reverse ? [secondary, primary] : [primary, secondary];

  return (
    <div className={containerClasses}>
      {buttons[0]}
      {buttons[1]}
    </div>
  );
}

// ============================================================================
// CSS ANIMATIONS CUSTOM
// ============================================================================

export const conversionButtonStyles = `
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
