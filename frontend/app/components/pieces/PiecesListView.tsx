/**
 * 📋 Vue Liste pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * Affichage liste dense avec détails complets
 */

import React from 'react';
import { Badge } from '@fafa/ui';
import { type PieceData } from '../../types/pieces-route.types';

interface PiecesListViewProps {
  pieces: PieceData[];
  onSelectPiece?: (pieceId: number) => void;
  selectedPieces?: number[];
}

/**
 * Helper optimisation images WebP (petite taille pour liste)
 */
const optimizeImageUrl = (imageUrl: string | undefined, width: number = 150): string => {
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
 * Vue Liste compacte avec toutes les infos
 */
export function PiecesListView({ pieces, onSelectPiece, selectedPieces = [] }: PiecesListViewProps) {
  
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
        const hasStock = piece.stock === 'En stock' || piece.stock === 'available';
        
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

              {/* Image miniature */}
              <div className="w-24 h-24 flex-shrink-0 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg overflow-hidden">
                {piece.description ? (
                  <img
                    src={optimizeImageUrl(piece.description, 150)}
                    alt={piece.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Infos principales */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1">
                    {/* Marque + badges */}
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="info">{piece.brand}</Badge>
                      {piece.quality === 'OES' && (
                        <Badge variant="warning">🏆 OES</Badge>
                      )}
                      {piece.quality && piece.quality !== 'OES' && (
                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                          {piece.quality}
                        </span>
                      )}
                    </div>

                    {/* Désignation */}
                    <h3 className="font-semibold text-gray-900 mb-1 leading-tight">
                      {piece.name}
                    </h3>

                    {/* Référence */}
                    <p className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded inline-block">
                      Réf: {piece.reference}
                    </p>
                  </div>

                  {/* Dispo badge */}
                  <div>
                    {hasStock ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></span>
                        En stock
                      </span>
                    ) : (
                      <Badge variant="error">Rupture</Badge>
                    )}
                  </div>
                </div>

                {/* Détails supplémentaires */}
                <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
                  {piece.delaiLivraison && (
                    <div className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{piece.delaiLivraison}j</span>
                    </div>
                  )}
                  {piece.stars && (
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500">{'⭐'.repeat(piece.stars)}</span>
                    </div>
                  )}
                </div>

                {/* Prix et action */}
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {typeof piece.price === 'number' ? piece.price.toFixed(2) : piece.priceFormatted}€
                    </span>
                  </div>

                  <button 
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                      hasStock
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm hover:shadow-md'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!hasStock}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {hasStock ? 'Ajouter' : 'Indisponible'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
