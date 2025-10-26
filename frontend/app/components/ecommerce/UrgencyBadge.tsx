/**
 * UrgencyBadge & RarityIndicator - Badges urgence/rareté stock
 * 
 * Indicateurs visuels pour créer un sentiment d'urgence et guider l'achat:
 * - "Plus que 2 en stock!" (warning, pulse)
 * - "Dernière pièce!" (error, pulse)
 * - "Pièce rare" (secondary, badge spécial)
 * - "Stock limité" (warning)
 * 
 * Design System: Warning (stock faible), Error (critique), Secondary (rare), Success (promo)
 * Animations: Pulse CSS pour attirer l'attention
 * Typographie: font-heading (bold), font-sans (corps)
 * Espacement: 8px grid (px-sm, py-xs)
 */

import React from 'react';

// ============================================================================
// Types
// ============================================================================

export type UrgencyLevel = 'high' | 'medium' | 'low' | 'none';

export interface UrgencyBadgeProps {
  /** Quantité en stock */
  stockQuantity: number;
  
  /** Seuil bas stock (défaut: 3) */
  lowStockThreshold?: number;
  
  /** Seuil critique (défaut: 1) */
  criticalStockThreshold?: number;
  
  /** Afficher animation pulse */
  animated?: boolean;
  
  /** Taille du badge */
  size?: 'sm' | 'md' | 'lg';
  
  /** Mode compact (icône + nombre uniquement) */
  compact?: boolean;
}

export interface RarityIndicatorProps {
  /** Type de rareté */
  rarityType: 'rare' | 'limited' | 'exclusive' | 'discontinued';
  
  /** Message personnalisé (optionnel) */
  customMessage?: string;
  
  /** Afficher animation pulse */
  animated?: boolean;
  
  /** Taille */
  size?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// UrgencyBadge - Badge urgence stock
// ============================================================================

export const UrgencyBadge: React.FC<UrgencyBadgeProps> = ({
  stockQuantity,
  lowStockThreshold = 3,
  criticalStockThreshold = 1,
  animated = true,
  size = 'md',
  compact = false,
}) => {
  // Déterminer le niveau d'urgence
  const urgencyLevel: UrgencyLevel =
    stockQuantity <= 0
      ? 'none'
      : stockQuantity <= criticalStockThreshold
        ? 'high'
        : stockQuantity <= lowStockThreshold
          ? 'medium'
          : 'low';

  // Pas de badge si stock suffisant ou épuisé
  if (urgencyLevel === 'none' || urgencyLevel === 'low') {
    return null;
  }

  // Configuration selon niveau
  const config = {
    high: {
      bg: 'bg-error-500',
      text: 'text-white',
      icon: '🔥',
      message:
        stockQuantity === 1
          ? 'Dernière pièce !'
          : `Plus que ${stockQuantity} en stock !`,
      pulse: true,
    },
    medium: {
      bg: 'bg-warning-500',
      text: 'text-white',
      icon: '⚠',
      message: `Plus que ${stockQuantity} disponibles`,
      pulse: false,
    },
  }[urgencyLevel as 'high' | 'medium'];

  // Tailles
  const sizeClasses = {
    sm: 'text-xs px-sm py-xs',
    md: 'text-sm px-md py-sm',
    lg: 'text-base px-lg py-md',
  }[size];

  const iconSize = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }[size];

  return (
    <div
      className={`
        inline-flex items-center gap-xs rounded-md font-heading
        ${config.bg} ${config.text} ${sizeClasses}
        ${animated && config.pulse ? 'animate-pulse' : ''}
        shadow-md
      `}
      role="status"
      aria-live="polite"
    >
      <span className={iconSize} aria-hidden="true">
        {config.icon}
      </span>
      {!compact && <span className="font-bold">{config.message}</span>}
      {compact && <span className="font-bold">{stockQuantity}</span>}
    </div>
  );
};

// ============================================================================
// RarityIndicator - Indicateur rareté pièce
// ============================================================================

