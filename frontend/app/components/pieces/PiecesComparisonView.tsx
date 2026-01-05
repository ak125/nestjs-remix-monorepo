/**
 * 🔄 Vue Comparaison pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * Affichage comparatif côte à côte (max 4 pièces)
 */

import { Badge } from '~/components/ui';
import React from 'react';
import { type PieceData } from '../../types/pieces-route.types';

interface PiecesComparisonViewProps {
  pieces: PieceData[];
  selectedPieces: number[];
  onRemovePiece: (pieceId: number) => void;
}

/**
 * Vue Comparaison détaillée (tableau side-by-side)
 */
export function PiecesComparisonView({ pieces, selectedPieces, onRemovePiece }: PiecesComparisonViewProps) {
  
  // Filtrer les pièces sélectionnées (max 4)
  const comparedPieces = pieces
    .filter(p => selectedPieces.includes(p.id))
    .slice(0, 4);

  if (comparedPieces.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <div className="text-gray-400 text-6xl mb-4">🔄</div>
        <h3 className="text-xl font-medium text-gray-900 mb-2">
          Mode comparaison
        </h3>
        <p className="text-gray-500">
          Sélectionnez jusqu'à 4 pièces à comparer
        </p>
      </div>
    );
  }

  // Propriétés à comparer
  const comparisonRows = [
    { label: 'Image', key: 'image' },
    { label: 'Marque', key: 'brand' },
    { label: 'Désignation', key: 'name' },
    { label: 'Référence', key: 'reference' },
    { label: 'Prix', key: 'price' },
    { label: 'Qualité', key: 'quality' },
    { label: 'Stock', key: 'stock' },
    { label: 'Délai livraison', key: 'delaiLivraison' },
    { label: 'Note', key: 'stars' },
    { label: 'Côté', key: 'side' },
  ];

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <tr>
                <th className="sticky left-0 z-10 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-4 text-left text-sm font-bold text-gray-900 border-r border-gray-200">
                  Critères
                </th>
                {comparedPieces.map((piece) => (
                  <th 
                    key={piece.id}
                    className="px-4 py-4 text-center text-sm font-medium text-gray-700 min-w-[250px] relative"
                  >
                    <button
                      onClick={() => onRemovePiece(piece.id)}
                      className="absolute top-2 right-2 w-6 h-6 bg-destructive/15 hover:bg-destructive/30 text-red-600 rounded-full flex items-center justify-center transition-colors"
                      title="Retirer de la comparaison"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="text-xs text-gray-500 mt-4">Pièce {comparedPieces.indexOf(piece) + 1}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {comparisonRows.map((row, rowIndex) => (
                <tr key={row.key} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="sticky left-0 z-10 px-4 py-4 text-sm font-medium text-gray-900 bg-gray-100 border-r border-gray-200">
                    {row.label}
                  </td>
                  {comparedPieces.map((piece) => (
                    <td key={piece.id} className="px-4 py-4 text-sm text-gray-700 text-center align-middle">
                      {renderComparisonCell(row.key, piece, comparedPieces)}
                    </td>
                  ))}
                </tr>
              ))}
              
              {/* Ligne action */}
              <tr className="bg-gray-50">
                <td className="sticky left-0 z-10 px-4 py-4 text-sm font-medium text-gray-900 bg-gray-100 border-r border-gray-200">
                  Action
                </td>
                {comparedPieces.map((piece) => {
                  const hasStock = piece.stock === 'En stock' || piece.stock === 'available';
                  return (
                    <td key={piece.id} className="px-4 py-4 text-center">
                      <button 
                        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          hasStock
                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm hover:shadow-md'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                        disabled={!hasStock}
                      >
                        {hasStock ? '🛒 Ajouter' : 'Indisponible'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Légende prix */}
      {comparedPieces.length > 1 && (
        <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-900">
              <strong>Prix minimum:</strong> {Math.min(...comparedPieces.map(p => p.price)).toFixed(2)}€
            </div>
            <div className="text-sm text-blue-900">
              <strong>Prix maximum:</strong> {Math.max(...comparedPieces.map(p => p.price)).toFixed(2)}€
            </div>
            <div className="text-sm text-blue-900">
              <strong>Différence:</strong> {(Math.max(...comparedPieces.map(p => p.price)) - Math.min(...comparedPieces.map(p => p.price))).toFixed(2)}€
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper pour render les cellules de comparaison
 */
function renderComparisonCell(key: string, piece: PieceData, allPieces: PieceData[]) {
  switch (key) {
    case 'image':
      return (
        <div className="flex justify-center">
          <div className="w-32 h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg overflow-hidden">
            {piece.description ? (
              <img
                src={piece.description}
                alt={piece.name}
                width={128}
                height={128}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>
        </div>
      );

    case 'brand':
      return (
        <Badge variant="info">{piece.brand}</Badge>
      );

    case 'name':
      return <div className="font-medium text-left">{piece.name}</div>;

    case 'reference':
      return (
        <span className="inline-block text-xs font-mono bg-gray-100 px-2 py-1 rounded">
          {piece.reference}
        </span>
      );

    case 'price':
      const minPrice = Math.min(...allPieces.map(p => p.price));
      const isCheapest = piece.price === minPrice;
      return (
        <div className={`font-bold text-lg ${isCheapest ? 'text-green-600' : 'text-gray-900'}`}>
          {typeof piece.price === 'number' ? piece.price.toFixed(2) : piece.priceFormatted}€
          {isCheapest && (
            <div className="text-xs text-green-600 font-medium mt-1">🏆 Meilleur prix</div>
          )}
        </div>
      );

    case 'quality':
      if (!piece.quality) return <span className="text-gray-400">-</span>;
      return (
        <span className={`inline-block text-xs font-medium px-2 py-1 rounded ${
          piece.quality === 'OES' ? 'warning' : 'bg-gray-100 text-gray-700'
        }`}>
          {piece.quality === 'OES' ? '🏆 OES' : piece.quality}
        </span>
      );

    case 'stock':
      const hasStock = piece.stock === 'En stock' || piece.stock === 'available';
      return (
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
          hasStock 
            ? 'success' : 'error'
        }`}>
          {hasStock ? (
            <>
              <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></span>
              En stock
            </>
          ) : (
            'Rupture'
          )}
        </span>
      );

    case 'delaiLivraison':
      if (!piece.delaiLivraison) return <span className="text-gray-400">-</span>;
      return <span>{piece.delaiLivraison} jours</span>;

    case 'stars':
      if (!piece.stars) return <span className="text-gray-400">-</span>;
      return (
        <div className="flex items-center justify-center gap-0.5 text-yellow-500">
          {'⭐'.repeat(piece.stars)}
        </div>
      );

    case 'side':
      if (!piece.side) return <span className="text-gray-400">-</span>;
      return (
        <span className="inline-block text-xs bg-gray-100 px-2 py-1 rounded">
          {piece.side}
        </span>
      );

    default:
      return <span className="text-gray-400">-</span>;
  }
}
