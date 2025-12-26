/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛒 PRODUCT CARD - Optimisée Conversion E-Commerce
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Carte produit optimisée pour maximiser la conversion avec :
 * • Image claire avec zoom au hover
 * • Référence OEM en Roboto Mono (précision)
 * • Badge stock dynamique (vert = en stock, rouge = rupture)
 * • Prix + remise visuellement claire
 * • CTA unique (rouge Primary) sans distraction
 * • Focus sur l'action d'achat
 * 
 * Design System intégré :
 * • Primary #FF3B30 → CTA "Ajouter au panier"
 * • Success #27AE60 → Badge "En stock"
 * • Error #C0392B → Badge "Rupture"
 * • Warning #F39C12 → Badge "Stock faible"
 * • Roboto Mono → Référence OEM
 * • Montserrat Bold → Nom produit
 * • Inter Regular → Description
 * • Espacement 8px grid
 */

import { useState } from 'react';

// Types
interface ProductCardProps {
  // Identifiant unique
  id: string;
  
  // Informations produit
  name: string;
  description?: string;
  oemRef: string;
  
  // Image
  imageUrl: string;
  imageAlt?: string;
  
  // Prix
  price: number;
  originalPrice?: number; // Prix avant remise
  discountPercent?: number; // % de remise
  
  // Stock
  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
  stockQuantity?: number;
  
  // Compatibilité (optionnel)
  isCompatible?: boolean;
  compatibilityNote?: string;
  
  // Actions
  onAddToCart?: (productId: string) => void;
  onImageClick?: (productId: string) => void;
  