export const RarityIndicator: React.FC<RarityIndicatorProps> = ({
  rarityType,
  customMessage,
  animated = true,
  size = 'md',
}) => {
  // Configuration selon type de rareté
  const config = {
    rare: {
      bg: 'bg-secondary-500',
      text: 'text-white',
      border: 'border-secondary-700',
      icon: '💎',
      label: 'Pièce rare',
      message: 'Disponibilité limitée',
    },
    limited: {
      bg: 'bg-warning-500',
      text: 'text-white',
      border: 'border-warning-700',
      icon: '⏱',
      label: 'Édition limitée',
      message: 'Stock limité',
    },
    exclusive: {
      bg: 'bg-success-500',
      text: 'text-white',
      border: 'border-success-700',
      icon: '⭐',
      label: 'Exclusif',
      message: 'Disponible uniquement ici',
    },
    discontinued: {
      bg: 'bg-error-500',
      text: 'text-white',
      border: 'border-error-700',
      icon: '🚫',
      label: 'Série arrêtée',
      message: 'Derniers exemplaires',
    },
  }[rarityType];

  // Tailles
  const sizeClasses = {
    sm: 'text-xs px-sm py-xs',
    md: 'text-sm px-md py-sm',
    lg: 'text-base px-lg py-md',
  }[size];

  const iconSize = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }[size];

  return (
    <div
      className={`
        inline-flex flex-col rounded-lg border-2
        ${config.bg} ${config.text} ${config.border} ${sizeClasses}
        ${animated ? 'animate-pulse' : ''}
        shadow-lg
      `}
      role="status"
      aria-label={`${config.label}: ${customMessage || config.message}`}
    >
      <div className="flex items-center gap-xs">
        <span className={iconSize} aria-hidden="true">
          {config.icon}
        </span>
        <span className="font-heading font-bold">{config.label}</span>
      </div>
      {(customMessage || config.message) && (
        <p className="font-sans text-xs mt-xs opacity-90">
          {customMessage || config.message}
        </p>
      )}
    </div>
  );
};

// ============================================================================
// StockUrgencyIndicator - Combiné (Stock + Rareté si applicable)
// ============================================================================

export interface StockUrgencyIndicatorProps {
  stockQuantity: number;
  isRare?: boolean;
  rarityType?: RarityIndicatorProps['rarityType'];
  lowStockThreshold?: number;
  criticalStockThreshold?: number;
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Composant combiné affichant à la fois l'urgence stock ET la rareté si applicable
 */
export const StockUrgencyIndicator: React.FC<StockUrgencyIndicatorProps> = ({
  stockQuantity,
  isRare = false,
  rarityType = 'rare',
  lowStockThreshold = 3,
  criticalStockThreshold = 1,
  animated = true,
  size = 'md',
}) => {
  const hasUrgency = stockQuantity <= lowStockThreshold && stockQuantity > 0;

  // Si ni urgence ni rareté, ne rien afficher
  if (!hasUrgency && !isRare) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-sm">
      {/* Badge urgence stock */}
      {hasUrgency && (
        <UrgencyBadge
          stockQuantity={stockQuantity}
          lowStockThreshold={lowStockThreshold}
          criticalStockThreshold={criticalStockThreshold}
          animated={animated}
          size={size}
        />
      )}

      {/* Indicateur rareté */}
      {isRare && (
        <RarityIndicator
          rarityType={rarityType}
          animated={animated && !hasUrgency} // Pulse uniquement si pas déjà urgence
          size={size}
        />
      )}
    </div>
  );
};

// ============================================================================
// Helper Hook - Calculer niveau d'urgence
// ============================================================================

/**
 * Hook utilitaire pour calculer le niveau d'urgence selon le stock
 */
export const useStockUrgency = (
  stockQuantity: number,
  lowStockThreshold: number = 3,
  criticalStockThreshold: number = 1
): {
  urgencyLevel: UrgencyLevel;
  shouldShowBadge: boolean;
  isAnimated: boolean;
} => {
  const urgencyLevel: UrgencyLevel =
    stockQuantity <= 0
      ? 'none'
      : stockQuantity <= criticalStockThreshold
        ? 'high'
        : stockQuantity <= lowStockThreshold
          ? 'medium'
          : 'low';

  return {
    urgencyLevel,
    shouldShowBadge: urgencyLevel !== 'none' && urgencyLevel !== 'low',
    isAnimated: urgencyLevel === 'high',
  };
};

// ============================================================================
// Export
// ============================================================================

export default UrgencyBadge;
