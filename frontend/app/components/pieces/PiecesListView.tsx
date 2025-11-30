/**
 * 📋 Vue Liste pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * Affichage liste dense avec détails complets
 * ✅ Synchronisé avec PiecesGridView (barre fiabilité, couleurs)
 */

import { Badge } from '@fafa/ui';
import React, { useState } from 'react';
import { useCart } from '../../hooks/useCart';
import { type PieceData } from '../../types/pieces-route.types';
import { normalizeImageUrl } from '../../utils/image.utils';
import { hasStockAvailable } from '../../utils/stock.utils';

interface PiecesListViewProps {
  pieces: PieceData[];
  onSelectPiece?: (pieceId: number) => void;
  selectedPieces?: number[];
}

/**
 * Fonctions couleurs synchronisées avec PiecesGridView
 */
const getReliabilityColor = (score: number) => {
  if (score >= 10) return 'from-cyan-400 via-teal-500 to-emerald-500';
  if (score >= 8)  return 'from-emerald-400 via-green-500 to-lime-500';
  if (score >= 7)  return 'from-blue-400 via-sky-500 to-cyan-500';
  if (score >= 5)  return 'from-yellow-400 via-amber-500 to-orange-400';
  if (score >= 3)  return 'from-orange-400 via-rose-500 to-red-400';
  return 'from-slate-400 via-gray-500 to-zinc-500';
};

const getReliabilityTextColor = (score: number) => {
  if (score >= 10) return 'text-teal-600';
  if (score >= 8)  return 'text-emerald-600';
  if (score >= 7)  return 'text-blue-600';
  if (score >= 5)  return 'text-amber-600';
  if (score >= 3)  return 'text-rose-600';
  return 'text-slate-500';
};

