/**
 * useVehiclePersistence - Hook + Context pour persistance véhicule
 * 
 * Gère la sauvegarde et récupération automatique du véhicule sélectionné
 * dans localStorage/cookie pour une expérience utilisateur personnalisée.
 * 
 * Features:
 * - Sauvegarde auto dans localStorage
 * - Récupération au chargement
 * - Provider React Context pour partage global
 * - SSR-safe (vérif window)
 * - Type-safe avec Vehicle interface
 * 
 * Usage:
 * ```tsx
 * // Au niveau root
 * <VehicleProvider>
 *   <App />
 * </VehicleProvider>
 * 
 * // Dans n'importe quel composant
 * const { vehicle, setVehicle, clearVehicle } = useVehicle();
 * ```
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { type Vehicle } from '../components/ecommerce/SmartHeader';

// ============================================================================
// Types
// ============================================================================

interface VehicleContextValue {
  /** Véhicule actuellement sélectionné (null si aucun) */
  vehicle: Vehicle | null;
  
  /** Définir un nouveau véhicule (sauvegarde auto) */
  setVehicle: (vehicle: Vehicle | null) => void;
  
  /** Effacer le véhicule sauvegardé */
  clearVehicle: () => void;
  
  /** Vérifier si un véhicule est sauvegardé */
  hasVehicle: boolean;
  
  /** Charger depuis localStorage (manuel si besoin) */
  loadVehicle: () => Vehicle | null;
}

// ============================================================================
// Context
// ============================================================================

const VehicleContext = createContext<VehicleContextValue | undefined>(undefined);

// ============================================================================
// Storage utilities
// ============================================================================

const STORAGE_KEY = 'userVehicle';

/**
 * Sauvegarder véhicule dans localStorage
 */
const saveVehicleToStorage = (vehicle: Vehicle | null): void => {
  if (typeof window === 'undefined') return;
  
  try {
    if (vehicle) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicle));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.error('Erreur sauvegarde véhicule:', error);
  }
};

/**
 * Charger véhicule depuis localStorage
 */
const loadVehicleFromStorage = (): Vehicle | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    
    // Valider structure minimale
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.id &&
      parsed.brand &&
      parsed.model &&
      parsed.year
    ) {
      return parsed as Vehicle;
    }
    
    return null;
  } catch (error) {
    console.error('Erreur chargement véhicule:', error);
    return null;
  }
};

// ============================================================================
// Provider Component
// ============================================================================

interface VehicleProviderProps {
  children: React.ReactNode;
  /** Véhicule initial (optionnel, sinon charge depuis localStorage) */
  initialVehicle?: Vehicle | null;
}

export const VehicleProvider: React.FC<VehicleProviderProps> = ({
  children,
  initialVehicle,
}) => {
  const [vehicle, setVehicleState] = useState<Vehicle | null>(initialVehicle || null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Charger depuis localStorage au montage (uniquement côté client)
  useEffect(() => {
    if (!initialVehicle) {
      const loaded = loadVehicleFromStorage();
      if (loaded) {
        setVehicleState(loaded);
      }
    }
    setIsHydrated(true);
  }, [initialVehicle]);

  // Setter avec sauvegarde auto
  const setVehicle = useCallback((newVehicle: Vehicle | null) => {
    setVehicleState(newVehicle);
    saveVehicleToStorage(newVehicle);
  }, []);

  // Clear
  const clearVehicle = useCallback(() => {
    setVehicleState(null);
    saveVehicleToStorage(null);
  }, []);

  // Load manuel
  const loadVehicle = useCallback(() => {
    return loadVehicleFromStorage();
  }, []);

  // SSR-safe: vehicle est null côté serveur, chargé depuis localStorage côté client
  // isHydrated permet aux composants enfants de savoir si le chargement client est terminé
  const value: VehicleContextValue = {
    vehicle: isHydrated ? vehicle : null, // null sur SSR, valeur réelle après hydratation
    setVehicle,
    clearVehicle,
    hasVehicle: isHydrated && !!vehicle,
    loadVehicle,
  };

  // Toujours rendre les enfants - ne PAS bloquer le SSR
  // Les composants enfants peuvent vérifier hasVehicle ou vehicle === null
  return <VehicleContext.Provider value={value}>{children}</VehicleContext.Provider>;
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook pour accéder au véhicule sauvegardé partout dans l'app
 * 
 * @throws Error si utilisé hors VehicleProvider
 * 
 * @example
 * ```tsx
 * const { vehicle, setVehicle, clearVehicle, hasVehicle } = useVehicle();
 * 
 * // Afficher véhicule
 * {vehicle && <p>{vehicle.brand} {vehicle.model}</p>}
 * 
 * // Sauvegarder véhicule
 * setVehicle({ id: '1', brand: 'Peugeot', model: '208', year: 2016 });
 * 
 * // Effacer
 * clearVehicle();
 * ```
 */
export const useVehicle = (): VehicleContextValue => {
  const context = useContext(VehicleContext);
  
  if (!context) {
    throw new Error('useVehicle must be used within VehicleProvider');
  }
  
  return context;
};

// ============================================================================
// Hook standalone (sans Provider) - Pour usage simple
// ============================================================================

/**
 * Hook standalone pour persistance véhicule sans Provider
 * Utile pour composants isolés qui n'ont pas besoin du Context global
 * 
 * @example
 * ```tsx
 * const [vehicle, setVehicle, clearVehicle] = useVehiclePersistence();
 * ```
 */
export const useVehiclePersistence = (): [
  Vehicle | null,
  (vehicle: Vehicle | null) => void,
  () => void
] => {
  const [vehicle, setVehicleState] = useState<Vehicle | null>(null);

  // Charger au montage
  useEffect(() => {
    const loaded = loadVehicleFromStorage();
    if (loaded) {
      setVehicleState(loaded);
    }
  }, []);

  // Setter avec sauvegarde
  const setVehicle = useCallback((newVehicle: Vehicle | null) => {
    setVehicleState(newVehicle);
    saveVehicleToStorage(newVehicle);
  }, []);

  // Clear
  const clearVehicle = useCallback(() => {
    setVehicleState(null);
    saveVehicleToStorage(null);
  }, []);

  return [vehicle, setVehicle, clearVehicle];
};

// ============================================================================
// Export utilitaires storage (pour usage avancé)
// ============================================================================

export { saveVehicleToStorage, loadVehicleFromStorage, STORAGE_KEY };
