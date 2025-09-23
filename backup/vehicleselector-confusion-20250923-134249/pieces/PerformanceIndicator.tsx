import React from 'react';

interface PerformanceIndicatorProps {
  performance?: {
    total_time_ms: number;
    parallel_time_ms: number;
    motorisations_count: number;
    catalogue_famille_count: number;
    equipementiers_count: number;
    conseils_count: number;
    informations_count: number;
    guide_available: number;
  };
}

export default function PerformanceIndicator({ performance }: PerformanceIndicatorProps) {
  if (!performance) return null;

  const totalSections = performance.motorisations_count + 
                       performance.catalogue_famille_count + 
                       performance.equipementiers_count + 
                       performance.conseils_count + 
                       performance.informations_count + 
                       performance.guide_available;

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getSpeedBadge = (ms: number) => {
    if (ms < 500) return { text: "Ultra-rapide", color: "bg-green-500" };
    if (ms < 1000) return { text: "Très rapide", color: "bg-blue-500" };
    if (ms < 2000) return { text: "Rapide", color: "bg-yellow-500" };
    return { text: "Normal", color: "bg-gray-500" };
  };

  const speedBadge = getSpeedBadge(performance.total_time_ms);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          ⚡ API Complète - Performances optimisées
          <span className={`px-2 py-1 rounded-full text-white text-xs font-medium ${speedBadge.color}`}>
            {speedBadge.text}
          </span>
        </h3>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">{formatTime(performance.total_time_ms)}</div>
          <div className="text-xs text-gray-500">Temps de réponse</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{performance.motorisations_count}</div>
          <div className="text-xs text-gray-600">Motorisations</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{performance.catalogue_famille_count}</div>
          <div className="text-xs text-gray-600">Pièces similaires</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            {performance.parallel_time_ms < performance.total_time_ms ? 
              `${Math.round(performance.total_time_ms / performance.parallel_time_ms)}x` : '1x'}
          </div>
          <div className="text-xs text-gray-600">Plus rapide</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-indigo-600">
            {Math.round((totalSections / 6) * 100)}%
          </div>
          <div className="text-xs text-gray-600">Fonctionnalités</div>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-blue-200">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>Requêtes parallèles: {formatTime(performance.parallel_time_ms)}</span>
          <span>{totalSections} sections chargées</span>
        </div>
      </div>
    </div>
  );
}