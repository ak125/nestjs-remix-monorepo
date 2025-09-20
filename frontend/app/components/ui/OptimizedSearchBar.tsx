/**
 * 🔍 BARRE DE RECHERCHE OPTIMISÉE
 * 
 * Composant de recherche avec debouncing pour performance optimale
 */

import { useState, useEffect, useCallback, memo } from 'react';

interface OptimizedSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  showResults?: boolean;
  resultCount?: number;
  totalCount?: number;
  className?: string;
  disabled?: boolean;
}

export const OptimizedSearchBar = memo(function OptimizedSearchBar({
  value,
  onChange,
  placeholder = "Rechercher...",
  debounceMs = 300,
  showResults = false,
  resultCount = 0,
  totalCount = 0,
  className = '',
  disabled = false
}: OptimizedSearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isTyping, setIsTyping] = useState(false);

  // 🕐 Debouncing pour éviter trop de recherches
  useEffect(() => {
    if (localValue === value) return;

    setIsTyping(true);
    const timer = setTimeout(() => {
      onChange(localValue);
      setIsTyping(false);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      setIsTyping(false);
    };
  }, [localValue, onChange, debounceMs, value]);

  // Synchroniser avec la prop externe
  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value);
    }
  }, [value, localValue]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  }, [handleClear]);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        {/* Icône de recherche */}
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          {isTyping ? (
            <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
          ) : (
            <svg
              className="w-4 h-4 text-gray-400"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 20 20"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
              />
            </svg>
          )}
        </div>

        {/* Input de recherche */}
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 transition-colors"
          autoComplete="off"
        />

        {/* Bouton clear */}
        {localValue && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
            type="button"
            aria-label="Effacer la recherche"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Résultats de recherche */}
      {showResults && localValue && !isTyping && (
        <div className="absolute z-10 w-full mt-1 text-xs text-gray-600 bg-white border border-gray-200 rounded-md shadow-sm">
          <div className="px-3 py-2">
            {resultCount > 0 ? (
              <span>
                <span className="font-medium text-blue-600">{resultCount.toLocaleString()}</span> résultat{resultCount > 1 ? 's' : ''} 
                {totalCount > 0 && (
                  <span> sur <span className="font-medium">{totalCount.toLocaleString()}</span></span>
                )}
              </span>
            ) : (
              <span className="text-gray-500">Aucun résultat trouvé</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

OptimizedSearchBar.displayName = 'OptimizedSearchBar';
