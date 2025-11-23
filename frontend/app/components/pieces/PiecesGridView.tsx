/**
 * 📱 Vue Grid pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * Affichage grid moderne avec cartes optimisées
 */

import { Badge } from '@fafa/ui';
import React, { useState, useEffect } from 'react';
import { useCart } from '../../hooks/useCart';
import { type PieceData } from '../../types/pieces-route.types';
import { normalizeImageUrl } from '../../utils/image.utils';
import { hasStockAvailable } from '../../utils/stock.utils';
import { ProductGallery } from './ProductGallery';
import { StarRating } from '../common/StarRating';
import { PieceDetailModal } from './PieceDetailModal';

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
      // 🚀 FIX: Utilisation de object/public car le service de transformation (render/image) semble instable
      return `${SUPABASE_URL}/storage/v1/object/public/${path}`;
    }
  }
  
  return imageUrl;
};

/**
 * Vue Grid avec cartes pièces
 * ⚡ Optimisé avec React.memo pour éviter re-renders inutiles
 */
export function PiecesGridView({ pieces, onSelectPiece, selectedPieces = [] }: PiecesGridViewProps) {
  const { addToCart } = useCart();
  
  // État pour gérer le loading par produit (anti-double-clic)
  const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());
  
  // État pour le modal de détail
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null);

  console.log('🎨 PiecesGridView render - pieces:', pieces.length, 'selectedPieceId:', selectedPieceId);

  // Debug state changes
  useEffect(() => {
    console.log('🔄 selectedPieceId changed:', selectedPieceId);
  }, [selectedPieceId]);

  // Handler anti-double-clic pour ajout panier
  const handleAddToCart = async (pieceId: number) => {
    // Vérifier si déjà en cours d'ajout
    if (loadingItems.has(pieceId)) {
      console.log('⚠️ Ajout déjà en cours pour:', pieceId);
      return;
    }

    console.log('🛒 Click Ajouter panier, piece:', pieceId);
    
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
      <div className="text-center py-20 bg-gradient-to-br from-white via-gray-50 to-slate-50 rounded-2xl border-2 border-dashed border-gray-300 relative overflow-hidden">
        {/* Pattern d'arrière-plan */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDE0YzIuMiAwIDQgMS44IDQgNHMtMS44IDQtNCA0LTQtMS44LTQtNGMwLTIuMiAxLjgtNCA0LTR6bTAgNDBjMi4yIDAgNCAxLjggNCA0cy0xLjggNC00IDQtNC0xLjgtNC00YzAtMi4yIDEuOC00IDQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40\"></div>
        
        {/* Contenu */}
        <div className="relative z-10 max-w-md mx-auto px-4">
          {/* Icône animée */}
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 mb-6 animate-bounce-slow">
            <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
            </svg>
          </div>
          
          {/* Titre */}
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            Aucune pièce trouvée
          </h3>
          
          {/* Description */}
          <p className="text-gray-600 mb-6 leading-relaxed">
            Essayez de modifier vos filtres ou d'élargir vos critères de recherche pour découvrir plus de résultats.
          </p>
          
          {/* Suggestions */}
          <div className="inline-flex flex-col gap-2 text-sm text-left bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-700">Vérifiez vos filtres de marque et qualité</span>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-700">Essayez une recherche plus large</span>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-700">Réinitialisez tous les filtres</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <>
      {/* Bouton de test DEBUG */}
      <button
        onClick={() => {
          console.log('🧪 TEST BUTTON CLICKED');
          setSelectedPieceId(pieces[0]?.id || 2862263);
        }}
        className="mb-4 bg-red-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-600"
      >
        🧪 TEST MODAL (Debug)
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Modal détail pièce */}
        <PieceDetailModal 
          pieceId={selectedPieceId}
          onClose={() => {
            console.log('🚪 Modal fermé');
            setSelectedPieceId(null);
          }}
        />
      
      {pieces.map((piece) => {
        const isSelected = selectedPieces.includes(piece.id);
        const hasStock = hasStockAvailable(piece.stock);
        
        // Construction URL logo marque équipementier
        const logoUrl = piece.marque_logo 
          ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/equipementiers-automobiles/${piece.marque_logo}`
          : null;
        
        // Debug: Afficher les infos du logo
        if (piece.id === pieces[0]?.id) {
          console.log('🔍 Debug logo:', {
            piece_id: piece.id,
            brand: piece.brand,
            marque_logo: piece.marque_logo,
            marque_id: piece.marque_id,
            logoUrl: logoUrl,
            allPieceKeys: Object.keys(piece)
          });
        }
        
        return (
          <div 
            key={piece.id}
            className={`bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group relative ${
              isSelected ? 'ring-2 ring-blue-500 shadow-xl' : ''
            }`}
            onClick={(e) => {
              console.log('🖱️ CLICK DETECTED on card:', piece.id, piece.name);
              console.log('🎯 Event target:', e.target);
              console.log('🎯 Current target:', e.currentTarget);
              setSelectedPieceId(piece.id);
            }}
            style={{ cursor: 'pointer', position: 'relative', zIndex: 1 }}
          >
            {/* Effet de brillance au hover */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/0 to-transparent group-hover:via-white/10 transition-all duration-500 pointer-events-none"></div>
            
            {/* Header avec logo + badge OES + étoiles */}
            <div className="px-4 pt-4 pb-3 bg-white border-b border-gray-100 relative z-10">
              <div className="flex items-center gap-3">
                {/* Logo équipementier */}
                {logoUrl ? (
                  <div className="w-16 h-16 flex items-center justify-center flex-shrink-0">
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
                          parent.className = 'w-16 h-16 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg border border-gray-300 shadow-sm flex-shrink-0';
                          parent.innerHTML = `<span class="text-sm font-bold text-gray-500">${piece.brand.substring(0, 2).toUpperCase()}</span>`;
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg border border-gray-300 shadow-sm flex-shrink-0">
                    <span className="text-sm font-bold text-gray-500">{piece.brand.substring(0, 2).toUpperCase()}</span>
                  </div>
                )}
                
                {/* Badge OES + étoiles */}
                <div className="flex-1 min-w-0">
                  {piece.quality === 'OES' && (
                    <div className="mb-1">
                      <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm border border-amber-300 inline-block">
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
            </div>
            
            {/* Image optimisée WebP */}
            <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
              <div className="group-hover:scale-110 transition-transform duration-500 ease-out">
                <ProductGallery 
                  images={piece.images} 
                  mainImage={piece.image} 
                  alt={`${piece.name} ${piece.brand}${piece.reference ? ` pour véhicule - Réf ${piece.reference}` : ' pièce automobile de qualité'}`}
                />
              </div>
              
              {/* Checkbox sélection en haut à gauche */}
              {onSelectPiece && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('🔲 Clic checkbox:', piece.id);
                    onSelectPiece(piece.id);
                  }}
                  className={`absolute top-3 left-3 w-7 h-7 rounded-lg shadow-lg flex items-center justify-center hover:scale-110 transition-all z-20 ${
                    isSelected 
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 border-2 border-white' 
                      : 'bg-white/90 backdrop-blur-sm border border-gray-200'
                  }`}
                >
                  {isSelected && (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              )}
            </div>

            {/* Contenu carte */}
            <div className="p-5 relative z-10">
              {/* Marque + Référence avec icon - Version améliorée */}
              <div className="mb-6">
                <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 px-4 py-3 rounded-xl border border-blue-200 shadow-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-black text-gray-900 uppercase tracking-tight">{piece.brand}</span>
                    <span className="text-base font-bold text-blue-700 font-mono">{piece.reference}</span>
                  </div>
                </div>
              </div>

              {/* Prix section avec label */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-3 border-2 border-gray-100 relative z-20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold block mb-1">Prix TTC</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent leading-none">
                        {typeof piece.price === 'number' ? piece.price.toFixed(2) : piece.priceFormatted}
                      </span>
                      <span className="text-lg font-bold text-gray-500">€</span>
                    </div>
                  </div>

                  {/* Bouton action */}
                  <button 
                    type="button"
                    className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 transform active:scale-95 whitespace-nowrap relative z-30 ${
                      hasStock && !loadingItems.has(piece.id)
                        ? 'bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:via-blue-800 hover:to-indigo-800 text-white shadow-md hover:shadow-lg'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!hasStock || loadingItems.has(piece.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('🛒 Clic bouton panier:', piece.id);
                      if (hasStock) {
                        handleAddToCart(piece.id);
                      }
                    }}
                  >
                    {loadingItems.has(piece.id) ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Ajout...
                      </span>
                    ) : hasStock ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Ajouter
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                        </svg>
                        Indispo
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}
