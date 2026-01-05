/**
 * MobileOptimizedCard - Layout mobile-first pour conversion
 * 
 * Principes mobile-first:
 * - CTA grands et centrés (min 44px touch target)
 * - Espacement optimal (zones de pouce confortables)
 * - Progressive disclosure (infos essentielles d'abord)
 * - Thumb-friendly zones (boutons en bas)
 * - Images optimisées (chargement rapide)
 * 
 * @example
 * ```tsx
 * <MobileProductCard
 *   product={product}
 *   onAddToCart={handleAddToCart}
 *   showCompatibility
 *   thumbFriendly
 * />
 * ```
 */

import { type ReactNode, useState } from 'react';
import { type Vehicle } from './SmartHeader';

// ============================================================================
// TYPES
// ============================================================================

export interface MobileProductCardProps {
  /** Données produit */
  product: {
    id: string;
    name: string;
    brand: string;
    imageUrl: string;
    price: number;
    originalPrice?: number;
    stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
    stockQuantity?: number;
    rating?: number;
    reviewCount?: number;
    oemRef?: string;
    isCompatible?: boolean;
  };
  
  /** Véhicule pour compatibilité */
  vehicle?: Vehicle;
  
  /** Callback ajout panier */
  onAddToCart: (productId: string) => void | Promise<void>;
  
  /** Callback voir détails */
  onViewDetails?: (productId: string) => void;
  
  /** Afficher badge compatibilité */
  showCompatibility?: boolean;
  
  /** Layout thumb-friendly (CTA en bas) */
  thumbFriendly?: boolean;
  
  /** Progressive disclosure (masquer détails secondaires) */
  progressive?: boolean;
  
  /** Afficher preuve sociale */
  showSocialProof?: boolean;
  
  /** Variant d'affichage */
  variant?: 'compact' | 'standard' | 'hero';
}

export interface MobileCartSummaryProps {
  /** Nombre d'articles */
  itemCount: number;
  
  /** Total panier */
  total: number;
  
  /** Frais de livraison */
  shipping?: number;
  
  /** Callback validation */
  onCheckout: () => void;
  
  /** Sticky en bas */
  sticky?: boolean;
  
  /** Afficher économies */
  showSavings?: boolean;
  
  /** Montant économisé */
  savings?: number;
}

export interface ThumbZoneProps {
  /** Position de la zone (bas par défaut) */
  position?: 'bottom' | 'top' | 'both';
  
  /** Contenu de la zone */
  children: ReactNode;
  
  /** Espacement padding */
  padding?: 'compact' | 'comfortable' | 'spacious';
  
  /** Sticky */
  sticky?: boolean;
  
  /** Fond */
  background?: 'white' | 'neutral' | 'transparent';
}

// ============================================================================
// CARTE PRODUIT MOBILE-OPTIMISÉE
// ============================================================================

