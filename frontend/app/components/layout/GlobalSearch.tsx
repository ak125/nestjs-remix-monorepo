/**
 * 🔍 GLOBAL SEARCH - Recherche universelle avancée
 *
 * Recherche globale sophisticated avec:
 * ✅ Raccourci clavier Ctrl+K / Cmd+K
 * ✅ Recherche en temps réel avec debounce
 * ✅ Filtres par catégorie avancés avec compteurs
 * ✅ Historique persistant localStorage
 * ✅ Navigation clavier complète
 * ✅ Interface modale overlay avec animations
 * ✅ Groupement intelligent des résultats
 * ✅ Surlignage des termes de recherche
 * ✅ Raccourcis catégories (Cmd+1-6)
 */

import { useFetcher } from "@remix-run/react";
import {
  Search,
  X,
  Clock,
  Package,
  Users,
  ShoppingCart,
  FileText,
  Settings,
  ArrowRight,
  Command,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback, memo } from "react";

import { Badge } from "~/components/ui";
import { logger } from "~/utils/logger";

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  placeholder?: string;
  maxResults?: number;
}

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  category: "products" | "users" | "orders" | "pages" | "settings";
  url: string;
  metadata?: {
    badge?: string;
    price?: string;
    status?: string;
  };
}

interface SearchHistory {
  query: string;
  timestamp: number;
  category?: string;
}

const CATEGORIES = [
  { key: "all", label: "Tout", icon: Search, shortcut: "1" },
  { key: "products", label: "Produits", icon: Package, shortcut: "2" },
  { key: "users", label: "Utilisateurs", icon: Users, shortcut: "3" },
  { key: "orders", label: "Commandes", icon: ShoppingCart, shortcut: "4" },
  { key: "pages", label: "Pages", icon: FileText, shortcut: "5" },
  { key: "settings", label: "Paramètres", icon: Settings, shortcut: "6" },
] as const;

const STORAGE_KEY = "global-search-history";
const MAX_HISTORY = 10;
const DEBOUNCE_MS = 300;

