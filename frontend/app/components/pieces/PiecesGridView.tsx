/**
 * 📱 Vue Grid pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * Affichage grid moderne avec cartes optimisées
 */

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
  const handleAddToCart = (pieceId: number) => {
    // Vérifier si déjà en cours d'ajout
    if (loadingItems.has(pieceId)) {
      console.log('⚠️ Ajout déjà en cours pour:', pieceId);
      return;
    }

    console.log('🛒 Click Ajouter panier, piece:', pieceId);
    
    // Marquer comme en cours
    setLoadingItems(prev => new Set(prev).add(pieceId));

    // ⚡ Ajout optimiste - appel synchrone (useFetcher)
    addToCart(pieceId, 1);
    
    // Délai minimal pour feedback visuel (réduit au minimum)
    setTimeout(() => {
      setLoadingItems(prev => {
        const next = new Set(prev);
        next.delete(pieceId);
        return next;
      });
    }, 200);
  };
  
  if (pieces.length === 0) {
    return (
      <div className="text-center py-20 bg-gradient-to-br from-background via-muted/50 to-muted rounded-2xl border-2 border-dashed border-border relative overflow-hidden">
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
          <h3 className="text-2xl font-bold text-foreground mb-3">
            Aucune pièce trouvée
          </h3>
          
          {/* Description */}
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Essayez de modifier vos filtres ou d'élargir vos critères de recherche pour découvrir plus de résultats.
          </p>
          
          {/* Suggestions */}
          <div className="inline-flex flex-col gap-2 text-sm text-left bg-card rounded-xl p-4 shadow-sm border border-border">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-foreground">Vérifiez vos filtres de marque et qualité</span>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-foreground">Essayez une recherche plus large</span>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-foreground">Réinitialisez tous les filtres</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Modal détail pièce */}
        <PieceDetailModal 
          pieceId={selectedPieceId}
          onClose={() => {
            console.log('🚪 Modal fermé');
            setSelectedPieceId(null);
          }}
        />
      
      {pieces.map((piece, index) => {
        const isSelected = selectedPieces.includes(piece.id);
        const hasStock = hasStockAvailable(piece.stock);
        
        // Construction URL logo marque équipementier
        const logoUrl = piece.marque_logo 
          ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/equipementiers-automobiles/${piece.marque_logo}`
          : null;
        
        // Prix formaté
        const priceWhole = typeof piece.price === 'number' ? Math.floor(piece.price) : piece.priceFormatted?.split(',')[0] || '0';
        const priceCents = typeof piece.price === 'number' ? (piece.price % 1).toFixed(2).substring(2) : piece.priceFormatted?.split(',')[1]?.replace('€', '') || '00';
        
        return (
          <div 
            key={piece.id}
            className={`group relative bg-white rounded-xl transition-all duration-300 cursor-pointer flex flex-col ${
              isSelected 
                ? 'ring-2 ring-indigo-500 shadow-xl shadow-indigo-500/20' 
                : 'shadow-sm hover:shadow-lg hover:-translate-y-0.5'
            }`}
            onClick={(e) => {
              setSelectedPieceId(piece.id);
            }}
          >
            {/* ═══════════════════════════════════════════════════════════
                🏷️ ZONE HEADER - Logo + Barre Fiabilité (HAUT)
            ═══════════════════════════════════════════════════════════ */}
            <div className="flex items-center justify-between gap-2 p-2.5 pb-1">
              {/* Logo équipementier */}
              {logoUrl ? (
                <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center flex-shrink-0">
                  <img 
                    src={logoUrl}
                    alt={piece.brand}
                    className="w-full h-full object-contain drop-shadow-md"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `<span class="text-lg font-black bg-gradient-to-br from-indigo-600 to-purple-600 bg-clip-text text-transparent">${piece.brand.substring(0, 2).toUpperCase()}</span>`;
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md flex items-center justify-center flex-shrink-0">
                  <span className="text-base font-black text-white">{piece.brand.substring(0, 2).toUpperCase()}</span>
                </div>
              )}
              
              {/* Barre de fiabilité colorée + score */}
              {(() => {
                const stars = piece.stars || 3;
                const reliability = Math.round((stars / 6) * 10);
                const percent = reliability * 10;
                const getColor = (score: number) => {
                  if (score >= 10) return 'from-cyan-400 via-teal-500 to-emerald-500';
                  if (score >= 8)  return 'from-emerald-400 via-green-500 to-lime-500';
                  if (score >= 7)  return 'from-blue-400 via-sky-500 to-cyan-500';
                  if (score >= 5)  return 'from-yellow-400 via-amber-500 to-orange-400';
                  if (score >= 3)  return 'from-orange-400 via-rose-500 to-red-400';
                  return 'from-slate-400 via-gray-500 to-zinc-500';
                };
                const getTextColor = (score: number) => {
                  if (score >= 10) return 'text-teal-600';
                  if (score >= 8)  return 'text-emerald-600';
                  if (score >= 7)  return 'text-blue-600';
                  if (score >= 5)  return 'text-amber-600';
                  if (score >= 3)  return 'text-rose-600';
                  return 'text-slate-500';
                };
                return (
                  <div className="flex-1 flex items-center justify-end gap-1.5">
                    <div className="w-full max-w-[60px] h-1.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className={`h-full bg-gradient-to-r ${getColor(reliability)} rounded-full transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className={`text-xs font-black ${getTextColor(reliability)} min-w-[16px]`}>{reliability}</span>
                  </div>
                );
              })()}
            </div>
            
            {/* ═══════════════════════════════════════════════════════════
                🖼️ ZONE IMAGE - Grande et immersive (MILIEU)
            ═══════════════════════════════════════════════════════════ */}
            <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 flex-1">
              
              {/* Image principale - CONTENUE dans le cadre */}
              <div className="absolute inset-2 flex items-center justify-center">
                <div className="relative w-full h-full">
                  <ProductGallery 
                    images={piece.images?.map((url, idx) => ({
                      id: `${piece.id}-${idx}`,
                      url,
                      sort: idx,
                      alt: `${piece.name} ${piece.brand} - Image ${idx + 1}`
                    }))} 
                    mainImage={piece.image} 
                    alt={`${piece.name} ${piece.brand}${piece.reference ? ` - Réf ${piece.reference}` : ''}`}
                  />
                </div>
              </div>
              
              {/* Overlay gradient au hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              
              {/* ═══ INDICATEUR PHOTOS - En bas à droite ═══ */}
              {piece.images && piece.images.length > 1 && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/95 backdrop-blur-sm text-slate-700 text-xs font-bold px-2 py-1 rounded-md shadow-md border border-slate-200 z-10">
                  <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{piece.images.length}</span>
                </div>
              )}
              
              {/* Checkbox sélection */}
              {onSelectPiece && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPiece(piece.id);
                  }}
                  className={`absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-300 z-20 ${
                    isSelected 
                      ? 'bg-indigo-600 shadow-lg shadow-indigo-500/50 scale-110' 
                      : 'bg-white/90 backdrop-blur-sm border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50'
                  }`}
                >
                  {isSelected ? (
                    <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <div className="w-2.5 h-2.5 rounded border-2 border-slate-300"></div>
                  )}
                </button>
              )}
            </div>
            
            {/* ═══════════════════════════════════════════════════════════
                📋 ZONE FOOTER - Marque + Référence + Prix + Bouton (BAS)
            ═══════════════════════════════════════════════════════════ */}
            <div className="p-2.5 pt-2 border-t border-slate-100 bg-gradient-to-b from-white to-slate-50/50">
              
              {/* Marque + Référence - sur une ligne */}
              <div className="flex items-center gap-1.5 mb-2 truncate">
                <span className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wide flex-shrink-0">
                  {piece.brand}
                </span>
                <span className="text-slate-300">|</span>
                <code className="text-sm sm:text-base font-mono font-bold text-indigo-700 truncate">
                  {piece.reference}
                </code>
              </div>
              
              {/* Prix + Bouton */}
              <div className="flex items-center justify-between gap-2">
                {/* Zone Prix */}
                <div className="flex items-baseline">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 leading-none">
                    {priceWhole}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-slate-400">
                    ,{priceCents}€
                  </span>
                </div>

                {/* Bouton Ajouter - INDIGO, toujours actif */}
                <button 
                  type="button"
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 active:scale-95 ${
                    !loadingItems.has(piece.id)
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/30'
                      : 'bg-indigo-300 text-white cursor-wait'
                  }`}
                  disabled={loadingItems.has(piece.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasStock) {
                      handleAddToCart(piece.id);
                    }
                  }}
                >
                  {loadingItems.has(piece.id) ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : hasStock ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="hidden sm:inline">Ajouter</span>
                    </>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            
            {/* ═══ BARRE COULEUR AU HOVER ═══ */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-b-xl"></div>
            
            {/* ═══ BORDURE SUBTILE ═══ */}
            <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-slate-200/80 group-hover:ring-indigo-400/30 transition-all duration-300 pointer-events-none"></div>
          </div>
        );
      })}
    </div>
    </>
  );
}
