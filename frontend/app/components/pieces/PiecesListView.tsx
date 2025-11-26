/**
 * 📋 Vue Liste pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * Affichage liste dense avec détails complets
 */

import { Badge } from '@fafa/ui';
import React, { useState } from 'react';
import { useCart } from '../../hooks/useCart';
import { type PieceData } from '../../types/pieces-route.types';
import { normalizeImageUrl } from '../../utils/image.utils';
import { hasStockAvailable } from '../../utils/stock.utils';
import { StarRating } from '../common/StarRating';

interface PiecesListViewProps {
  pieces: PieceData[];
  onSelectPiece?: (pieceId: number) => void;
  selectedPieces?: number[];
}

/**
 * Helper optimisation images WebP (96px pour miniatures liste)
 */
const optimizeImageUrl = (imageUrl: string | undefined, width: number = 96): string => {
  if (!imageUrl) return '';
  
  if (imageUrl.includes('supabase.co/storage')) {
    const match = imageUrl.match(/\/public\/(.+?)(?:\?|$)/);
    if (match) {
      const path = match[1];
      const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
      // 🚀 FIX: Utilisation de object/public car le service de transformation (render/image) semble instable
      return `${SUPABASE_URL}/storage/v1/object/public/${path}`;
    }
  }
  
  return imageUrl;
};

/**
 * Vue Liste compacte avec toutes les infos
 * ⚡ Optimisé avec React.memo pour éviter re-renders inutiles
 */
export const PiecesListView = React.memo(function PiecesListView({ pieces, onSelectPiece, selectedPieces = [] }: PiecesListViewProps) {
  const { addToCart } = useCart();

  // État pour gérer le loading par produit (anti-double-clic)
  const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());

  // Handler anti-double-clic pour ajout panier
  const handleAddToCart = (pieceId: number) => {
    // Vérifier si déjà en cours d'ajout
    if (loadingItems.has(pieceId)) {
      console.log('⚠️ Ajout déjà en cours pour:', pieceId);
      return;
    }

    console.log('🛒 Click Ajouter panier (ListView), piece:', pieceId);
    
    // Marquer comme en cours
    setLoadingItems(prev => new Set(prev).add(pieceId));

    // ⚡ Ajout optimiste - appel synchrone (useFetcher)
    addToCart(pieceId, 1);
    
    // Délai minimal pour feedback visuel
    setTimeout(() => {
      setLoadingItems(prev => {
        const next = new Set(prev);
        next.delete(pieceId);
        return next;
      });
    }, 400);
  };
  
  if (pieces.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <div className="text-gray-400 text-6xl mb-4">📋</div>
        <h3 className="text-xl font-medium text-gray-900 mb-2">
          Aucune pièce trouvée
        </h3>
        <p className="text-gray-500">
          Modifiez vos filtres pour afficher des résultats
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pieces.map(piece => {
        const isSelected = selectedPieces.includes(piece.id);
        const hasStock = hasStockAvailable(piece.stock);
        
        // Construction URL logo marque équipementier
        const logoUrl = piece.marque_logo 
          ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/equipementiers-automobiles/${piece.marque_logo}`
          : null;
        
        return (
          <div 
            key={piece.id}
            className={`bg-white rounded-xl shadow-sm border hover:shadow-md transition-all duration-200 overflow-hidden ${
              isSelected ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <div className="flex gap-4 p-4">
              {/* Checkbox sélection */}
              {onSelectPiece && (
                <div className="flex items-center">
                  <button
                    onClick={() => onSelectPiece(piece.id)}
                    className="w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center hover:border-blue-500 transition-colors"
                  >
                    {isSelected && (
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>
              )}

              {/* Header avec logo + badge OES + étoiles */}
              <div className="flex items-center gap-3 pb-3 border-b border-gray-200 mb-3">
                {/* Logo équipementier */}
                {logoUrl ? (
                  <div className="w-14 h-14 flex items-center justify-center flex-shrink-0">
                    <img 
                      src={logoUrl}
                      alt={`Logo ${piece.brand}`}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        console.error('❌ Erreur chargement logo:', logoUrl);
                        const target = e.currentTarget as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.className = 'w-14 h-14 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg border border-gray-300 shadow-sm flex-shrink-0';
                          parent.innerHTML = `<span class="text-sm font-bold text-gray-500">${piece.brand.substring(0, 2).toUpperCase()}</span>`;
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg border border-gray-300 shadow-sm flex-shrink-0">
                    <span className="text-sm font-bold text-gray-500">{piece.brand.substring(0, 2).toUpperCase()}</span>
                  </div>
                )}
                
                {/* Badge OES + étoiles */}
                <div className="flex-1 min-w-0">
                  {piece.quality === 'OES' && (
                    <div className="mb-1">
                      <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm border border-amber-300 inline-block">
                        🏆 OES
                      </span>
                    </div>
                  )}
                  {piece.stars && piece.stars > 0 && (
                    <div>
                      <StarRating rating={piece.stars} size="sm" showNumber={false} />
                    </div>
                  )}
                </div>
              </div>

              {/* Image produit */}
              <div className="w-32 h-32 flex-shrink-0 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden border border-gray-200 relative group">
                {piece.image && piece.image !== '/images/pieces/default.png' ? (
                  <>
                    <img
                      src={normalizeImageUrl(piece.image)}
                      alt={piece.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      decoding="async"
                    />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Infos principales */}
              <div className="flex-1 min-w-0">
                {/* Marque + Référence avec icon - Version améliorée */}
                <div className="mb-4">
                  <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 px-3 py-2 rounded-lg border border-blue-200 shadow-sm inline-block">
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-black text-gray-900 uppercase tracking-tight">{piece.brand}</span>
                      <span className="text-sm font-bold text-blue-700 font-mono">{piece.reference}</span>
                    </div>
                  </div>
                </div>

                {/* Prix et action avec layout moderne */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg px-3 py-2 border border-gray-200">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold block mb-1">Prix TTC</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent leading-none">
                        {typeof piece.price === 'number' ? piece.price.toFixed(2) : piece.priceFormatted}
                      </span>
                      <span className="text-lg font-bold text-gray-500">€</span>
                    </div>
                  </div>

                  <button 
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
                      hasStock && !loadingItems.has(piece.id)
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm hover:shadow-md'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!hasStock || loadingItems.has(piece.id)}
                    onClick={() => hasStock && handleAddToCart(piece.id)}
                  >
                    {loadingItems.has(piece.id) ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Ajout...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {hasStock ? 'Ajouter' : 'Indispo'}
                      </>
                    )}
                  </button>
                </div>
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
