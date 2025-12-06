/**
 * 🔍 QUICK SEARCH BAR - Phase 9
 *
 * Barre de recherche rapide inline avec dropdown de résultats
 *
 * Features:
 * ✅ Recherche instantanée avec debounce (300ms)
 * ✅ Dropdown de résultats sous l'input
 * ✅ Ajout au panier direct depuis résultats
 * ✅ Affichage image, nom, réf, marque, prix, consigne
 * ✅ Responsive mobile/desktop
 * ✅ Escape + click outside pour fermer
 * ✅ Clear button (X) pour réinitialiser
 * ✅ Lien "Voir tous les résultats" si >10 produits
 */

import { Link } from "@remix-run/react";
import { Search, ShoppingCart, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PartImage } from "~/components/ui/ResponsiveImage";
import { useProductSearch } from "../../hooks/useProductSearch";

interface QuickSearchBarProps {
  className?: string;
}

export function QuickSearchBar({ className = "" }: QuickSearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use shared search hook
  const { results, isLoading } = useProductSearch(searchQuery, {
    debounceMs: 300,
    minQueryLength: 2,
    limit: 10,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // Open dropdown when we have results
  useEffect(() => {
    if (searchQuery.length >= 2 && results.length > 0) {
      setIsOpen(true);
    } else if (searchQuery.length < 2) {
      setIsOpen(false);
    }
  }, [searchQuery, results]);

  // Add to cart function
  const handleAddToCart = async (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
        credentials: "include",
      });

      if (response.ok) {
        console.log("Added to cart!");
        // Could trigger cart refresh here or show toast
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder="Rechercher une pièce..."
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Effacer"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          )}

          {!isLoading && searchQuery && results.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Aucun résultat trouvé pour "{searchQuery}"
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="divide-y divide-gray-100">
              {results.map((product) => (
                <Link
                  key={product.piece_id}
                  to={`/products/${product.piece_id}`}
                  onClick={() => {
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
                >
                  {product.image_url ? (
                    <PartImage
                      src={product.image_url}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded border"
                      sizes="48px"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                      <Search className="w-6 h-6 text-gray-400" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 line-clamp-1">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {product.reference && (
                        <span className="text-xs text-gray-500">
                          Réf: {product.reference}
                        </span>
                      )}
                      {(product.marque || product.marque_name) && (
                        <span className="text-xs text-gray-600 font-medium">
                          {product.marque || product.marque_name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      {product.price_ttc && (
                        <div className="font-semibold text-blue-600">
                          {product.price_ttc.toFixed(2)}€
                        </div>
                      )}
                      {product.consigne_ttc && product.consigne_ttc > 0 && (
                        <div className="text-xs text-gray-500">
                          +{product.consigne_ttc.toFixed(2)}€
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleAddToCart(product.piece_id, e)}
                      className="p-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded transition-colors"
                      title="Ajouter au panier"
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </button>
                  </div>
                </Link>
              ))}

              {results.length >= 10 && (
                <div className="p-3 text-center">
                  <Link
                    to={`/products?search=${encodeURIComponent(searchQuery)}`}
                    onClick={() => {
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Voir tous les résultats →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
