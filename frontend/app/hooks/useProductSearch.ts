// 📁 frontend/app/hooks/useProductSearch.ts
// 🔍 Hook réutilisable pour la recherche de produits avec debounce

import { useState, useEffect } from "react";
import { logger } from "~/utils/logger";

export interface ProductSearchResult {
  id?: string; // Alias de piece_id pour compatibilité
  piece_id: string;
  name: string;
  reference?: string;
  marque?: string; // Nom court de la marque
  marque_name?: string; // Nom complet de la marque
  price_ttc?: number;
  consigne_ttc?: number; // Support consignes Phase 8
  stock?: number;
  image_url?: string;
}

interface UseProductSearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
  limit?: number;
}

export function useProductSearch(
  query: string,
  options: UseProductSearchOptions = {},
) {
  const { debounceMs = 300, minQueryLength = 2, limit = 8 } = options;

  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset if query too short
    if (query.length < minQueryLength) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Debounce search
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/products/search?query=${encodeURIComponent(query)}&limit=${limit}`,
        );

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setResults(data.results || []);
      } catch (err) {
        logger.error("Erreur recherche produits:", err);
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs, minQueryLength, limit]);

  return {
    results,
    isLoading,
    error,
    hasResults: results.length > 0,
    isEmpty:
      !isLoading && query.length >= minQueryLength && results.length === 0,
  };
}
