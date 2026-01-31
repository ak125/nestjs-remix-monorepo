/**
 * useProductCompatibility Hook
 * @description Hook for checking product-vehicle compatibility
 * @version 2.0.0
 *
 * Provides:
 * - Automatic compatibility check when vehicle context changes
 * - Manual check trigger
 * - Loading and error states
 * - Caching of results
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================================
// Types
// ============================================================================

export interface CompatibilityResult {
  isCompatible: boolean;
  confidenceScore: number;
  source: "direct" | "oem_match" | "cross_reference" | "inferred";
  vehicle?: {
    typeId: number;
    typeName: string;
    brandName: string;
    modelName: string;
  };
}

export interface UseProductCompatibilityOptions {
  /** Auto-check when vehicle changes */
  autoCheck?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
}

export interface UseProductCompatibilityReturn {
  /** Compatibility result */
  compatibility: CompatibilityResult | null;
  /** Whether a check is in progress */
  isChecking: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether a vehicle is selected */
  hasVehicle: boolean;
  /** Manually trigger a compatibility check */
  checkCompatibility: (typeId: number) => Promise<CompatibilityResult | null>;
  /** Clear the cached result */
  clearCache: () => void;
}

// Simple cache for compatibility results
const compatibilityCache = new Map<
  string,
  { result: CompatibilityResult; timestamp: number }
>();

// ============================================================================
// Hook Implementation
// ============================================================================

export function useProductCompatibility(
  productId: number | string | null | undefined,
  typeId?: number | string | null,
  options: UseProductCompatibilityOptions = {},
): UseProductCompatibilityReturn {
  const { autoCheck = true, cacheTtl = 5 * 60 * 1000 } = options; // 5 min cache

  const [compatibility, setCompatibility] =
    useState<CompatibilityResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if component is mounted
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Generate cache key
  const getCacheKey = useCallback(
    (pId: number | string, tId: number | string) => `${pId}-${tId}`,
    [],
  );

  // Check if cache is valid
  const getCachedResult = useCallback(
    (
      pId: number | string,
      tId: number | string,
    ): CompatibilityResult | null => {
      const key = getCacheKey(pId, tId);
      const cached = compatibilityCache.get(key);
      if (cached && Date.now() - cached.timestamp < cacheTtl) {
        return cached.result;
      }
      return null;
    },
    [getCacheKey, cacheTtl],
  );

  // Set cache
  const setCachedResult = useCallback(
    (
      pId: number | string,
      tId: number | string,
      result: CompatibilityResult,
    ) => {
      const key = getCacheKey(pId, tId);
      compatibilityCache.set(key, { result, timestamp: Date.now() });
    },
    [getCacheKey],
  );

  // Check compatibility
  const checkCompatibility = useCallback(
    async (vehicleTypeId: number): Promise<CompatibilityResult | null> => {
      if (!productId) {
        setError("Product ID is required");
        return null;
      }

      // Check cache first
      const cached = getCachedResult(productId, vehicleTypeId);
      if (cached) {
        setCompatibility(cached);
        setError(null);
        return cached;
      }

      setIsChecking(true);
      setError(null);

      try {
        const response = await fetch("/api/compatibility/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: Number(productId),
            typeId: vehicleTypeId,
          }),
        });

        if (!response.ok) {
          throw new Error("Erreur lors de la vérification de compatibilité");
        }

        const result: CompatibilityResult = await response.json();

        if (isMountedRef.current) {
          setCompatibility(result);
          setCachedResult(productId, vehicleTypeId, result);
        }

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Une erreur est survenue";
        if (isMountedRef.current) {
          setError(errorMessage);
          setCompatibility(null);
        }
        return null;
      } finally {
        if (isMountedRef.current) {
          setIsChecking(false);
        }
      }
    },
    [productId, getCachedResult, setCachedResult],
  );

  // Clear cache
  const clearCache = useCallback(() => {
    if (productId && typeId) {
      const key = getCacheKey(productId, typeId);
      compatibilityCache.delete(key);
    }
    setCompatibility(null);
    setError(null);
  }, [productId, typeId, getCacheKey]);

  // Auto-check when typeId changes
  useEffect(() => {
    if (!autoCheck || !productId || !typeId) {
      return;
    }

    const numericTypeId = Number(typeId);
    if (isNaN(numericTypeId)) {
      return;
    }

    // Check cache first
    const cached = getCachedResult(productId, numericTypeId);
    if (cached) {
      setCompatibility(cached);
      return;
    }

    // Perform check
    checkCompatibility(numericTypeId);
  }, [productId, typeId, autoCheck, checkCompatibility, getCachedResult]);

  return {
    compatibility,
    isChecking,
    error,
    hasVehicle: !!typeId,
    checkCompatibility,
    clearCache,
  };
}

// ============================================================================
// Utility: Extract type ID from vehicle object
// ============================================================================

export function extractTypeIdFromVehicle(vehicle: {
  id?: number | string;
  type_id?: number | string;
  typeId?: number | string;
}): number | null {
  const id = vehicle.type_id || vehicle.typeId || vehicle.id;
  if (id === undefined || id === null) return null;
  const numericId = Number(id);
  return isNaN(numericId) ? null : numericId;
}

// ============================================================================
// Utility: Clear all compatibility cache
// ============================================================================

export function clearAllCompatibilityCache(): void {
  compatibilityCache.clear();
}
