/**
 * ProductComparator - Comparateur de pièces auto côte-à-côte
 * 
 * Permet de comparer jusqu'à 4 produits simultanément sur plusieurs critères:
 * - Prix et remises
 * - Compatibilité véhicule
 * - Stock disponible
 * - Référence OEM
 * - Spécifications techniques
 * 
 * Design System: Primary (CTA), Success (compatible), Error (incompatible), Warning (stock faible), Neutral (backgrounds)
 * Typographie: font-heading (noms), font-mono (OEM/prix), font-sans (specs)
 * Espacement: 8px grid (gap-md, p-lg)
 */

import React, { useState } from 'react';
import { type Vehicle } from './SmartHeader';

// ============================================================================
// Types
// ============================================================================

export interface ComparableProduct {
  id: string;
  name: string;
  brand: string;
  oemRef: string;
  imageUrl: string;
  price: number;
  originalPrice?: number;
  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
  stockQuantity?: number;
  isCompatible: boolean;
  specifications?: Record<string, string | number>;
  deliveryDays?: number;
}

export interface ProductComparatorProps {
  /** Liste des produits à comparer (max 4) */
  products: ComparableProduct[];
  
  /** Véhicule de référence pour compatibilité */
  vehicle?: Vehicle;
  
  /** Callback pour ajouter au panier */
  onAddToCart?: (productId: string) => void;
  
  /** Callback pour retirer du comparateur */
  onRemoveProduct?: (productId: string) => void;
  
  /** Specs techniques à afficher (filtrage) */
  displayedSpecs?: string[];
  
  /** Afficher le véhicule de référence */
  showVehicle?: boolean;
}

// ============================================================================
// Composant principal
// ============================================================================

