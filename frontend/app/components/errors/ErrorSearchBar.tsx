import { Link, useNavigate } from "@remix-run/react";
import { Search } from "lucide-react";
import { useState, useCallback, memo } from "react";

interface ErrorSearchBarProps {
  placeholder?: string;
  className?: string;
}

/**
 * Barre de recherche réutilisable pour les pages d'erreur
 * Permet aux utilisateurs de trouver rapidement ce qu'ils cherchent
 */
export const ErrorSearchBar = memo(function ErrorSearchBar({
  placeholder = "Rechercher une pièce, un véhicule...",
  className = "",
}: ErrorSearchBarProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    },
    [query, navigate],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative w-full max-w-xl mx-auto ${className}`}
    >
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full px-5 py-4 pl-12 text-gray-900 bg-white border-2 border-gray-200 rounded-xl shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-200 text-base"
          aria-label="Rechercher"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors duration-200"
        >
          Rechercher
        </button>
      </div>

      {/* Suggestions rapides */}
      <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm">
        <span className="text-gray-500">Suggestions :</span>
        <Link
          to="/search?q=plaquettes+frein"
          className="text-primary hover:text-primary/80 hover:underline transition-colors"
        >
          Plaquettes de frein
        </Link>
        <span className="text-gray-300">|</span>
        <Link
          to="/search?q=filtre+huile"
          className="text-primary hover:text-primary/80 hover:underline transition-colors"
        >
          Filtre à huile
        </Link>
        <span className="text-gray-300">|</span>
        <Link
          to="/search?q=amortisseur"
          className="text-primary hover:text-primary/80 hover:underline transition-colors"
        >
          Amortisseurs
        </Link>
      </div>
    </form>
  );
});

export default ErrorSearchBar;
