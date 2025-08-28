/**
 * 📋 SEARCH RESULTS - Composant d'affichage des résultats v3.0
 */

interface SearchResultItem {
  id: string;
  title: string;
  description: string;
  category?: string;
  price?: number;
  originalPrice?: number;
  image?: string;
  relevanceScore?: number;
  inStock?: boolean;
  isNew?: boolean;
  onSale?: boolean;
  brand?: string;
  reference?: string;
  compatibility?: string[];
  highlights?: Record<string, string[]>;
}

interface SearchResultsProps {
  items: SearchResultItem[];
  viewMode: 'grid' | 'list';
  highlights?: boolean;
  showRelevanceScore?: boolean;
  enableQuickView?: boolean;
  onItemClick?: (item: SearchResultItem) => void;
  className?: string;
}

export function SearchResults({ 
  items = [], 
  viewMode = 'grid',
  highlights = true,
  showRelevanceScore = false,
  enableQuickView: _enableQuickView = false,
  onItemClick,
  className = ''
}: SearchResultsProps) {
  
  if (!items.length) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 text-4xl mb-2">📦</div>
        <p className="text-gray-600">Aucun résultat à afficher</p>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  const highlightText = (text: string, highlights?: string[]) => {
    if (!highlights || !highlights.length) return text;
    
    let highlightedText = text;
    highlights.forEach(highlight => {
      const regex = new RegExp(`(${highlight})`, 'gi');
      highlightedText = highlightedText.replace(
        regex, 
        '<mark class="bg-yellow-200 px-1 rounded">$1</mark>'
      );
    });
    
    return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
  };

  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item, index) => (
        <article 
          key={item.id} 
          className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 cursor-pointer"
          onClick={() => onItemClick?.(item)}
        >
          {/* Image */}
          <div className="aspect-square bg-gray-100 rounded-t-lg overflow-hidden">
            {item.image ? (
              <img 
                src={item.image} 
                alt={item.title}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                🔧
              </div>
            )}
          </div>
          
          {/* Contenu */}
          <div className="p-4">
            {/* Badges */}
            <div className="flex items-center gap-1 mb-2">
              {item.isNew && (
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                  Nouveau
                </span>
              )}
              {item.onSale && (
                <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                  Promo
                </span>
              )}
              {!item.inStock && (
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                  Rupture
                </span>
              )}
            </div>
            
            {/* Titre */}
            <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
              {highlights && item.highlights?.title ? 
                highlightText(item.title, item.highlights.title) : 
                item.title
              }
            </h3>
            
            {/* Description */}
            <p className="text-sm text-gray-600 mb-3 line-clamp-3">
              {highlights && item.highlights?.description ? 
                highlightText(item.description, item.highlights.description) : 
                item.description
              }
            </p>
            
            {/* Métadonnées */}
            <div className="space-y-1 text-xs text-gray-500 mb-3">
              {item.reference && (
                <div>Réf: <span className="font-mono">{item.reference}</span></div>
              )}
              {item.brand && (
                <div>Marque: {item.brand}</div>
              )}
              {item.category && (
                <div>Catégorie: {item.category}</div>
              )}
            </div>
            
            {/* Prix */}
            <div className="flex items-center justify-between">
              <div>
                {item.price && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-900">
                      {formatPrice(item.price)}
                    </span>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <span className="text-sm text-gray-500 line-through">
                        {formatPrice(item.originalPrice)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              {showRelevanceScore && item.relevanceScore && (
                <div className="text-xs text-blue-600">
                  Score: {item.relevanceScore.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );

  const renderListView = () => (
    <div className="space-y-4">
      {items.map((item, index) => (
        <article 
          key={item.id} 
          className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 cursor-pointer"
          onClick={() => onItemClick?.(item)}
        >
          <div className="p-4">
            <div className="flex gap-4">
              {/* Image */}
              <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
                {item.image ? (
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                    🔧
                  </div>
                )}
              </div>
              
              {/* Contenu principal */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-1 mb-2">
                      {item.isNew && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                          Nouveau
                        </span>
                      )}
                      {item.onSale && (
                        <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                          Promo
                        </span>
                      )}
                    </div>
                    
                    {/* Titre */}
                    <h3 className="font-semibold text-lg text-gray-900 mb-2">
                      {highlights && item.highlights?.title ? 
                        highlightText(item.title, item.highlights.title) : 
                        item.title
                      }
                    </h3>
                    
                    {/* Description */}
                    <p className="text-gray-600 mb-3">
                      {highlights && item.highlights?.description ? 
                        highlightText(item.description, item.highlights.description) : 
                        item.description
                      }
                    </p>
                    
                    {/* Métadonnées */}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      {item.reference && (
                        <span>Réf: <code className="font-mono bg-gray-100 px-1 rounded">{item.reference}</code></span>
                      )}
                      {item.brand && <span>Marque: {item.brand}</span>}
                      {item.category && <span>Catégorie: {item.category}</span>}
                    </div>
                  </div>
                  
                  {/* Prix et actions */}
                  <div className="text-right ml-4">
                    {item.price && (
                      <div className="mb-2">
                        <div className="text-xl font-bold text-gray-900">
                          {formatPrice(item.price)}
                        </div>
                        {item.originalPrice && item.originalPrice > item.price && (
                          <div className="text-sm text-gray-500 line-through">
                            {formatPrice(item.originalPrice)}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="text-sm">
                      {item.inStock ? (
                        <span className="text-green-600">✓ En stock</span>
                      ) : (
                        <span className="text-red-600">✗ Rupture</span>
                      )}
                    </div>
                    
                    {showRelevanceScore && item.relevanceScore && (
                      <div className="text-xs text-blue-600 mt-1">
                        Score: {item.relevanceScore.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <div className={className}>
      {viewMode === 'grid' ? renderGridView() : renderListView()}
    </div>
  );
}
