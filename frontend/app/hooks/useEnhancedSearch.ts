/**
 * 🚀 useEnhancedSearch Hook
 *
 * Hook personnalisé pour utiliser le service de recherche enhanced
 * avec gestion d'état, cache, et métriques intégrées
 */

import { useState, useCallback, useEffect } from "react";
import { logger } from "~/utils/logger";

interface EnhancedSearchOptions {
  enableCache?: boolean;
  enableAnalytics?: boolean;
  enablePersonalization?: boolean;
  fuzzySearch?: boolean;
  semanticSearch?: boolean;
}

interface EnhancedSearchParams {
  query: string;
  page?: number;
  limit?: number;
  options?: EnhancedSearchOptions;
}

interface EnhancedSearchResult {
  items: any[];
  total: number;
  page: number;
  limit: number;
  executionTime: number;
  features: string[];
}

interface SearchMetrics {
  totalSearches: number;
  successfulSearches: number;
  averageResponseTime: number;
  cacheHitRate: number;
  popularQueries: Array<{ query: string; count: number }>;
}

export function useEnhancedSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<EnhancedSearchResult | null>(null);
  const [metrics, setMetrics] = useState<SearchMetrics | null>(null);

  // Fonction de recherche principale
  const search = useCallback(async (params: EnhancedSearchParams) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams({
        query: params.query,
        ...(params.page && { page: params.page.toString() }),
        ...(params.limit && { limit: params.limit.toString() }),
      });

      const response = await fetch(
        `/api/search-existing/search?${searchParams}`,
      );

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResults(data);
      return data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMessage);
      logger.error("Erreur recherche enhanced:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fonction d'autocomplete
  const autocomplete = useCallback(async (query: string): Promise<string[]> => {
    if (query.length < 2) return [];

    try {
      const response = await fetch(
        `/api/search-existing/autocomplete?q=${encodeURIComponent(query)}`,
      );

      if (!response.ok) {
        throw new Error("Erreur autocomplete");
      }

      const data = await response.json();
      return data.suggestions || [];
    } catch (err) {
      logger.warn("Erreur autocomplete:", err);
      return [];
    }
  }, []);

  // Charger les métriques
  const loadMetrics = useCallback(async () => {
    try {
      const response = await fetch("/api/search-existing/metrics");

      if (!response.ok) {
        throw new Error("Erreur métriques");
      }

      const data = await response.json();
      setMetrics(data);
      return data;
    } catch (err) {
      logger.warn("Erreur métriques:", err);
      return null;
    }
  }, []);

  // Vérifier le status du service
  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/search-existing/health");

      if (!response.ok) {
        throw new Error("Service indisponible");
      }

      const data = await response.json();
      return data;
    } catch (err) {
      logger.warn("Erreur health check:", err);
      return {
        status: "error",
        error: err instanceof Error ? err.message : "Erreur inconnue",
      };
    }
  }, []);

  // Charger les métriques automatiquement
  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return {
    // État
    loading,
    error,
    results,
    metrics,

    // Actions
    search,
    autocomplete,
    loadMetrics,
    checkHealth,

    // Helpers
    clearResults: () => setResults(null),
    clearError: () => setError(null),
  };
}

/**
 * Hook simplifié pour la recherche avec debounce
 */
export function useEnhancedSearchWithDebounce(initialQuery = "", delay = 300) {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const { search, loading, results, error } = useEnhancedSearch();

  // Debounce de la query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, delay);

    return () => clearTimeout(timer);
  }, [query, delay]);

  // Lancer la recherche automatiquement
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      search({ query: debouncedQuery });
    }
  }, [debouncedQuery, search]);

  return {
    query,
    setQuery,
    debouncedQuery,
    loading,
    results,
    error,
    search: (newQuery: string) => {
      setQuery(newQuery);
      return search({ query: newQuery });
    },
  };
}

/**
 * Hook pour les suggestions autocomplete
 */
export function useEnhancedAutocomplete(query: string, delay = 300) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { autocomplete } = useEnhancedSearch();

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await autocomplete(query);
        setSuggestions(results);
      } catch (err) {
        logger.warn("Erreur autocomplete:", err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [query, delay, autocomplete]);

  return { suggestions, loading };
}
