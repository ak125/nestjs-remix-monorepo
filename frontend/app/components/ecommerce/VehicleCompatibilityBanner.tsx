/**
 * VehicleCompatibilityBanner - Bannière compatibilité véhicule proéminente
 * 
 * Affiche de manière claire et rassurante la compatibilité d'une pièce avec le véhicule sélectionné.
 * 
 * Features:
 * - Affichage proéminent "Convient à Peugeot 208 1.2 PureTech 2016 ✅"
 * - Couleur Success (vert) pour compatibilité, Error (rouge) pour incompatibilité
 * - Option sticky pour suivre le scroll
 * - Bouton "Changer de véhicule"
 * - Responsive mobile-first
 * 
 * Design System: Success (compatible), Error (incompatible), Secondary (boutons), Neutral (backgrounds)
 * Typographie: font-heading (véhicule), font-sans (message), font-mono (specs techniques)
 * Espacement: 8px grid (p-md, gap-sm)
 */

import React from 'react';
import { type Vehicle } from './SmartHeader';

// ============================================================================
// Types
// ============================================================================

export interface VehicleCompatibilityBannerProps {
  /** Véhicule sélectionné */
  vehicle: Vehicle;
  
  /** Compatibilité de la pièce/page actuelle */
  isCompatible: boolean;
  
  /** Message de compatibilité personnalisé (optionnel) */
  compatibilityMessage?: string;
  
  /** Afficher en sticky (suit le scroll) */
  isSticky?: boolean;
  
  /** Position sticky (top offset en px) */
  stickyOffset?: number;
  
  /** Callback pour changer de véhicule */
  onChangeVehicle?: () => void;
  
  /** Afficher bouton "Changer de véhicule" */
  showChangeButton?: boolean;
  
  /** Mode compact (pour header par exemple) */
  compact?: boolean;
  
  /** Classe CSS additionnelle */
  className?: string;
}

// ============================================================================
// Composant principal
// ============================================================================

export const VehicleCompatibilityBanner: React.FC<VehicleCompatibilityBannerProps> = ({
  vehicle,
  isCompatible,
  compatibilityMessage,
  isSticky = false,
  stickyOffset = 0,
  onChangeVehicle,
  showChangeButton = true,
  compact = false,
  className = '',
}) => {
  // Message par défaut selon compatibilité
  const defaultMessage = isCompatible
    ? `Convient à votre ${vehicle.brand} ${vehicle.model} ${vehicle.engine ? vehicle.engine + ' ' : ''}(${vehicle.year})`
    : `Non compatible avec votre ${vehicle.brand} ${vehicle.model} ${vehicle.engine ? vehicle.engine + ' ' : ''}(${vehicle.year})`;

  const message = compatibilityMessage || defaultMessage;

  // Classes CSS dynamiques
  const bgColorClass = isCompatible ? 'bg-success-500' : 'bg-error-500';
  const iconEmoji = isCompatible ? '✅' : '⚠️';

  const containerClasses = `
    w-full ${bgColorClass} text-white
    ${isSticky ? 'sticky z-40' : 'relative'}
    ${compact ? 'py-sm px-md' : 'py-md px-md md:px-lg'}
    transition-all duration-300 shadow-md
    ${className}
  `.trim();

  const stickyStyle = isSticky ? { top: `${stickyOffset}px` } : undefined;

  return (
    <div className={containerClasses} style={stickyStyle}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-md flex-wrap">
          {/* Message principal */}
          <div className="flex items-center gap-sm flex-1 min-w-0">
            {/* Icône */}
            <span className="text-2xl flex-shrink-0" aria-hidden="true">
              {iconEmoji}
            </span>

            {/* Texte */}
            <div className="flex-1 min-w-0">
              {compact ? (
                // Mode compact: une seule ligne
                <p className="font-heading text-sm md:text-base truncate">
                  {message}
                </p>
              ) : (
                // Mode normal: multi-lignes
                <>
                  <p className="font-heading text-base md:text-lg mb-xs">
                    {isCompatible ? '✓ Pièce compatible' : '✕ Pièce incompatible'}
                  </p>
                  <p className="font-sans text-sm md:text-base opacity-90">
                    {message}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Bouton "Changer de véhicule" */}
          {showChangeButton && onChangeVehicle && (
            <button
              onClick={onChangeVehicle}
              className="
                bg-white hover:bg-neutral-100
                text-neutral-900
                font-heading text-sm
                px-md py-sm rounded-md
                transition-colors duration-200
                flex-shrink-0
                border border-transparent hover:border-neutral-300
              "
              aria-label="Changer de véhicule"
            >
              Changer de véhicule
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Variantes pré-configurées
// ============================================================================

/**
 * Bannière sticky en haut de page (sous le header)
 */
export const StickyCompatibilityBanner: React.FC<
  Omit<VehicleCompatibilityBannerProps, 'isSticky' | 'stickyOffset'>
> = (props) => {
  return (
    <VehicleCompatibilityBanner
      {...props}
      isSticky={true}
      stickyOffset={60} // Sous un header de 60px typiquement
    />
  );
};

/**
 * Bannière compacte pour intégration dans ProductCard ou catalogue
 */
export const CompactCompatibilityBanner: React.FC<VehicleCompatibilityBannerProps> = (props) => {
  return (
    <VehicleCompatibilityBanner
      {...props}
      compact={true}
      showChangeButton={false}
    />
  );
};

// ============================================================================
// Export par défaut
// ============================================================================

export default VehicleCompatibilityBanner;
