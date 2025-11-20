/**
 * 📱 Vue Grid pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * Affichage grid moderne avec cartes optimisées
 */

import { Badge } from '@fafa/ui';
import React from 'react';
import { useCart } from '../../hooks/useCart';
import { type PieceData } from '../../types/pieces-route.types';
import { normalizeImageUrl } from '../../utils/image.utils';
import { hasStockAvailable } from '../../utils/stock.utils';
import { ProductGallery } from './ProductGallery';

interface PiecesGridViewProps {
  pieces: PieceData[];
  onSelectPiece?: (pieceId: number) => void;
  selectedPieces?: number[];
}

/**
 * Helper optimisation images WebP - 200px optimal pour cards
 */
const optimizeImageUrl = (imageUrl: string | undefined, width: number = 200): string => {
  if (!imageUrl) return '';
  
  if (imageUrl.includes('supabase.co/storage')) {
    const match = imageUrl.match(/\/public\/(.+?)(?:\?|$)/);
    if (match) {
      const path = match[1];
      const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
      return `${SUPABASE_URL}/storage/v1/render/image/public/${path}?format=webp&width=${width}&quality=85`;
    }
  }
  
  return imageUrl;
};

/**
 * Vue Grid avec cartes pièces
 * ⚡ Optimisé avec React.memo pour éviter re-renders inutiles
 */
export const PiecesGridView = React.memo(function PiecesGridView({ pieces, onSelectPiece, selectedPieces = [] }: PiecesGridViewProps) {
  const { addToCart } = useCart();
  
  if (pieces.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <div className="text-gray-400 text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-medium text-gray-900 mb-2">
          Aucune pièce trouvée
        </h3>
        <p className="text-gray-500">
          Essayez de modifier vos filtres pour voir plus de résultats
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {pieces.map(piece => {
        const isSelected = selectedPieces.includes(piece.id);
        const hasStock = hasStockAvailable(piece.stock);
        
        return (
          <div 
            key={piece.id}
            className={`bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all duration-300 overflow-hidden group ${
              isSelected ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            {/* Image optimisée WebP */}
            <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden group-hover:shadow-inner transition-shadow">
              <ProductGallery 
                images={piece.images} 
                mainImage={piece.image} 
                alt={`${piece.name} ${piece.brand}${piece.reference ? ` pour véhicule - Réf ${piece.reference}` : ' pièce automobile de qualité'}`}
              />
              
              {/* Badges overlay */}
              <div className="absolute top-2 right-2 flex flex-col gap-1">
                {hasStock ? (
                  <span className="bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 backdrop-blur-sm border border-white/20">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                    En stock
                  </span>
                ) : (
                  <span className="bg-destructive text-destructive-foreground text-xs font-medium px-2 py-1 rounded-full shadow-md">
                    Rupture
                  </span>
                )}
                {piece.quality === 'OES' && (
                  <span className="bg-warning text-warning-foreground text-xs font-medium px-2 py-1 rounded-full shadow-md">
                    🏆 OES
                  </span>
                )}
              </div>

              {/* Checkbox sélection (si mode comparaison) */}
              {onSelectPiece && (
                <button
                  onClick={() => onSelectPiece(piece.id)}
                  className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform"
                >
                  {isSelected && (
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              )}
            </div>

            {/* Contenu carte */}
            <div className="p-4">
              {/* Marque en évidence */}
              <h3 className="text-base font-semibold text-gray-900 uppercase tracking-wide mb-2">
                {piece.brand}
              </h3>

              {/* Désignation (sans répétition) */}
              <h4 className="text-sm text-gray-700 mb-2 line-clamp-2 min-h-[40px] leading-snug">
                {piece.name}
              </h4>

              {/* Référence */}
              <div className="text-xs text-gray-500 mb-3 font-mono bg-gray-50 px-2 py-1 rounded inline-block">
                Réf: {piece.reference}
              </div>

              {/* Prix section */}
              <div className="border-t border-gray-100 pt-3 mt-3">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-2xl font-bold text-gray-900">
                    {typeof piece.price === 'number' ? piece.price.toFixed(2) : piece.priceFormatted}€
                  </div>
                  {piece.delaiLivraison && (
                    <div className="text-xs text-gray-500 font-medium">
                      Livraison {piece.delaiLivraison}j
                    </div>
                  )}
                </div>

                {/* Bouton action */}
                <button 
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    hasStock
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm hover:shadow-md'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                  disabled={!hasStock}
                  onClick={() => {
                    console.log('🛒 Click Ajouter panier, piece:', piece.id, 'hasStock:', hasStock);
                    if (hasStock) {
                      addToCart(piece.id, 1);
                    }
                  }}
                >
                  {hasStock ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Ajouter au panier
                    </span>
                  ) : (
                    'Indisponible'
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}, (prevProps, nextProps) => {
  // ⚡ Optimisation: shallow comparison au lieu de JSON.stringify (10-50x plus rapide)
  // Principe #6 Constitution: Performance-Driven, Not Guess-Driven
  if (prevProps.pieces !== nextProps.pieces) return false;
  if (prevProps.onSelectPiece !== nextProps.onSelectPiece) return false;
  
  // Comparaison optimisée des selectedPieces
  const prevSelected = prevProps.selectedPieces || [];
  const nextSelected = nextProps.selectedPieces || [];
  
  if (prevSelected.length !== nextSelected.length) return false;
  if (prevSelected.length === 0) return true; // Les deux vides
  
  // Vérification rapide: mêmes IDs dans le même ordre (O(n) optimisé)
  return prevSelected.every((id, index) => id === nextSelected[index]);
});