const getReliabilityBgColor = (score: number) => {
  if (score >= 10) return 'bg-teal-50 border-teal-200';
  if (score >= 8)  return 'bg-emerald-50 border-emerald-200';
  if (score >= 7)  return 'bg-blue-50 border-blue-200';
  if (score >= 5)  return 'bg-amber-50 border-amber-200';
  if (score >= 3)  return 'bg-rose-50 border-rose-200';
  return 'bg-slate-50 border-slate-200';
};

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
  const handleAddToCart = async (pieceId: number) => {
    // Vérifier si déjà en cours d'ajout
    if (loadingItems.has(pieceId)) {
      console.log('⚠️ Ajout déjà en cours pour:', pieceId);
      return;
    }

    console.log('🛒 Click Ajouter panier (ListView), piece:', pieceId);
    
    // Marquer comme en cours
    setLoadingItems(prev => new Set(prev).add(pieceId));

    try {
      await addToCart(pieceId, 1);
      // Petit délai avant de réactiver (debounce)
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('❌ Erreur ajout panier:', error);
    } finally {
      // Retirer du loading
      setLoadingItems(prev => {
        const next = new Set(prev);
        next.delete(pieceId);
        return next;
      });
    }
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
    <div className="space-y-2">
      {pieces.map(piece => {
        const isSelected = selectedPieces.includes(piece.id);
        const hasStock = hasStockAvailable(piece.stock);
        
        // Construction URL logo marque équipementier
        const logoUrl = piece.marque_logo 
          ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/equipementiers-automobiles/${piece.marque_logo}`
          : null;
        
        // Calcul fiabilité synchronisé avec GridView
        const stars = piece.stars || 3;
        const reliability = Math.round((stars / 6) * 10);
        const reliabilityColor = getReliabilityColor(reliability);
        const reliabilityTextColor = getReliabilityTextColor(reliability);
        const reliabilityBgColor = getReliabilityBgColor(reliability);
        
        return (
          <div 
            key={piece.id}
            className={`bg-white rounded-xl border hover:shadow-xl transition-all duration-300 overflow-hidden group ${
              isSelected ? 'ring-2 ring-blue-500 border-blue-400 shadow-blue-100' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            {/* Layout Mobile-First: vertical sur mobile, horizontal sur desktop */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3">
              
              {/* ROW 1 Mobile: Image + Infos de base */}
              <div className="flex items-start gap-3">
                
                {/* Checkbox sélection - si mode comparaison */}
                {onSelectPiece && (
                  <button
                    onClick={() => onSelectPiece(piece.id)}
                    className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all mt-1 ${
                      isSelected 
                        ? 'bg-blue-600 border-blue-600 shadow-sm' 
                        : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                )}
                
                {/* Image produit - responsive */}
                <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 bg-gradient-to-br from-slate-50 to-white rounded-xl overflow-hidden border border-slate-100 relative shadow-sm">
                  {piece.image && piece.image !== '/images/pieces/default.png' ? (
                    <img
                      src={normalizeImageUrl(piece.image)}
                      alt={piece.name}
                      className="w-full h-full object-contain p-2 sm:p-3 group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                      <svg className="w-10 h-10 sm:w-12 sm:h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Infos Mobile: Logo + Marque + Ref + Fiabilité */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Logo + Badge OES + Marque */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Logo équipementier - compact sur mobile */}
                    {logoUrl ? (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-white rounded-lg border border-slate-100 p-0.5 flex-shrink-0">
                        <img 
                          src={logoUrl}
                          alt={piece.brand}
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.className = 'w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg';
                              parent.innerHTML = `<span class="text-xs font-black text-white">${piece.brand.substring(0, 2).toUpperCase()}</span>`;
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex-shrink-0">
                        <span className="text-xs font-black text-white">{piece.brand.substring(0, 2).toUpperCase()}</span>
                      </div>
                    )}
                    
                    {/* Badge OES */}
                    {piece.quality === 'OES' && (
                      <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[8px] sm:text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded shadow-sm uppercase tracking-wide">
                        OES
                      </span>
                    )}
                    
                    {/* Marque */}
                    <span className="text-xs sm:text-sm font-black text-slate-900 uppercase truncate">{piece.brand}</span>
                  </div>
                  
                  {/* Référence */}
                  <div>
                    <span className="text-[10px] sm:text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{piece.reference}</span>
                  </div>
                  
                  {/* Barre fiabilité - visible sur mobile */}
                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border ${reliabilityBgColor}`}>
                    <div className="w-10 sm:w-14 h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${reliabilityColor} rounded-full`}
                        style={{ width: `${reliability * 10}%` }}
                      />
                    </div>
                    <span className={`text-xs sm:text-sm font-black tabular-nums ${reliabilityTextColor}`}>{reliability}</span>
                  </div>
                </div>
              </div>
              
              {/* ROW 2 Mobile / Right side Desktop: Prix + Bouton */}
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pl-0 sm:pl-0 sm:ml-auto">
                {/* Prix */}
                <div className="text-left sm:text-right">
                  <span className="text-xl sm:text-lg font-black text-slate-900">{typeof piece.price === 'number' ? piece.price.toFixed(2) : piece.priceFormatted}</span>
                  <span className="text-sm font-semibold text-slate-400 ml-0.5">€</span>
                </div>
                
                {/* Bouton panier - plus grand sur mobile */}
                <button 
                  className={`w-12 h-12 sm:w-10 sm:h-10 rounded-xl sm:rounded-lg flex-shrink-0 flex items-center justify-center transition-all duration-200 ${
                    hasStock && !loadingItems.has(piece.id)
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg hover:scale-110'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                  disabled={!hasStock || loadingItems.has(piece.id)}
                  onClick={() => hasStock && handleAddToCart(piece.id)}
                  title={hasStock ? 'Ajouter au panier' : 'Indisponible'}
                >
                  {loadingItems.has(piece.id) ? (
                    <svg className="w-6 h-6 sm:w-5 sm:h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
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