export function MobileProductCard({
  product,
  vehicle,
  onAddToCart,
  onViewDetails,
  showCompatibility = true,
  thumbFriendly = true,
  progressive = true,
  showSocialProof = false,
  variant = 'standard',
}: MobileProductCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // ========================================
  // HANDLERS
  // ========================================
  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      await onAddToCart(product.id);
    } finally {
      setIsAdding(false);
    }
  };

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(product.id);
    }
  };

  // ========================================
  // CALCULS
  // ========================================
  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const hasLowStock = product.stockQuantity !== undefined && product.stockQuantity <= 3;

  // ========================================
  // CLASSES CSS (MOBILE-FIRST)
  // ========================================
  const cardClasses =
    variant === 'hero'
      ? 'flex flex-col bg-white rounded-xl shadow-xl overflow-hidden'
      : variant === 'compact'
        ? 'flex flex-col bg-white rounded-lg shadow-md overflow-hidden'
        : 'flex flex-col bg-white rounded-xl shadow-lg overflow-hidden';

  const imageHeight =
    variant === 'hero' ? 'h-80' : variant === 'compact' ? 'h-48' : 'h-64';

  return (
    <article className={cardClasses}>
      {/* ========================================
          IMAGE + BADGES
      ======================================== */}
      <div className={`relative ${imageHeight} bg-slate-50 overflow-hidden`}>
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-contain p-4"
          loading="lazy"
        />
        
        {/* Badge réduction */}
        {discount > 0 && (
          <div className="absolute top-3 left-3 px-3 py-1.5 bg-red-700 text-white font-heading font-bold text-sm rounded-full shadow-lg">
            -{discount}%
          </div>
        )}
        
        {/* Badge stock faible */}
        {hasLowStock && (
          <div className="absolute top-3 right-3 px-3 py-1.5 bg-amber-500 text-white font-sans font-semibold text-xs rounded-full shadow-lg animate-pulse-soft">
            🔥 Plus que {product.stockQuantity}!
          </div>
        )}
        
        {/* Badge compatibilité */}
        {showCompatibility && product.isCompatible !== undefined && (
          <div className={`
            absolute bottom-3 left-3 right-3 px-4 py-2 rounded-lg shadow-lg
            ${product.isCompatible
              ? 'bg-green-600 text-white'
              : 'bg-red-700 text-white'}
            font-sans font-semibold text-sm text-center
          `}>
            {product.isCompatible ? '✅ Compatible' : '⚠️ Non compatible'}
            {vehicle && (
              <span className="block text-xs opacity-90 mt-0.5">
                {vehicle.brand} {vehicle.model}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ========================================
          CONTENU PRINCIPAL
      ======================================== */}
      <div className="flex-1 p-4 flex flex-col gap-3">
        {/* Marque */}
        <p className="text-xs font-sans font-semibold text-gray-400 uppercase tracking-wide">
          {product.brand}
        </p>
        
        {/* Nom produit */}
        <h3 className="text-lg font-heading font-bold text-gray-900 line-clamp-2">
          {product.name}
        </h3>
        
        {/* Prix */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-heading font-bold text-red-500">
            {product.price.toFixed(2)} €
          </span>
          {product.originalPrice && (
            <span className="text-sm font-sans text-gray-400 line-through">
              {product.originalPrice.toFixed(2)} €
            </span>
          )}
        </div>
        
        {/* Rating + Reviews (progressive disclosure) */}
        {!progressive || isExpanded ? (
          showSocialProof && product.rating && (
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={i < Math.floor(product.rating!) ? 'text-amber-500' : 'text-gray-300'}
                  >
                    ⭐
                  </span>
                ))}
              </div>
              <span className="text-sm font-sans text-gray-500">
                {product.rating.toFixed(1)}
              </span>
              {product.reviewCount && (
                <span className="text-xs font-sans text-gray-400">
                  ({product.reviewCount} avis)
                </span>
              )}
            </div>
          )
        ) : null}
        
        {/* Référence OEM (progressive disclosure) */}
        {!progressive || isExpanded ? (
          product.oemRef && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-md">
              <span className="text-xs font-sans text-gray-400">Réf. OEM</span>
              <span className="text-sm font-mono font-semibold text-blue-700">
                {product.oemRef}
              </span>
            </div>
          )
        ) : null}
        
        {/* Bouton "Voir plus" (progressive disclosure) */}
        {progressive && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="text-sm font-sans font-semibold text-blue-700 hover:text-blue-800 transition-colors self-start"
          >
            Voir plus de détails →
          </button>
        )}
      </div>

      {/* ========================================
          ZONE THUMB-FRIENDLY (CTA EN BAS)
      ======================================== */}
      {thumbFriendly ? (
        <ThumbZone position="bottom" padding="comfortable" background="white">
          <div className="flex flex-col gap-2">
            {/* CTA Principal - GRAND (min 56px) */}
            <button
              onClick={handleAddToCart}
              disabled={product.stockStatus === 'out-of-stock' || isAdding}
              className={`
                w-full min-h-[56px] px-6 py-4 rounded-lg
                font-heading font-bold text-lg text-white
                bg-gradient-to-r from-red-500 to-orange-500
                hover:from-red-600 hover:to-orange-600
                active:from-red-700 active:to-orange-700
                disabled:opacity-50 disabled:cursor-not-allowed
                shadow-lg hover:shadow-xl active:shadow-md
                transition-all duration-300
                flex items-center justify-center gap-2
              `}
            >
              {isAdding ? (
                <>
                  <LoadingSpinner />
                  <span>Ajout...</span>
                </>
              ) : product.stockStatus === 'out-of-stock' ? (
                'Rupture de stock'
              ) : (
                <>
                  <span>🛒</span>
                  <span>Ajouter au panier</span>
                </>
              )}
            </button>
            
            {/* CTA Secondaire - Détails */}
            {onViewDetails && (
              <button
                onClick={handleViewDetails}
                className="
                  w-full min-h-[48px] px-6 py-3 rounded-lg
                  font-sans font-semibold text-base text-blue-700
                  bg-transparent border-2 border-blue-700
                  hover:bg-blue-700 hover:text-white
                  active:bg-blue-800
                  transition-all duration-200
                "
              >
                Voir les détails
              </button>
            )}
          </div>
        </ThumbZone>
      ) : (
        // Layout classique (non thumb-friendly)
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleAddToCart}
            disabled={product.stockStatus === 'out-of-stock' || isAdding}
            className="w-full px-6 py-3 bg-red-500 text-white font-heading font-bold rounded-lg hover:bg-red-600 active:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {isAdding ? 'Ajout...' : product.stockStatus === 'out-of-stock' ? 'Rupture' : 'Ajouter'}
          </button>
        </div>
      )}
    </article>
  );
}

