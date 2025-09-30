/**
 * 🔍 SEARCH BAR ENHANCED HOMEPAGE
 * Version améliorée pour la page d'accueil avec :
 * - Design premium avec animations
 * - Suggestions intelligentes avec aperçu
 * - Raccourcis clavier (Cmd/Ctrl + K)
 * - Recherches populaires
 * - Preview des résultats en temps réel
 */

import { Form, useNavigate } from '@remix-run/react';
import { 
  Search, 
  X, 
  Loader2, 
  TrendingUp, 
  History, 
  Package, 
  Tag,
  ArrowRight,
  Zap,
  Command
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { useEnhancedSearchWithDebounce, useEnhancedAutocomplete } from '../../hooks/useEnhancedSearch';
import { cn } from '../../lib/utils';

interface SearchBarEnhancedHomepageProps {
  initialQuery?: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onSearch?: (query: string) => void;
}

// Recherches populaires (à récupérer depuis l'API plus tard)
const POPULAR_SEARCHES = [
  { query: 'plaquettes de frein', icon: Package, count: '12.5K' },
  { query: 'filtres à huile', icon: Package, count: '8.2K' },
  { query: 'disques de frein', icon: Package, count: '7.8K' },
  { query: 'amortisseurs', icon: Package, count: '6.4K' },
  { query: 'courroie de distribution', icon: Package, count: '5.9K' },
];

export function SearchBarEnhancedHomepage({
  initialQuery = '',
  placeholder = 'Rechercher par référence, marque, catégorie...',
  className,
  autoFocus = false,
  onSearch,
}: SearchBarEnhancedHomepageProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // État local
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Hook Enhanced avec debounce
  const { 
    query, 
    setQuery, 
    loading: isSearching, 
    results 
  } = useEnhancedSearchWithDebounce(initialQuery, 200);

  // Hook d'autocomplete Enhanced
  const { suggestions } = useEnhancedAutocomplete(query);

  // Charger les recherches récentes depuis localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentSearches');
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored).slice(0, 3));
      } catch (e) {
        console.error('Error loading recent searches:', e);
      }
    }
  }, []);

  // Sauvegarder une recherche récente
  const saveRecentSearch = (searchQuery: string) => {
    const updated = [
      searchQuery,
      ...recentSearches.filter(s => s !== searchQuery)
    ].slice(0, 5);
    
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  // Raccourci clavier Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsFocused(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Effet de focus automatique
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Suggestions + résultats visibles
  const visibleSuggestions = suggestions.slice(0, 5);
  const previewResults = results?.items?.slice(0, 3) || [];
  const hasContent = query.length > 0 && (visibleSuggestions.length > 0 || previewResults.length > 0);
  const showPopular = isFocused && !query && recentSearches.length === 0;
  const showRecent = isFocused && !query && recentSearches.length > 0;

  // Gestion du clavier
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const maxIndex = visibleSuggestions.length - 1;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => prev < maxIndex ? prev + 1 : 0);
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : maxIndex);
        break;
        
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && visibleSuggestions[selectedIndex]) {
          const suggestion = visibleSuggestions[selectedIndex];
          handleSearch(suggestion);
        } else {
          handleSearch(query);
        }
        break;
        
      case 'Escape':
        setIsFocused(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Gérer clic sur suggestion
  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setIsFocused(false);
    setSelectedIndex(-1);
    handleSearch(suggestion);
  };

  // Gérer soumission
  const handleSearch = (searchQuery?: string) => {
    const finalQuery = (searchQuery || query).trim();
    if (!finalQuery) return;
    
    setIsFocused(false);
    saveRecentSearch(finalQuery);
    
    if (onSearch) {
      onSearch(finalQuery);
    } else {
      navigate(`/search?q=${encodeURIComponent(finalQuery)}`);
    }
  };

  // Vider la recherche
  const handleClear = () => {
    setQuery('');
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('relative w-full', className)}>
      <Form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
        {/* Conteneur principal avec effet glassmorphism */}
        <div className="relative group">
          {/* Glow effect au focus */}
          <div className={cn(
            'absolute inset-0 rounded-2xl opacity-0 blur-xl transition-opacity duration-300',
            'bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400',
            isFocused && 'opacity-20'
          )} />

          {/* Input de recherche */}
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={cn(
                'w-full pl-14 pr-24 py-4 text-lg',
                'border-2 border-white/40 rounded-2xl',
                'bg-white/95 backdrop-blur-md',
                'text-gray-900',
                'focus:border-white focus:ring-4 focus:ring-white/30 focus:outline-none',
                'transition-all duration-300',
                'shadow-xl shadow-black/10',
                'placeholder:text-gray-400',
                isFocused && 'shadow-2xl shadow-black/20 scale-[1.02]'
              )}
            />

            {/* Icône de recherche animée */}
            <div className={cn(
              'absolute left-5 top-1/2 transform -translate-y-1/2',
              'transition-all duration-300',
              isFocused && 'scale-110'
            )}>
              <Search className={cn(
                'w-5 h-5 transition-colors duration-300',
                isFocused ? 'text-blue-500' : 'text-gray-400'
              )} />
            </div>

            {/* Raccourci clavier hint */}
            {!query && !isFocused && (
              <div className="absolute right-5 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-gray-400 text-sm">
                <Command className="w-3 h-3" />
                <span>K</span>
              </div>
            )}

            {/* Bouton clear avec animation */}
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className={cn(
                  'absolute right-14 top-1/2 transform -translate-y-1/2',
                  'p-1.5 hover:bg-gray-200/80 rounded-lg',
                  'transition-all duration-200',
                  'hover:scale-110'
                )}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}

            {/* Indicateur de chargement */}
            {isSearching && (
              <div className="absolute right-5 top-1/2 transform -translate-y-1/2">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              </div>
            )}

            {/* Bouton de recherche */}
            {!isSearching && query && (
              <button
                type="submit"
                className={cn(
                  'absolute right-5 top-1/2 transform -translate-y-1/2',
                  'p-2 bg-gradient-to-r from-blue-500 to-purple-500',
                  'rounded-lg text-white',
                  'hover:from-blue-600 hover:to-purple-600',
                  'transition-all duration-200',
                  'hover:scale-110 hover:shadow-lg'
                )}
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dropdown premium */}
        {(isFocused && (hasContent || showPopular || showRecent)) && (
          <div
            ref={dropdownRef}
            className={cn(
              'absolute z-50 w-full mt-3',
              'bg-white/95 backdrop-blur-xl',
              'border border-gray-200/50',
              'rounded-2xl shadow-2xl',
              'max-h-[500px] overflow-y-auto',
              'animate-in fade-in slide-in-from-top-2 duration-200'
            )}
          >
            {/* Recherches récentes */}
            {showRecent && (
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-3">
                  <History className="w-4 h-4" />
                  <span>Recherches récentes</span>
                </div>
                <div className="space-y-1">
                  {recentSearches.map((recent, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSuggestionClick(recent)}
                      className="w-full px-3 py-2 text-left rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 group"
                    >
                      <History className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      <span className="text-gray-700">{recent}</span>
                      <ArrowRight className="w-4 h-4 text-gray-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recherches populaires */}
            {showPopular && (
              <div className="p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-3">
                  <TrendingUp className="w-4 h-4" />
                  <span>Recherches populaires</span>
                </div>
                <div className="space-y-1">
                  {POPULAR_SEARCHES.map((popular, idx) => {
                    const Icon = popular.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSuggestionClick(popular.query)}
                        className="w-full px-3 py-2.5 text-left rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all flex items-center gap-3 group"
                      >
                        <Icon className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                        <span className="text-gray-700 flex-1">{popular.query}</span>
                        <span className="text-xs text-gray-400 group-hover:text-gray-500">{popular.count}</span>
                        <ArrowRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Suggestions de recherche */}
            {hasContent && visibleSuggestions.length > 0 && (
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-3">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span>Suggestions</span>
                </div>
                <div className="space-y-1">
                  {visibleSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={cn(
                        'w-full px-3 py-2.5 text-left rounded-lg transition-all flex items-center gap-3 group',
                        selectedIndex === index 
                          ? 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200' 
                          : 'hover:bg-gray-50'
                      )}
                    >
                      <Tag className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <span className="text-gray-900 font-medium">{suggestion}</span>
                      <ArrowRight className="w-4 h-4 text-gray-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Aperçu des résultats */}
            {hasContent && previewResults.length > 0 && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <Package className="w-4 h-4" />
                    <span>Aperçu des résultats</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {results?.total} résultats
                  </span>
                </div>
                <div className="space-y-2">
                  {previewResults.map((item: any, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => navigate(`/pieces/${item.id}`)}
                      className="w-full p-3 text-left rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all group border border-transparent hover:border-blue-200"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-blue-100 transition-colors">
                          <Package className="w-4 h-4 text-gray-500 group-hover:text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {item.reference}
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {item.brand} • {item.category}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-300 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
                
                {/* Lien vers tous les résultats */}
                <button
                  type="button"
                  onClick={() => handleSearch()}
                  className="w-full mt-3 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all font-medium flex items-center justify-center gap-2 group"
                >
                  <span>Voir tous les résultats</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}
          </div>
        )}
      </Form>
    </div>
  );
}
