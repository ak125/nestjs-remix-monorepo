/**
 * 📱 Vue Grid pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * Affichage grid moderne avec cartes optimisées
 */

import { Badge, Card, CardContent } from '@fafa/ui';
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
          <Card 
            key={piece.id}
            className={`hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group relative ${
              isSelected ? 'ring-2 ring-primary shadow-xl' : ''
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
            <div className="px-4 pt-4 pb-3 bg-card border-b border-border relative z-10">
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
                  images={piece.images?.map((url, idx) => ({
                    id: `${piece.id}-${idx}`,
                    url,
                    sort: idx,
                    alt: `${piece.name} ${piece.brand} - Image ${idx + 1}`
                  }))} 
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
                      ? 'bg-gradient-to-r from-primary to-primary/90 border-2 border-background' 
                      : 'bg-background/90 backdrop-blur-sm border border-border'
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
              <div className="mb-3">
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 px-4 py-3 rounded-xl border border-primary/20 shadow-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-black text-foreground uppercase tracking-tight">{piece.brand}</span>
                    <span className="text-base font-bold text-primary font-mono">{piece.reference}</span>
                  </div>
                </div>
              </div>
              
              {/* Info détails techniques disponibles */}
              {(piece.description || (piece.images && piece.images.length > 1)) && (
                <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Cliquez pour voir les détails techniques{piece.images && piece.images.length > 1 ? ` et ${piece.images.length} photos` : ''}</span>
                </div>
              )}

              {/* Prix section avec label */}
              <div className="bg-gradient-to-br from-muted/50 to-background rounded-xl p-3 border-2 border-border relative z-20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold block mb-1">Prix TTC</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent leading-none">
                        {typeof piece.price === 'number' ? piece.price.toFixed(2) : piece.priceFormatted}
                      </span>
                      <span className="text-lg font-bold text-muted-foreground">€</span>
                    </div>
                  </div>

                  {/* Bouton action */}
                  <button 
                    type="button"
                    className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 transform active:scale-95 whitespace-nowrap relative z-30 ${
                      hasStock && !loadingItems.has(piece.id)
                        ? 'bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:from-primary/90 hover:via-primary/80 hover:to-primary/70 text-primary-foreground shadow-md hover:shadow-lg'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
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
          </Card>
        );
      })}
    </div>
    </>
  );
}
