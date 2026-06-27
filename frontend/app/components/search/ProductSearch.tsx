// 📁 frontend/app/components/search/ProductSearch.tsx
// 🔍 Composant de recherche produits UNIVERSEL avec dropdown de résultats
// Utilisable partout : Hero, Navbar, Catalogue, etc.

import { Search, Package, TrendingUp, X } from "lucide-react";
import { useState, useEffect, useRef, memo } from "react";
import { useNavigate } from "react-router";
import { Badge } from "~/components/ui/badge";
import { PartImage } from "~/components/ui/ResponsiveImage";
import {
  useProductSearch,
  type ProductSearchResult,
} from "../../hooks/useProductSearch";

interface ProductSearchProps {
  variant?: "hero" | "compact"; // hero = grande pour homepage, compact = petite pour navbar
  className?: string;
  placeholder?: string;
  showSubtext?: boolean; // Afficher le texte sous la barre
}

export const ProductSearch = memo(function ProductSearch({
  variant = "hero",
  className = "",
  placeholder,
  showSubtext = true,
}: ProductSearchProps) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Use shared search hook
  const { results, isLoading, hasResults, isEmpty } = useProductSearch(query, {
    debounceMs: 300,
    minQueryLength: 2,
    limit: 8,
  });

  // Show dropdown when we have results
  useEffect(() => {
    if (hasResults || isEmpty) {
      setShowDropdown(true);
    } else if (query.length < 2) {
      setShowDropdown(false);
    }
  }, [hasResults, isEmpty, query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setShowDropdown(false);
    }
  };

  const handleResultClick = (result: ProductSearchResult) => {
    // Utiliser la référence ou l'ID pour rechercher le produit
    const searchTerm = result.reference || result.piece_id;
    navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
    setShowDropdown(false);
    setQuery("");
  };

  const clearSearch = () => {
    setQuery("");
    setShowDropdown(false);
  };

  // Styles adaptatifs selon variant
  const isHero = variant === "hero";
  const containerClass = isHero ? "max-w-2xl mx-auto mb-8" : "w-full";
  const inputClass = isHero
    ? "w-full px-6 py-4 text-lg text-gray-900 bg-white rounded-lg shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-300 pr-32"
    : "w-full px-4 py-2 text-base text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-24";
  const buttonClass = isHero
    ? "absolute right-2 top-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
    : "absolute right-1 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm";
  const defaultPlaceholder = isHero
    ? "Rechercher par référence, marque, modèle..."
    : "Rechercher une pièce...";

  return (
    <div className={`${containerClass} ${className}`} ref={dropdownRef}>
      <form onSubmit={handleSearch} className="relative">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder || defaultPlaceholder}
            className={inputClass}
          />

          {/* Clear button */}
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-36 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Search button */}
          <button type="submit" className={buttonClass}>
            <Search className="w-4 h-4" />
            {isHero && "Rechercher"}
          </button>
        </div>

        {/* Dropdown Results */}
        {showDropdown && (
          <div className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-[500px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 mx-auto"></div>
                <p className="mt-2 text-gray-600">Recherche en cours...</p>
              </div>
            ) : results.length > 0 ? (
              <>
                <div className="p-3 bg-gray-50 border-b border-gray-200">
                  <p className="text-sm text-gray-600">
                    <TrendingUp className="w-4 h-4 inline mr-1" />
                    {results.length} résultat{results.length > 1 ? "s" : ""}{" "}
                    trouvé{results.length > 1 ? "s" : ""}
                  </p>
                </div>
                <ul className="divide-y divide-gray-100">
                  {results.map((result) => (
                    <li key={result.piece_id}>
                      <button
                        type="button"
                        onClick={() => handleResultClick(result)}
                        className="w-full p-4 hover:bg-info/20 transition-colors flex items-center gap-4 text-left"
                      >
                        {/* Image responsive */}
                        <div className="shrink-0 w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                          {result.image_url ? (
                            <PartImage
                              src={result.image_url}
                              alt={result.name}
                              className="w-full h-full object-cover"
                              sizes="64px"
                            />
                          ) : (
                            <Package className="w-8 h-8 text-gray-400" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {result.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {result.marque_name && (
                              <Badge variant="info">{result.marque_name}</Badge>
                            )}
                            {result.reference && (
                              <span className="text-xs text-gray-500">
                                Réf: {result.reference}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Price & Stock */}
                        <div className="text-right shrink-0">
                          {result.price_ttc && (
                            <p className="font-bold text-blue-600">
                              {result.price_ttc.toFixed(2)} €
                            </p>
                          )}
                          {result.stock !== undefined && (
                            <p className="text-xs text-gray-500 mt-1">
                              {result.stock > 0 ? (
                                <span className="text-green-600">
                                  ✓ En stock
                                </span>
                              ) : (
                                <span className="text-red-600">Rupture</span>
                              )}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>

                {/* View all results */}
                <div className="p-3 bg-gray-50 border-t border-gray-200">
                  <button
                    type="submit"
                    className="w-full py-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
                  >
                    Voir tous les résultats pour "{query}"
                  </button>
                </div>
              </>
            ) : query.length >= 2 ? (
              <div className="p-8 text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 mb-2">
                  Aucun résultat pour "{query}"
                </p>
                <p className="text-sm text-gray-500">
                  Essayez avec un autre terme ou utilisez le sélecteur de
                  véhicule
                </p>
              </div>
            ) : null}
          </div>
        )}
      </form>

      {/* Subtext optionnel (seulement en mode hero) */}
      {showSubtext && isHero && (
        <p className="text-sm text-blue-200 mt-2 text-center">
          Ou sélectionnez votre véhicule ci-dessous pour un catalogue
          personnalisé
        </p>
      )}
    </div>
  );
});