// Fonction pour surligner les termes de recherche
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 text-gray-900 font-medium">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export const GlobalSearch = memo(function GlobalSearch({
  isOpen,
  onClose,
  placeholder = "Rechercher...",
  maxResults = 20,
}: GlobalSearchProps) {
  const fetcher = useFetcher<{ results: SearchResult[] }>();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Charger l'historique depuis localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSearchHistory(JSON.parse(saved));
      }
    } catch (error) {
      logger.warn("Erreur chargement historique recherche:", error);
    }
  }, []);

  // Focus automatique à l'ouverture
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Sauvegarder dans l'historique
  const saveToHistory = useCallback(
    (searchQuery: string, category?: string) => {
      if (!searchQuery.trim()) return;

      const newEntry: SearchHistory = {
        query: searchQuery,
        timestamp: Date.now(),
        category,
      };

      setSearchHistory((prev) => {
        const filtered = prev.filter((item) => item.query !== searchQuery);
        const newHistory = [newEntry, ...filtered].slice(0, MAX_HISTORY);

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
        } catch (error) {
          logger.warn("Erreur sauvegarde historique:", error);
        }

        return newHistory;
      });
    },
    [],
  );

  // Recherche avec debounce
  const performSearch = useCallback(
    (searchQuery: string, category: string) => {
      if (!searchQuery.trim()) {
        setShowHistory(true);
        return;
      }

      setShowHistory(false);

      const searchParams = new URLSearchParams({
        q: searchQuery,
        category: category !== "all" ? category : "",
        limit: maxResults.toString(),
      });

      fetcher.load(`/api/search/global?${searchParams}`);
    },
    [fetcher, maxResults],
  );

  // Gérer le changement de query avec debounce
  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      setSelectedIndex(-1);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        performSearch(value, selectedCategory);
      }, DEBOUNCE_MS);
    },
    [performSearch, selectedCategory],
  );

  // Sélectionner un résultat
  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      saveToHistory(
        query,
        selectedCategory !== "all" ? selectedCategory : undefined,
      );
      onClose();
      // Navigation vers le résultat
      window.location.href = result.url;
    },
    [query, selectedCategory, saveToHistory, onClose],
  );

  // Navigation clavier
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const results = fetcher.data?.results || [];
      const historyItems = showHistory ? searchHistory : [];
      const totalItems = showHistory ? historyItems.length : results.length;

      // Raccourcis pour changer de catégorie (Cmd+1 à Cmd+6)
      if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "6") {
        e.preventDefault();
        const categoryIndex = parseInt(e.key) - 1;
        const category = CATEGORIES[categoryIndex];
        if (category) {
          setSelectedCategory(category.key);
          if (query.trim()) {
            performSearch(query, category.key);
          }
        }
        return;
      }

      switch (e.key) {
        case "Escape":
          onClose();
          break;

        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % totalItems);
          break;

        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev <= 0 ? totalItems - 1 : prev - 1));
          break;

        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0) {
            if (showHistory && selectedIndex < historyItems.length) {
              const historyItem = historyItems[selectedIndex];
              setQuery(historyItem.query);
              if (historyItem.category) {
                setSelectedCategory(historyItem.category);
              }
              performSearch(
                historyItem.query,
                historyItem.category || selectedCategory,
              );
            } else if (!showHistory && selectedIndex < results.length) {
              const result = results[selectedIndex];
              handleSelectResult(result);
            }
          } else if (query.trim()) {
            saveToHistory(
              query,
              selectedCategory !== "all" ? selectedCategory : undefined,
            );
            performSearch(query, selectedCategory);
          }
          break;
      }
    },
    [
      fetcher.data?.results,
      searchHistory,
      showHistory,
      selectedIndex,
      query,
      selectedCategory,
      onClose,
      performSearch,
      saveToHistory,
      handleSelectResult,
    ],
  );

  // Nettoyer l'historique
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Raccourci clavier global pour ouvrir/fermer
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Déclencher l'ouverture depuis le parent
        }
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const results = fetcher.data?.results || [];
  const isLoading = fetcher.state === "loading";

  // Calculer le nombre de résultats par catégorie
  const resultsByCategory = results.reduce(
    (acc, result) => {
      acc[result.category] = (acc[result.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[10vh] animate-in fade-in duration-200">
      {/* Overlay pour fermer */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal de recherche avec animation */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden animate-in slide-in-from-top-4 duration-300">
        {/* Header avec barre de recherche */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 text-lg outline-none placeholder-gray-400"
            />
            {isLoading && (
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Filtres par catégorie */}
          <div className="flex space-x-2 mt-3 overflow-x-auto pb-2">
            {CATEGORIES.map(({ key, label, icon: Icon, shortcut }) => {
              const count =
                key === "all" ? results.length : resultsByCategory[key] || 0;
              const hasResults = !showHistory && query.trim() && count > 0;

              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedCategory(key);
                    if (query.trim()) {
                      performSearch(query, key);
                    }
                  }}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
                    selectedCategory === key
                      ? "bg-blue-600 text-white shadow-md scale-105"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                  {hasResults && (
                    <span
                      className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                        selectedCategory === key
                          ? "bg-white/20 text-white"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                  <kbd
                    className={`hidden lg:inline-flex text-[10px] px-1 rounded border ${
                      selectedCategory === key
                        ? "border-white/30 bg-white/10 text-white"
                        : "border-gray-300 bg-white text-gray-500"
                    }`}
                  >
                    ⌘{shortcut}
                  </kbd>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu des résultats */}
        <div ref={resultsRef} className="max-h-96 overflow-y-auto">
          {showHistory && searchHistory.length > 0 && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>Recherches récentes</span>
                </div>
                <button
                  onClick={clearHistory}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Effacer
                </button>
              </div>

              {searchHistory.map((item, index) => (
                <div
                  key={`${item.query}-${item.timestamp}`}
                  onClick={() => {
                    setQuery(item.query);
                    if (item.category) {
                      setSelectedCategory(item.category);
                    }
                    performSearch(
                      item.query,
                      item.category || selectedCategory,
                    );
                  }}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedIndex === index ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{item.query}</span>
                    {item.category && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        {
                          CATEGORIES.find((cat) => cat.key === item.category)
                            ?.label
                        }
                      </span>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                </div>
              ))}
            </div>
          )}

          {!showHistory && query && (
            <div className="p-4">
              {results.length === 0 && !isLoading && (
                <div className="text-center py-8 text-gray-500">
                  <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>Aucun résultat trouvé pour "{query}"</p>
                </div>
              )}

              {results.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-600 mb-3">
                    {results.length} résultat{results.length > 1 ? "s" : ""}{" "}
                    trouvé{results.length > 1 ? "s" : ""}
                  </div>

                  {/* Grouper par catégorie */}
                  {Object.entries(
                    results.reduce(
                      (acc, result) => {
                        const category = result.category;
                        if (!acc[category]) acc[category] = [];
                        acc[category].push(result);
                        return acc;
                      },
                      {} as Record<string, SearchResult[]>,
                    ),
                  ).map(([category, categoryResults]) => (
                    <div key={category} className="mb-4">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        {CATEGORIES.find((cat) => cat.key === category)
                          ?.label || category}
                      </div>

                      {categoryResults.map((result, index) => {
                        const globalIndex = results.indexOf(result);
                        const Icon =
                          CATEGORIES.find((cat) => cat.key === result.category)
                            ?.icon || FileText;

                        return (
                          <div
                            key={result.id}
                            onClick={() => handleSelectResult(result)}
                            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                              selectedIndex === globalIndex
                                ? "bg-blue-50 border-l-4 border-blue-600 shadow-sm scale-[1.02]"
                                : "hover:bg-gray-50 border-l-4 border-transparent"
                            }`}
                          >
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <Icon
                                className={`w-5 h-5 flex-shrink-0 ${
                                  selectedIndex === globalIndex
                                    ? "text-blue-600"
                                    : "text-gray-400"
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-900 truncate">
                                  {highlightMatch(result.title, query)}
                                </p>
                                {result.description && (
                                  <p className="text-sm text-gray-500 truncate">
                                    {highlightMatch(result.description, query)}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 ml-2">
                              {result.metadata?.badge && (
                                <Badge variant="success" className="text-xs">
                                  {result.metadata.badge}
                                </Badge>
                              )}
                              {result.metadata?.price && (
                                <span className="font-semibold text-blue-600 text-sm">
                                  {result.metadata.price}
                                </span>
                              )}
                              {result.metadata?.status && (
                                <Badge variant="outline" className="text-xs">
                                  {result.metadata.status}
                                </Badge>
                              )}
                              <ArrowRight
                                className={`w-4 h-4 transition-transform ${
                                  selectedIndex === globalIndex
                                    ? "text-blue-600 translate-x-1"
                                    : "text-gray-300"
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!showHistory && !query && (
            <div className="p-8 text-center text-gray-500">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Command className="w-5 h-5" />
                <span className="text-sm">Raccourci : Ctrl+K ou Cmd+K</span>
              </div>
              <p className="text-sm">Commencez à taper pour rechercher...</p>
            </div>
          )}
        </div>

        {/* Footer avec raccourcis améliorés */}
        <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-blue-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-4 text-gray-600">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px]">
                  ↑↓
                </kbd>
                Naviguer
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px]">
                  Enter
                </kbd>
                Sélectionner
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px]">
                  Esc
                </kbd>
                Fermer
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-1 text-blue-600 font-medium">
              <Command className="w-3 h-3" />
              <span>+</span>
              <kbd className="px-1.5 py-0.5 bg-white border border-blue-300 rounded text-[10px]">
                1-6
              </kbd>
              <span>Catégories</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Hook pour utiliser GlobalSearch facilement
export function useGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Écouter le raccourci clavier global
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { isOpen, open, close };
}
