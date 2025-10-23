/**
 * 🚫 NO RESULTS - Composant d'état vide avec suggestions v3.0
 */

interface NoResultsProps {
  query: string;
  suggestions?: string[];
  searchTips?: string[];
  onSuggestionClick?: (suggestion: string) => void;
  className?: string;
}

export function NoResults({ 
  query, 
  suggestions = [], 
  searchTips = [],
  onSuggestionClick,
  className = ''
}: NoResultsProps) {
  
  const defaultTips = [
    "Vérifiez l'orthographe de votre recherche",
    "Essayez des termes plus généraux",
    "Utilisez des synonymes ou termes alternatifs",
    "Retirez certains filtres pour élargir votre recherche"
  ];

  const tipsToShow = searchTips.length > 0 ? searchTips : defaultTips;

  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="max-w-2xl mx-auto">
        
        {/* Icône et titre principal */}
        <div className="text-8xl mb-6 opacity-50">🔍</div>
        
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Aucun résultat pour "{query}"
        </h2>
        
        <p className="text-gray-600 mb-8">
          Nous n'avons trouvé aucun produit correspondant à votre recherche.
        </p>

        {/* Suggestions automatiques */}
        {suggestions && suggestions.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Essayez plutôt :
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`suggestion-${index}`}
                  onClick={() => onSuggestionClick?.(suggestion)}
                  className="px-4 py-2 bg-info/90 hover:bg-info text-info-foreground rounded-full transition-colors duration-200 text-sm font-medium"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conseils de recherche */}
        <div className="bg-gray-50 rounded-lg p-6 text-left">
          <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">
            💡 Conseils pour améliorer votre recherche :
          </h3>
          
          <ul className="space-y-2">
            {tipsToShow.map((tip, index) => (
              <li key={index} className="flex items-start">
                <span className="text-blue-600 mr-2 mt-0.5">•</span>
                <span className="text-gray-700 text-sm">{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Suggestions de catégories populaires */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Ou parcourez nos catégories populaires :
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[
              { name: "Filtres", icon: "🔧" },
              { name: "Freinage", icon: "🛞" },
              { name: "Moteur", icon: "⚙️" },
              { name: "Carrosserie", icon: "🚗" },
              { name: "Électrique", icon: "⚡" },
              { name: "Éclairage", icon: "💡" },
              { name: "Pneumatiques", icon: "🛞" },
              { name: "Accessoires", icon: "🔧" },
            ].map((category) => (
              <button
                key={category.name}
                onClick={() => onSuggestionClick?.(category.name)}
                className="p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all duration-200 text-center"
              >
                <div className="text-2xl mb-1">{category.icon}</div>
                <div className="text-sm font-medium text-gray-700">
                  {category.name}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Contact support */}
        <div className="mt-8 p-4 bg-primary/5 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Besoin d'aide ?</strong> Notre équipe peut vous aider à trouver la pièce qu'il vous faut.
          </p>
          <div className="mt-2">
            <a 
              href="/contact" 
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              📞 Contactez-nous
            </a>
            <span className="mx-2 text-gray-400">•</span>
            <a 
              href="/catalogue" 
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              📋 Parcourir le catalogue
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
