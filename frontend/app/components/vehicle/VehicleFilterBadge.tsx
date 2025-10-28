/**
 * 🚗 Badge Véhicule Actif
 * 
 * Affiche le véhicule actuellement sélectionné avec option de suppression
 */

import { type VehicleCookie, clearVehicleClient } from '../../utils/vehicle-cookie';

interface VehicleFilterBadgeProps {
  vehicle: VehicleCookie;
  onClear?: () => void;
  showDetails?: boolean;
  className?: string;
}

export function VehicleFilterBadge({ 
  vehicle, 
  onClear,
  showDetails = true,
  className = ''
}: VehicleFilterBadgeProps) {
  
  const handleClear = () => {
    clearVehicleClient();
    
    if (onClear) {
      onClear();
    } else {
      // Par défaut, recharger la page
      window.location.reload();
    }
  };

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          {/* Icône véhicule */}
          <svg 
            className="w-5 h-5 text-blue-600 flex-shrink-0" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
          </svg>

          {/* Texte */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-blue-900">
              Filtré pour : <strong>{vehicle.marque_name} {vehicle.modele_name}</strong>
            </div>
            
            {showDetails && (
              <div className="text-xs text-blue-600 mt-0.5">
                {vehicle.type_name}
              </div>
            )}
          </div>
        </div>

        {/* Bouton supprimer */}
        <button
          onClick={handleClear}
          className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-md transition-colors"
          title="Retirer le filtre véhicule"
        >
          × Retirer
        </button>
      </div>
    </div>
  );
}

// ========================================
// 🎨 VARIANTES
// ========================================

/**
 * Variante compacte pour header/navbar
 */
export function VehicleFilterBadgeCompact({ vehicle, onClear }: VehicleFilterBadgeProps) {
  const handleClear = () => {
    clearVehicleClient();
    onClear?.() || window.location.reload();
  };

  return (
    <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
      </svg>
      
      <span className="text-sm text-blue-900 font-medium">
        {vehicle.marque_name} {vehicle.modele_name}
      </span>
      
      <button
        onClick={handleClear}
        className="text-blue-600 hover:text-blue-800"
        title="Retirer"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Variante chip (pour liste de filtres actifs)
 */
export function VehicleFilterChip({ vehicle, onClear }: VehicleFilterBadgeProps) {
  const handleClear = () => {
    clearVehicleClient();
    onClear?.() || window.location.reload();
  };

  return (
    <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">
      🚗 {vehicle.marque_name} {vehicle.modele_name}
      <button
        onClick={handleClear}
        className="hover:bg-blue-200 rounded-full p-0.5"
        title="Retirer"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </span>
  );
}
