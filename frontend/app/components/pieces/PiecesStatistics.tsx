/**
 * 📊 Statistiques pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * Dashboard de statistiques visuelles
 */

import React from 'react';
import { type PieceData } from '../../types/pieces-route.types';

interface PiecesStatisticsProps {
  pieces: PieceData[];
  vehicleName: string;
  gammeName: string;
}

/**
 * Section statistiques avec métriques visuelles
 */
export function PiecesStatistics({ pieces, vehicleName, gammeName }: PiecesStatisticsProps) {
  
  // Calcul des stats
  const stats = React.useMemo(() => {
    if (pieces.length === 0) return null;

    const prices = pieces.map(p => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    const hasStockCount = pieces.filter(p => p.stock === 'En stock' || p.stock === 'available').length;
    const stockPercentage = (hasStockCount / pieces.length) * 100;

    const brands = [...new Set(pieces.map(p => p.brand))];
    const oesPieces = pieces.filter(p => p.quality === 'OES').length;
    const oesPercentage = (oesPieces / pieces.length) * 100;

    // Distribution par gamme de prix
    const lowPrice = pieces.filter(p => p.price < 50).length;
    const midPrice = pieces.filter(p => p.price >= 50 && p.price <= 150).length;
    const highPrice = pieces.filter(p => p.price > 150).length;

    return {
      total: pieces.length,
      minPrice,
      maxPrice,
      avgPrice,
      hasStockCount,
      stockPercentage,
      brandsCount: brands.length,
      oesPieces,
      oesPercentage,
      priceDistribution: { lowPrice, midPrice, highPrice }
    };
  }, [pieces]);

  if (!stats) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
        <p className="text-gray-500">Aucune donnée statistique disponible</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 px-6 py-4 border-b border-orange-200">
        <h2 className="text-2xl font-bold text-orange-900 flex items-center gap-3">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Statistiques du catalogue
        </h2>
        <p className="text-sm text-orange-700 mt-1">
          {gammeName} pour {vehicleName}
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Métriques principales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {stats.total}
            </div>
            <div className="text-sm text-blue-800 font-medium">
              Pièces disponibles
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <div className="text-3xl font-bold text-green-600 mb-1">
              {stats.hasStockCount}
            </div>
            <div className="text-sm text-green-800 font-medium">
              En stock
            </div>
            <div className="text-xs text-green-600 mt-1">
              {stats.stockPercentage.toFixed(0)}% du catalogue
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
            <div className="text-3xl font-bold text-purple-600 mb-1">
              {stats.brandsCount}
            </div>
            <div className="text-sm text-purple-800 font-medium">
              Marques
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200">
            <div className="text-3xl font-bold text-yellow-600 mb-1">
              {stats.oesPieces}
            </div>
            <div className="text-sm text-yellow-800 font-medium">
              Qualité OES
            </div>
            <div className="text-xs text-yellow-600 mt-1">
              {stats.oesPercentage.toFixed(0)}% du catalogue
            </div>
          </div>
        </div>

        {/* Analyse des prix */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-5 border border-indigo-200">
          <h3 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            Analyse des prix
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600 mb-1">Prix minimum</div>
              <div className="text-2xl font-bold text-green-600">
                {stats.minPrice.toFixed(2)}€
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600 mb-1">Prix moyen</div>
              <div className="text-2xl font-bold text-blue-600">
                {stats.avgPrice.toFixed(2)}€
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600 mb-1">Prix maximum</div>
              <div className="text-2xl font-bold text-purple-600">
                {stats.maxPrice.toFixed(2)}€
              </div>
            </div>
          </div>

          {/* Distribution visuelle */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-700 mb-3 font-medium">
              Répartition par gamme de prix
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600">Moins de 50€ (économique)</span>
                  <span className="font-medium text-green-600">{stats.priceDistribution.lowPrice} pièces</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-400 to-green-600"
                    style={{ width: `${(stats.priceDistribution.lowPrice / stats.total) * 100}%` }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600">50€ - 150€ (standard)</span>
                  <span className="font-medium text-blue-600">{stats.priceDistribution.midPrice} pièces</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                    style={{ width: `${(stats.priceDistribution.midPrice / stats.total) * 100}%` }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600">Plus de 150€ (premium)</span>
                  <span className="font-medium text-purple-600">{stats.priceDistribution.highPrice} pièces</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-400 to-purple-600"
                    style={{ width: `${(stats.priceDistribution.highPrice / stats.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-5 border border-orange-200">
          <h3 className="text-sm font-semibold text-orange-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Le saviez-vous ?
          </h3>
          <ul className="space-y-2 text-sm text-orange-800">
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">•</span>
              <span>
                Notre catalogue contient <strong>{stats.brandsCount} marques différentes</strong>, 
                vous offrant un large choix pour votre {vehicleName}.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">•</span>
              <span>
                <strong>{stats.stockPercentage.toFixed(0)}%</strong> des pièces sont en stock immédiat, 
                prêtes à être expédiées sous 24-48h.
              </span>
            </li>
            {stats.oesPercentage > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">•</span>
                <span>
                  <strong>{stats.oesPieces} pièces de qualité OES</strong> (équivalent origine constructeur) 
                  sont disponibles pour une qualité optimale.
                </span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