// ============================================================================
// RÉSUMÉ PANIER MOBILE (STICKY)
// ============================================================================

export function MobileCartSummary({
  itemCount,
  total,
  shipping = 0,
  onCheckout,
  sticky = true,
  showSavings = false,
  savings = 0,
}: MobileCartSummaryProps) {
  const grandTotal = total + shipping;
  const freeShippingThreshold = 50;
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - total);

  return (
    <div
      className={`
        ${sticky ? 'fixed bottom-0 left-0 right-0 z-40' : ''}
        bg-white border-t-2 border-gray-200 shadow-2xl
      `}
    >
      <div className="max-w-7xl mx-auto p-4 space-y-3">
        {/* Progress livraison gratuite */}
        {remainingForFreeShipping > 0 && (
          <div className="bg-amber-50 border-l-4 border-amber-500 px-3 py-2 rounded">
            <p className="text-sm font-sans text-gray-500">
              Plus que <span className="font-bold text-amber-500">{remainingForFreeShipping.toFixed(2)} €</span> pour la livraison gratuite! 🚚
            </p>
          </div>
        )}
        
        {/* Totaux */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-sans text-gray-400">
              {itemCount} article{itemCount > 1 ? 's' : ''}
            </span>
            {showSavings && savings > 0 && (
              <span className="text-xs font-sans font-semibold text-green-600">
                Économie: {savings.toFixed(2)} €
              </span>
            )}
          </div>
          
          <div className="text-right">
            <p className="text-2xl font-heading font-bold text-gray-900">
              {grandTotal.toFixed(2)} €
            </p>
            {shipping > 0 && (
              <p className="text-xs font-sans text-gray-400">
                (dont {shipping.toFixed(2)} € livraison)
              </p>
            )}
          </div>
        </div>
        
        {/* CTA Checkout - TRÈS GRAND (min 64px) */}
        <button
          onClick={onCheckout}
          className="
            w-full min-h-[64px] px-8 py-5 rounded-xl
            font-heading font-bold text-xl text-white
            bg-gradient-to-r from-green-600 to-green-500
            hover:from-green-700 hover:to-green-600
            active:from-green-800 active:to-green-700
            shadow-2xl hover:shadow-3xl active:shadow-xl
            transition-all duration-300
            flex items-center justify-center gap-3
          "
        >
          <span>🛒</span>
          <span>Valider ma commande</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// ZONE THUMB-FRIENDLY (RÉUTILISABLE)
// ============================================================================

export function ThumbZone({
  position = 'bottom',
  children,
  padding = 'comfortable',
  sticky = false,
  background = 'white',
}: ThumbZoneProps) {
  const paddingClasses = {
    compact: 'p-3',
    comfortable: 'p-4',
    spacious: 'p-6',
  };

  const backgroundClasses = {
    white: 'bg-white',
    neutral: 'bg-slate-50',
    transparent: 'bg-transparent',
  };

  const positionClasses = sticky
    ? position === 'bottom'
      ? 'fixed bottom-0 left-0 right-0 z-30'
      : position === 'top'
        ? 'fixed top-0 left-0 right-0 z-30'
        : ''
    : '';

  const borderClasses =
    position === 'bottom' ? 'border-t border-gray-200' : position === 'top' ? 'border-b border-gray-200' : '';

  return (
    <div
      className={`
        ${paddingClasses[padding]}
        ${backgroundClasses[background]}
        ${positionClasses}
        ${borderClasses}
        ${sticky ? 'shadow-2xl' : ''}
      `}
    >
      {children}
    </div>
  );
}

// ============================================================================
// LISTE PRODUITS MOBILE (OPTIMISÉE)
// ============================================================================

interface MobileProductListProps {
  products: MobileProductCardProps['product'][];
  onAddToCart: (productId: string) => void;
  vehicle?: Vehicle;
  spacing?: 'compact' | 'comfortable';
  showCompatibility?: boolean;
}

export function MobileProductList({
  products,
  onAddToCart,
  vehicle,
  spacing = 'comfortable',
  showCompatibility = true,
}: MobileProductListProps) {
  const gapClasses = spacing === 'compact' ? 'gap-4' : 'gap-6';

  return (
    <div className={`flex flex-col ${gapClasses} pb-24`}>
      {products.map((product) => (
        <MobileProductCard
          key={product.id}
          product={product}
          vehicle={vehicle}
          onAddToCart={onAddToCart}
          showCompatibility={showCompatibility}
          thumbFriendly
          progressive
        />
      ))}
    </div>
  );
}

// ============================================================================
// COMPOSANTS AUXILIAIRES
// ============================================================================

function LoadingSpinner() {
  return (
    <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