  // Options
  showDescription?: boolean;
  showCompatibility?: boolean;
  compactMode?: boolean;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 PRODUCT CARD COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function ProductCard({
  id,
  name,
  description,
  oemRef,
  imageUrl,
  imageAlt,
  price,
  originalPrice,
  discountPercent,
  stockStatus,
  stockQuantity,
  isCompatible = true,
  compatibilityNote,
  onAddToCart,
  onImageClick,
  showDescription = true,
  showCompatibility = true,
  compactMode = false,
}: ProductCardProps) {
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Helper: Calculer remise si non fournie
  const calculatedDiscount = discountPercent || 
    (originalPrice && originalPrice > price 
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0);

  // Helper: Badge stock (couleur + texte)
  const stockBadge = {
    'in-stock': {
      color: 'bg-success-500',
      textColor: 'text-white',
      icon: '✓',
      label: 'En stock',
    },
    'low-stock': {
      color: 'bg-warning-500',
      textColor: 'text-white',
      icon: '⚠',
      label: stockQuantity ? `${stockQuantity} restant${stockQuantity > 1 ? 's' : ''}` : 'Stock faible',
    },
    'out-of-stock': {
      color: 'bg-error-500',
      textColor: 'text-white',
      icon: '✕',
      label: 'Rupture de stock',
    },
  }[stockStatus];

  // Handle add to cart
  const handleAddToCart = async () => {
    if (stockStatus === 'out-of-stock') return;
    
    setIsAddingToCart(true);
    
    try {
      await onAddToCart?.(id);
      
      // Animation feedback (optionnel)
      setTimeout(() => {
        setIsAddingToCart(false);
      }, 1000);
    } catch (error) {
      console.error('Erreur ajout panier:', error);
      setIsAddingToCart(false);
    }
  };

  return (
    <article
      className={`
        bg-white rounded-lg shadow-md border border-neutral-200
        hover:shadow-xl hover:border-neutral-300
        transition-all duration-300
        ${compactMode ? 'p-sm' : 'p-md'}
        relative
        group
      `}
    >
      {/* 
        ═════════════════════════════════════════════════════════════════════
        IMAGE SECTION (Zoom au hover)
        ═════════════════════════════════════════════════════════════════════
        • aspect-square → Ratio 1:1 pour cohérence visuelle
        • overflow-hidden → Pas de débordement lors du zoom
        • cursor-pointer → Indique cliquable
        • transform scale au hover → Effet zoom
      */}
      <div
        className={`
          relative 
          ${compactMode ? 'aspect-square mb-sm' : 'aspect-[4/3] mb-md'}
          overflow-hidden rounded-lg
          bg-neutral-50
          cursor-pointer
        `}
        onClick={() => onImageClick?.(id)}
        onMouseEnter={() => setIsImageZoomed(true)}
        onMouseLeave={() => setIsImageZoomed(false)}
      >
        {/* Image produit */}
        <img
          src={imageUrl}
          alt={imageAlt || name}
          width={400}
          height={300}
          loading="lazy"
          decoding="async"
          className={`
            w-full h-full object-cover
            transition-transform duration-500
            ${isImageZoomed ? 'scale-110' : 'scale-100'}
          `}
        />

        {/* 
          Badge Remise (si applicable)
          • Position: top-left
          • bg-error-500 → Urgence visuelle
          • font-heading → Impact
        */}
        {calculatedDiscount > 0 && (
          <div className="absolute top-xs left-xs">
            <span className="
              bg-error-500 text-white
              px-sm py-xs
              font-heading text-sm font-bold
              rounded
              shadow-md
            ">
              -{calculatedDiscount}%
            </span>
          </div>
        )}

        {/* 
          Badge Stock (si applicable)
          • Position: top-right
          • Couleur dynamique selon status
        */}
        <div className="absolute top-xs right-xs">
          <span className={`
            ${stockBadge.color} ${stockBadge.textColor}
            px-sm py-xs
            font-sans text-xs font-semibold
            rounded
            shadow-md
            flex items-center gap-xs
          `}>
            <span>{stockBadge.icon}</span>
            <span>{stockBadge.label}</span>
          </span>
        </div>

        {/* 
          Badge Compatibilité (si applicable et activé)
          • Position: bottom-left
          • Success = compatible, Error = incompatible
        */}
        {showCompatibility && isCompatible !== undefined && (
          <div className="absolute bottom-xs left-xs">
            <span className={`
              ${isCompatible ? 'bg-success-500' : 'bg-error-500'}
              text-white
              px-sm py-xs
              font-sans text-xs font-semibold
              rounded
              shadow-md
            `}>
              {isCompatible ? '✓ Compatible' : '✕ Incompatible'}
            </span>
          </div>
        )}

        {/* Overlay zoom (effet visuel) */}
        <div className={`
          absolute inset-0
          bg-black/0 group-hover:bg-black/5
          transition-colors duration-300
          pointer-events-none
        `} />
      </div>

      {/* 
        ═════════════════════════════════════════════════════════════════════
        CONTENT SECTION
        ═════════════════════════════════════════════════════════════════════
      */}
      <div className={compactMode ? 'space-y-xs' : 'space-y-sm'}>
        {/* 
          Référence OEM (Roboto Mono)
          • font-mono → Précision technique
          • text-xs → Discret mais lisible
          • bg-neutral-100 → Contraste subtil
        */}
        <div>
          <code className="
            font-mono text-xs text-neutral-600
            bg-neutral-100
            px-xs py-xs
            rounded
            inline-block
          ">
            REF: {oemRef}
          </code>
        </div>

        {/* 
          Nom Produit (Montserrat Bold)
          • font-heading → Impact visuel
          • text-lg/xl → Hiérarchie claire
          • line-clamp-2 → Max 2 lignes
        */}
        <h3 className={`
          font-heading font-bold text-neutral-900
          ${compactMode ? 'text-base' : 'text-lg'}
          line-clamp-2
        `}>
          {name}
        </h3>

        {/* 
          Description (Inter Regular) - Optionnelle
          • font-sans → Lisibilité
          • text-sm → Hiérarchie secondaire
          • line-clamp-2 → Max 2 lignes
        */}
        {showDescription && description && !compactMode && (
          <p className="
            font-sans text-sm text-neutral-600
            line-clamp-2
          ">
            {description}
          </p>
        )}

        {/* 
          Note Compatibilité - Optionnelle
          • Affichée uniquement si présente
        */}
        {showCompatibility && compatibilityNote && (
          <p className="
            font-sans text-xs text-neutral-500
            italic
          ">
            {compatibilityNote}
          </p>
        )}

        {/* 
          ═════════════════════════════════════════════════════════════════
          SECTION PRIX (Focus conversion)
          ═════════════════════════════════════════════════════════════════
          • Prix actuel en gros (Roboto Mono)
          • Prix original barré si remise
          • Économie calculée affichée
        */}
        <div className={compactMode ? 'mt-sm' : 'mt-md'}>
          {/* Prix barré (si remise) */}
          {originalPrice && originalPrice > price && (
            <div className="flex items-center gap-xs mb-xs">
              <span className="
                font-mono text-sm text-neutral-400
                line-through
              ">
                {originalPrice.toFixed(2)} €
              </span>
              <span className="
                font-sans text-xs text-error-500 font-semibold
              ">
                Économisez {(originalPrice - price).toFixed(2)} €
              </span>
            </div>
          )}

          {/* Prix actuel (Roboto Mono) */}
          <div className={`
            font-mono font-bold text-neutral-900
            ${compactMode ? 'text-2xl' : 'text-3xl'}
          `}>
            {price.toFixed(2)} <span className="text-xl">€</span>
          </div>

          {/* TVA indication */}
          <p className="font-sans text-xs text-neutral-500 mt-xs">
            TTC • Livraison gratuite dès 50€
          </p>
        </div>

        {/* 
          ═════════════════════════════════════════════════════════════════
          CTA UNIQUE (Primary Rouge)
          ═════════════════════════════════════════════════════════════════
          • bg-primary-500 → Action urgente
          • Full width → Maximum visibilité
          • Disabled si rupture stock
          • Animation au clic
          • PAS de bouton secondaire = pas de distraction
        */}
        <button
          onClick={handleAddToCart}
          disabled={stockStatus === 'out-of-stock' || isAddingToCart}
          className={`
            w-full
            ${compactMode ? 'py-sm px-md' : 'py-md px-lg'}
            ${
              stockStatus === 'out-of-stock'
                ? 'bg-neutral-300 cursor-not-allowed'
                : isAddingToCart
                ? 'bg-primary-600 cursor-wait'
                : 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700'
            }
            text-white
            font-heading font-bold
            ${compactMode ? 'text-sm' : 'text-base'}
            rounded-lg
            shadow-md hover:shadow-lg
            transition-all duration-200
            flex items-center justify-center gap-sm
          `}
        >
          {isAddingToCart ? (
            <>
              {/* Spinner animation */}
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Ajout en cours...</span>
            </>
          ) : stockStatus === 'out-of-stock' ? (
            <>
              <span>✕</span>
              <span>Indisponible</span>
            </>
          ) : (
            <>
              {/* Icône panier */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span>Ajouter au panier</span>
            </>
          )}
        </button>

        {/* 
          Message stock faible (Warning)
          • Visible uniquement si low-stock
          • Crée urgence sans être CTA
        */}
        {stockStatus === 'low-stock' && (
          <p className="
            font-sans text-xs text-warning-700
            bg-warning-50
            border border-warning-200
            px-sm py-xs
            rounded
            text-center
            mt-xs
          ">
            ⚠ Dernières pièces disponibles
          </p>
        )}
      </div>
    </article>
  );
}

export default ProductCard;
