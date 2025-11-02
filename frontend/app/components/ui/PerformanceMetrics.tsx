/**
 * 📈 INDICATEURS DE PERFORMANCE
 * 
 * Composant pour afficher les métriques de performance en temps réel
 */

import { memo, useEffect, useState } from 'react';

interface PerformanceMetricsProps {
  loadTime?: number;
  totalItems?: number;
  filteredItems?: number;
  currentPage?: number;
  totalPages?: number;
  cacheHit?: boolean;
  className?: string;
  showDetailed?: boolean;
}

export const PerformanceMetrics = memo(function PerformanceMetrics({
  loadTime = 0,
  totalItems = 0,
  filteredItems = 0,
  currentPage = 1,
  totalPages = 1,
  cacheHit = false,
  className = '',
  showDetailed = false
}: PerformanceMetricsProps) {
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null);

  useEffect(() => {
    // Mesure de la mémoire si disponible
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      setMemoryUsage(Math.round(memory.usedJSHeapSize / 1024 / 1024));
    }
  }, [loadTime]);

  const formatTime = (ms: number): string => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getPerformanceColor = (ms: number): string => {
    if (ms < 50) return 'text-success bg-success/10';
    if (ms < 200) return 'text-warning bg-warning/10';
    return 'text-destructive bg-destructive/10';
  };

  const filterRatio = totalItems > 0 ? ((filteredItems / totalItems) * 100).toFixed(1) : '0';

  if (!showDetailed && loadTime === 0) return null;

  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-lg p-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-4 text-xs">
        {/* Temps de traitement */}
        {loadTime > 0 && (
          <div className="flex items-center space-x-1">
            <span className="text-gray-500">⚡</span>
            <span className="text-gray-700 font-medium">Traitement:</span>
            <span className={`px-2 py-1 rounded-full font-mono ${getPerformanceColor(loadTime)}`}>
              {formatTime(loadTime)}
            </span>
          </div>
        )}

        {/* Cache */}
        {cacheHit && (
          <div className="flex items-center space-x-1">
            <span className="text-green-500">🚀</span>
            <span className="text-green-700 font-medium">Cache Hit</span>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center space-x-1">
            <span className="text-gray-500">📄</span>
            <span className="text-gray-700">
              Page <span className="font-medium">{currentPage}</span>/{totalPages}
            </span>
          </div>
        )}

        {/* Filtrage */}
        {totalItems > 0 && (
          <div className="flex items-center space-x-1">
            <span className="text-gray-500">🔍</span>
            <span className="text-gray-700">
              <span className="font-medium">{filteredItems.toLocaleString()}</span>
              {filteredItems !== totalItems && (
                <>
                  /{totalItems.toLocaleString()} 
                  <span className="text-blue-600 ml-1">({filterRatio}%)</span>
                </>
              )}
            </span>
          </div>
        )}

        {/* Détails avancés */}
        {showDetailed && (
          <>
            {/* Mémoire */}
            {memoryUsage && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">💾</span>
                <span className="text-gray-700">
                  <span className="font-medium">{memoryUsage}MB</span> RAM
                </span>
              </div>
            )}

            {/* Densité */}
            {totalItems > 0 && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">📊</span>
                <span className="text-gray-700">
                  Densité: <span className="font-medium">{Math.round(totalItems / Math.max(totalPages, 1))}</span>/page
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Barre de progression pour gros volumes */}
      {totalItems > 10000 && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Volume de données</span>
            <span>{totalItems.toLocaleString()} éléments</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (filteredItems / totalItems) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

PerformanceMetrics.displayName = 'PerformanceMetrics';
