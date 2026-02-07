/**
 * 🔍 SEARCH BAR - Composant de recherche principal v3.0
 *
 * Barre de recherche intelligente avec:
 * ✅ Auto-complétion temps réel
 * ✅ Suggestions contextuelles
 * ✅ Support clavier complet
 * ✅ Recherche instantanée
 * ✅ Historique local
 */

import { Form, useNavigate, useSearchParams } from "@remix-run/react";
import {
  Search,
  X,
  Clock,
  TrendingUp,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

import {
  useEnhancedSearchWithDebounce,
  useEnhancedAutocomplete,
} from "../../hooks/useEnhancedSearch";
import { cn } from "../../lib/utils";
import { searchApi } from "../../services/api/search.api";

interface SearchBarProps {
  initialQuery?: string;
  version?: "v7" | "v8" | "enhanced";
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  showSuggestions?: boolean;
  showHistory?: boolean;
  enableEnhanced?: boolean;
  showMetrics?: boolean;
  onSearch?: (query: string) => void;
}

interface Suggestion {
  type: "suggestion" | "history" | "product" | "vehicle";
  text: string;
  category?: string;
  icon?: React.ReactNode;
  data?: any;
}

export function SearchBar({
  initialQuery = "",
  version = "enhanced",
  placeholder = "Rechercher une pièce, référence, véhicule...",
  className,
  autoFocus = false,
  showSuggestions = true,
  showHistory = true,
  enableEnhanced = true,
  showMetrics = false,
  onSearch,
}: SearchBarProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // État local
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [enhancedMode, setEnhancedMode] = useState(enableEnhanced);
  const [metrics, setMetrics] = useState<any>(null);

  // Hook de recherche Enhanced avec debounce
  const {
    query,
    setQuery,
    debouncedQuery,
    loading: isSearching,
  } = useEnhancedSearchWithDebounce(initialQuery, 300);

  // Hook d'autocomplete Enhanced
  useEnhancedAutocomplete(query);

  // Historique local (localStorage)
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Charger les métriques si activé
  const loadMetrics = useCallback(async () => {
    if (!showMetrics || !enhancedMode) return;

    try {
      const response = await fetch("/api/search-enhanced/metrics");
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.warn("Erreur métriques:", error);
    }
  }, [showMetrics, enhancedMode]);

  // Charger métriques au focus
  useEffect(() => {
    if (isFocused && showMetrics) {
      loadMetrics();
    }
  }, [isFocused, showMetrics, loadMetrics]);

  // Charger l'historique au montage
  useEffect(() => {
    if (typeof window !== "undefined" && showHistory) {
      const stored = localStorage.getItem("search-history");
      if (stored) {
        try {
          setSearchHistory(JSON.parse(stored).slice(0, 5));
        } catch {
          // Ignore les erreurs de parsing
        }
      }
    }
  }, [showHistory]);

  // Recherche de suggestions en temps réel
  const fetchSuggestions = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery || searchQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        // Utiliser le service enhanced si activé
        if (enhancedMode && version === "enhanced") {
          const [autocompleteResult, instantResult] = await Promise.allSettled([
            fetch(
              `/api/search-enhanced/autocomplete?q=${encodeURIComponent(searchQuery)}`,
            ).then((r) => r.json()),
            searchApi.instantSearch(searchQuery),
          ]);

          const newSuggestions: Suggestion[] = [];

          // Suggestions enhanced
          if (autocompleteResult.status === "fulfilled") {
            autocompleteResult.value.suggestions?.forEach((text: string) => {
              newSuggestions.push({
                type: "suggestion",
                text,
                icon: <Sparkles className="w-4 h-4 text-purple-500" />,
              });
            });
          }

          // Résultats instantanés
          if (instantResult.status === "fulfilled") {
            instantResult.value.products.slice(0, 3).forEach((product) => {
              newSuggestions.push({
                type: product.type as "product" | "vehicle",
                text: product.designation,
                category:
                  product.type === "vehicle"
                    ? "Véhicule Enhanced"
                    : "Pièce Enhanced",
                icon: <Zap className="w-4 h-4 text-amber-500" />,
                data: product,
              });
            });
          }

          setSuggestions(newSuggestions);
        } else {
          // Utiliser le service standard
          const result = await searchApi.instantSearch(searchQuery);

          const newSuggestions: Suggestion[] = [];

          // Ajouter les suggestions textuelles
          result.suggestions.forEach((text) => {
            newSuggestions.push({
              type: "suggestion",
              text,
              icon: <TrendingUp className="w-4 h-4 text-blue-500" />,
            });
          });

          // Ajouter les produits/véhicules
          result.products.slice(0, 3).forEach((product) => {
            newSuggestions.push({
              type: product.type as "product" | "vehicle",
              text: product.designation,
              category: product.type === "vehicle" ? "Véhicule" : "Pièce",
              icon:
                product.type === "vehicle" ? (
                  <Search className="w-4 h-4 text-green-500" />
                ) : (
                  <Search className="w-4 h-4 text-orange-500" />
                ),
              data: product,
            });
          });

          setSuggestions(newSuggestions);
        }
      } catch (error) {
        console.warn("Erreur suggestions:", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [enhancedMode, version],
  );

  // Déclencher la recherche de suggestions
  useEffect(() => {
    if (debouncedQuery && isFocused && showSuggestions) {
      fetchSuggestions(debouncedQuery);
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery, isFocused, showSuggestions, fetchSuggestions]);

  // Suggestions visibles (historique + suggestions)
  const getVisibleSuggestions = useCallback((): Suggestion[] => {
    const visible: Suggestion[] = [];

    // Historique si pas de query ou query courte
    if (
      (!query || query.length < 2) &&
      showHistory &&
      searchHistory.length > 0
    ) {
      searchHistory.forEach((historyItem) => {
        visible.push({
          type: "history",
          text: historyItem,
          icon: <Clock className="w-4 h-4 text-gray-400" />,
        });
      });
    }

    // Suggestions de recherche
    visible.push(...suggestions);

    return visible.slice(0, 8); // Limiter à 8 suggestions max
  }, [query, showHistory, searchHistory, suggestions]);

  // Navigation vers page de recherche
  const navigateToSearch = useCallback(
    (searchQuery: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("q", searchQuery);

      // Utiliser enhanced si activé
      if (enhancedMode && version === "enhanced") {
        params.set("type", "enhanced");
        params.set("enhanced", "true");
      } else {
        params.set("type", version);
      }

      params.delete("page"); // Reset pagination

      navigate(`/search?${params.toString()}`);
    },
    [searchParams, enhancedMode, version, navigate],
  );

  // Ajouter à l'historique
  const addToHistory = useCallback(
    (searchQuery: string) => {
      if (!showHistory || typeof window === "undefined") return;

      const newHistory = [
        searchQuery,
        ...searchHistory.filter((item) => item !== searchQuery),
      ].slice(0, 5);

      setSearchHistory(newHistory);
      localStorage.setItem("search-history", JSON.stringify(newHistory));
    },
    [showHistory, searchHistory],
  );

  // Effacer l'historique
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("search-history");
    }
  }, []);

  // Gérer clic sur suggestion
  const handleSuggestionClick = useCallback(
    (suggestion: Suggestion) => {
      setQuery(suggestion.text);
      setIsFocused(false);
      setSelectedIndex(-1);

      // Ajouter à l'historique si ce n'est pas déjà dedans
      addToHistory(suggestion.text);

      // Naviguer vers la page de résultats
      navigateToSearch(suggestion.text);
    },
    [setQuery, addToHistory, navigateToSearch],
  );

  // Gérer soumission du formulaire
  const handleSearch = useCallback(() => {
    if (!query.trim()) return;

    addToHistory(query.trim());
    setIsFocused(false);

    if (onSearch) {
      onSearch(query.trim());
    } else {
      navigateToSearch(query.trim());
    }
  }, [query, addToHistory, onSearch, navigateToSearch]);

  // Gestion du clavier
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const visible = getVisibleSuggestions();

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < visible.length - 1 ? prev + 1 : 0,
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : visible.length - 1,
          );
          break;

        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0) {
            const selected = visible[selectedIndex];
            handleSuggestionClick(selected);
          } else {
            handleSearch();
          }
          break;

        case "Escape":
          setIsFocused(false);
          setSelectedIndex(-1);
          inputRef.current?.blur();
          break;
      }
    },
    [getVisibleSuggestions, selectedIndex, handleSuggestionClick, handleSearch],
  );

  // Suggestions visibles
  const visibleSuggestions = getVisibleSuggestions();
  const showDropdown = isFocused && (visibleSuggestions.length > 0 || loading);

  return (
    <div className={cn("relative w-full max-w-2xl mx-auto", className)}>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <div className="relative">
          {/* Input principal */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-5 h-5 text-gray-400 pointer-events-none z-10" />

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={(e) => {
                // Délai pour permettre le clic sur les suggestions
                setTimeout(() => {
                  if (!suggestionsRef.current?.contains(e.relatedTarget)) {
                    setIsFocused(false);
                    setSelectedIndex(-1);
                  }
                }, 150);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoFocus={autoFocus}
              className="w-full pl-10 pr-12 py-3 text-lg bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              autoComplete="off"
            />

            {/* Boutons droite */}
            <div className="absolute right-2 flex items-center space-x-1">
              {(loading || isSearching) && (
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              )}

              {/* Toggle Enhanced Mode */}
              {enableEnhanced && (
                <button
                  type="button"
                  onClick={() => setEnhancedMode(!enhancedMode)}
                  className={cn(
                    "p-1 rounded-full transition-colors",
                    enhancedMode
                      ? "text-purple-600 bg-purple-100 hover:bg-purple-200"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
                  )}
                  title={
                    enhancedMode
                      ? "Désactiver le mode Enhanced"
                      : "Activer le mode Enhanced"
                  }
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              )}

              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Badge version */}
          <div
            className={cn(
              "absolute -top-2 right-2 px-2 py-1 text-xs font-medium rounded-full",
              version === "enhanced" || enhancedMode ? "purple" : "info",
            )}
          >
            {enhancedMode && version === "enhanced"
              ? "ENHANCED"
              : version.toUpperCase()}
            {enhancedMode && <Sparkles className="w-3 h-3 inline ml-1" />}
          </div>
        </div>

        {/* Dropdown suggestions */}
        {showDropdown && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
          >
            {loading && visibleSuggestions.length === 0 && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin mr-2" />
                <span className="text-gray-600">Recherche...</span>
              </div>
            )}

            {visibleSuggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.type}-${suggestion.text}-${index}`}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className={cn(
                  "w-full flex items-center px-4 py-3 text-left hover:bg-gray-50 transition-colors",
                  selectedIndex === index && "bg-primary/5",
                  "border-b border-gray-100 last:border-b-0",
                )}
              >
                <div className="flex-shrink-0 mr-3">{suggestion.icon}</div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {suggestion.text}
                  </div>
                  {suggestion.category && (
                    <div className="text-sm text-gray-500">
                      {suggestion.category}
                    </div>
                  )}
                </div>

                {suggestion.type === "history" && index === 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearHistory();
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 ml-2"
                  >
                    Effacer
                  </button>
                )}
              </button>
            ))}

            {/* Message si pas de suggestions */}
            {!loading &&
              visibleSuggestions.length === 0 &&
              query.length >= 2 && (
                <div className="px-4 py-3 text-gray-500 text-center">
                  Aucune suggestion trouvée
                </div>
              )}

            {/* Footer avec stats */}
            {visibleSuggestions.length > 0 && (
              <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span>
                      {enhancedMode && version === "enhanced" ? (
                        <>
                          <Sparkles className="w-3 h-3 inline mr-1" />
                          Recherche Enhanced IA
                        </>
                      ) : (
                        `Recherche ${version.toUpperCase()} optimisée`
                      )}
                    </span>
                    <span>• {visibleSuggestions.length} suggestions</span>
                  </div>

                  {showMetrics && metrics && (
                    <div className="flex items-center space-x-2 text-xs">
                      <span>Avg: {metrics.averageResponseTime}ms</span>
                      <span>• {metrics.totalSearches} recherches</span>
                      <span>• {metrics.cacheHitRate.toFixed(1)}% cache</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Form>
    </div>
  );
}
