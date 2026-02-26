/**
 * useVehiclePersistence - Hook standalone pour persistance véhicule
 *
 * Gère la sauvegarde et récupération du véhicule sélectionné
 * dans localStorage pour une expérience utilisateur personnalisée.
 *
 * SSR-safe (vérif window), type-safe avec Vehicle interface.
 *
 * @example
 * ```tsx
 * const [vehicle, setVehicle, clearVehicle] = useVehiclePersistence();
 * ```
 */

import { useState, useEffect, useCallback } from "react";
import { logger } from "~/utils/logger";
import { type Vehicle } from "../components/ecommerce/SmartHeader";

// ============================================================================
// Storage utilities
// ============================================================================

const STORAGE_KEY = "userVehicle";

/**
 * Sauvegarder véhicule dans localStorage
 */
const saveVehicleToStorage = (vehicle: Vehicle | null): void => {
  if (typeof window === "undefined") return;

  try {
    if (vehicle) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicle));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    logger.error("Erreur sauvegarde véhicule:", error);
  }
};

/**
 * Charger véhicule depuis localStorage
 */
const loadVehicleFromStorage = (): Vehicle | null => {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);

    // Valider structure minimale
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.id &&
      parsed.brand &&
      parsed.model &&
      parsed.year
    ) {
      return parsed as Vehicle;
    }

    return null;
  } catch (error) {
    logger.error("Erreur chargement véhicule:", error);
    return null;
  }
};

// ============================================================================
// Hook standalone
// ============================================================================

/**
 * Hook standalone pour persistance véhicule via localStorage
 *
 * @example
 * ```tsx
 * const [vehicle, setVehicle, clearVehicle] = useVehiclePersistence();
 * ```
 */
export const useVehiclePersistence = (): [
  Vehicle | null,
  (vehicle: Vehicle | null) => void,
  () => void,
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