export const ProductComparator: React.FC<ProductComparatorProps> = ({
  products: initialProducts,
  vehicle,
  onAddToCart,
  onRemoveProduct,
  displayedSpecs,
  showVehicle = true,
}) => {
  // Limiter à 4 produits max
  const products = initialProducts.slice(0, 4);

  // State
  const [expandedSpecs, setExpandedSpecs] = useState(false);

  // Helper: Calculer remise
  const getDiscount = (product: ComparableProduct) => {
    if (!product.originalPrice || product.originalPrice <= product.price) return 0;
    return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
  };

  // Helper: Badge stock
  const getStockBadge = (status: ComparableProduct['stockStatus'], quantity?: number) => {
    switch (status) {
      case 'in-stock':
        return {
          color: 'bg-success-500',
          text: 'En stock',
          icon: '✓',
        };
      case 'low-stock':
        return {
          color: 'bg-warning-500',
          text: quantity ? `${quantity} restant${quantity > 1 ? 's' : ''}` : 'Stock faible',
          icon: '⚠',
        };
      case 'out-of-stock':
        return {
          color: 'bg-error-500',
          text: 'Rupture',
          icon: '✕',
        };
    }
  };

  // Collecter toutes les specs disponibles
  const allSpecKeys = React.useMemo(() => {
    const keys = new Set<string>();
    products.forEach((p) => {
      if (p.specifications) {
        Object.keys(p.specifications).forEach((key) => keys.add(key));
      }
    });
    return Array.from(keys);
  }, [products]);

  const specsToDisplay = displayedSpecs || allSpecKeys;

  if (products.length === 0) {
    return (
      <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-2xl text-center">
        <p className="font-sans text-neutral-600">Aucun produit à comparer</p>
        <p className="font-sans text-sm text-neutral-500 mt-sm">
          Ajoutez des produits au comparateur depuis le catalogue
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white">
      {/* Header: Véhicule de référence */}
      {showVehicle && vehicle && (
        <div className="bg-secondary-50 border-b-2 border-secondary-500 p-md mb-lg">
          <div className="max-w-7xl mx-auto">
            <p className="font-heading text-secondary-700">
              🚗 Comparaison pour{' '}
              <span className="font-bold">
                {vehicle.brand} {vehicle.model} {vehicle.engine ? `${vehicle.engine} ` : ''}
                ({vehicle.year})
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Tableau comparatif */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[800px]">
          <tbody>
            {/* Ligne Images */}
            <tr className="border-b border-neutral-200">
              <td className="p-md font-heading text-neutral-700 bg-neutral-50 sticky left-0 z-10 min-w-[150px]">
                Image
              </td>
              {products.map((product) => (
                <td key={product.id} className="p-md text-center bg-white">
                  <div className="relative">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-40 object-contain rounded-md border border-neutral-200"
                    />
                    {onRemoveProduct && (
                      <button
                        onClick={() => onRemoveProduct(product.id)}
                        className="absolute top-0 right-0 bg-error-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-error-600"
                        aria-label="Retirer du comparateur"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </td>
              ))}
            </tr>

            {/* Ligne Nom */}
            <tr className="border-b border-neutral-200">
              <td className="p-md font-heading text-neutral-700 bg-neutral-50 sticky left-0 z-10">
                Produit
              </td>
              {products.map((product) => (
                <td key={product.id} className="p-md bg-white">
                  <h3 className="font-heading text-neutral-900 mb-xs">{product.name}</h3>
                  <p className="font-sans text-sm text-neutral-600">{product.brand}</p>
                </td>
              ))}
            </tr>

            {/* Ligne Référence OEM */}
            <tr className="border-b border-neutral-200">
              <td className="p-md font-heading text-neutral-700 bg-neutral-50 sticky left-0 z-10">
                Réf. OEM
              </td>
              {products.map((product) => (
                <td key={product.id} className="p-md text-center bg-white">
                  <span className="font-mono text-sm text-neutral-700">{product.oemRef}</span>
                </td>
              ))}
            </tr>

            {/* Ligne Prix */}
            <tr className="border-b border-neutral-200 bg-primary-50">
              <td className="p-md font-heading text-neutral-700 bg-neutral-50 sticky left-0 z-10">
                Prix
              </td>
              {products.map((product) => {
                const discount = getDiscount(product);
                return (
                  <td key={product.id} className="p-md text-center">
                    <div className="space-y-xs">
                      <p className="font-mono text-2xl font-bold text-primary-500">
                        {product.price.toFixed(2)} €
                      </p>
                      {discount > 0 && (
                        <>
                          <p className="font-mono text-sm text-neutral-500 line-through">
                            {product.originalPrice?.toFixed(2)} €
                          </p>
                          <span className="inline-block bg-error-500 text-white text-xs font-bold px-sm py-xs rounded">
                            -{discount}%
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Ligne Compatibilité */}
            <tr className="border-b border-neutral-200">
              <td className="p-md font-heading text-neutral-700 bg-neutral-50 sticky left-0 z-10">
                Compatibilité
              </td>
              {products.map((product) => (
                <td key={product.id} className="p-md text-center bg-white">
                  <span
                    className={`inline-block px-md py-sm rounded-md font-heading text-sm ${
                      product.isCompatible
                        ? 'bg-success-500 text-white'
                        : 'bg-error-500 text-white'
                    }`}
                  >
                    {product.isCompatible ? '✓ Compatible' : '✕ Incompatible'}
                  </span>
                </td>
              ))}
            </tr>

            {/* Ligne Stock */}
            <tr className="border-b border-neutral-200">
              <td className="p-md font-heading text-neutral-700 bg-neutral-50 sticky left-0 z-10">
                Disponibilité
              </td>
              {products.map((product) => {
                const badge = getStockBadge(product.stockStatus, product.stockQuantity);
                return (
                  <td key={product.id} className="p-md text-center bg-white">
                    <span
                      className={`inline-block ${badge.color} text-white px-md py-sm rounded-md font-sans text-sm`}
                    >
                      {badge.icon} {badge.text}
                    </span>
                  </td>
                );
              })}
            </tr>

            {/* Ligne Livraison */}
            <tr className="border-b border-neutral-200">
              <td className="p-md font-heading text-neutral-700 bg-neutral-50 sticky left-0 z-10">
                Livraison
              </td>
              {products.map((product) => (
                <td key={product.id} className="p-md text-center bg-white">
                  <span className="font-sans text-sm text-neutral-700">
                    {product.deliveryDays ? `${product.deliveryDays} jour${product.deliveryDays > 1 ? 's' : ''}` : '24-48h'}
                  </span>
                </td>
              ))}
            </tr>

            {/* Lignes Spécifications (optionnelles) */}
            {specsToDisplay.length > 0 && (
              <>
                <tr className="border-b-2 border-neutral-300 bg-neutral-100">
                  <td
                    colSpan={products.length + 1}
                    className="p-md font-heading text-neutral-900 sticky left-0 z-10"
                  >
                    <button
                      onClick={() => setExpandedSpecs(!expandedSpecs)}
                      className="flex items-center gap-sm hover:text-secondary-500 transition-colors"
                    >
                      <span>{expandedSpecs ? '▼' : '▶'}</span>
                      <span>Spécifications techniques</span>
                    </button>
                  </td>
                </tr>
                {expandedSpecs &&
                  specsToDisplay.map((specKey) => (
                    <tr key={specKey} className="border-b border-neutral-200">
                      <td className="p-md font-sans text-sm text-neutral-700 bg-neutral-50 sticky left-0 z-10 capitalize">
                        {specKey.replace(/_/g, ' ')}
                      </td>
                      {products.map((product) => (
                        <td key={product.id} className="p-md text-center bg-white">
                          <span className="font-sans text-sm text-neutral-700">
                            {product.specifications?.[specKey] || '—'}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
              </>
            )}

            {/* Ligne Actions */}
            <tr className="bg-neutral-50">
              <td className="p-md font-heading text-neutral-700 sticky left-0 z-10">Actions</td>
              {products.map((product) => (
                <td key={product.id} className="p-md text-center">
                  <button
                    onClick={() => onAddToCart?.(product.id)}
                    disabled={!product.isCompatible || product.stockStatus === 'out-of-stock'}
                    className={`
                      w-full font-heading px-lg py-md rounded-lg transition-colors duration-200
                      ${
                        product.isCompatible && product.stockStatus !== 'out-of-stock'
                          ? 'bg-primary-500 hover:bg-primary-600 text-white'
                          : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                      }
                    `}
                  >
                    {product.stockStatus === 'out-of-stock'
                      ? 'Indisponible'
                      : !product.isCompatible
                        ? 'Non compatible'
                        : 'Ajouter au panier'}
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer: Aide */}
      {products.length < 4 && (
        <div className="mt-lg p-md bg-secondary-50 rounded-md">
          <p className="font-sans text-sm text-secondary-700 text-center">
            💡 Vous pouvez comparer jusqu'à 4 produits simultanément. Ajoutez-en depuis le
            catalogue !
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Export
// ============================================================================

export default ProductComparator;
