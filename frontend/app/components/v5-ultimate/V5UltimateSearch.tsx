/**/**

 * 🎯 COMPOSANT V5 ULTIMATE SEARCH - Recherche avancée de pièces * 🎯 COMPOSANT V5 ULTIMATE SEARCH - Recherche avancée de pièces

 *  * 

 * Composant frontend qui utilise les services V5 Ultimate pour : * Composant frontend qui utilise les services V5 Ultimate pour :

 * - Recherche par référence avec distinction supplier/brand * - Recherche par référence avec distinction supplier/brand

 * - Affichage des prix avancés * - Affichage des prix avancés

 * - Monitoring des performances * - Monitoring des performances

 */ */



import { useState, useEffect } from 'react';import { useState, useEffect } from 'react';

import { import { 

  searchPieceByReference,   searchPieceByReference, 

  getAdvancedPricing,   getAdvancedPricing, 

  getV5UltimateHealth,  getV5UltimateHealth,

  type V5UltimateSearchResult,  type V5UltimateSearchResult,

  type V5UltimatePricing,  type V5UltimatePricing,

  type V5UltimateHealth  type V5UltimateHealth

} from '~/services/api/v5-ultimate.api';} from '~/services/api/v5-ultimate.api';



interface V5UltimateSearchProps {interface V5UltimateSearchProps {

  className?: string;  className?: string;

  onPieceFound?: (piece: any) => void;  onPieceFound?: (piece: any) => void;

}}



export default function V5UltimateSearch({ className = '', onPieceFound }: V5UltimateSearchProps) {export default function V5UltimateSearch({ className = '', onPieceFound }: V5UltimateSearchProps) {

  const [reference, setReference] = useState('');  const [reference, setReference] = useState('');

  const [searchResults, setSearchResults] = useState<V5UltimateSearchResult | null>(null);  const [searchResults, setSearchResults] = useState<V5UltimateSearchResult | null>(null);

  const [selectedPiece, setSelectedPiece] = useState<any>(null);  const [selectedPiece, setSelectedPiece] = useState<any>(null);

  const [pricing, setPricing] = useState<V5UltimatePricing | null>(null);  const [pricing, setPricing] = useState<V5UltimatePricing | null>(null);

  const [health, setHealth] = useState<V5UltimateHealth | null>(null);  const [health, setHealth] = useState<V5UltimateHealth | null>(null);

  const [isLoading, setIsLoading] = useState(false);  const [isLoading, setIsLoading] = useState(false);

  const [isPricingLoading, setIsPricingLoading] = useState(false);  const [isPricingLoading, setIsPricingLoading] = useState(false);



  // Chargement initial du health check  // Chargement initial du health check

  useEffect(() => {  useEffect(() => {

    loadHealthStatus();    loadHealthStatus();

  }, []);  }, []);



  const loadHealthStatus = async () => {  const loadHealthStatus = async () => {nc () => {\n    try {\n      const healthData = await getV5UltimateHealth();\n      setHealth(healthData);\n    } catch (error) {\n      console.error('Erreur health check:', error);\n    }\n  };\n\n  const handleSearch = async (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!reference.trim()) return;\n\n    setIsLoading(true);\n    setSearchResults(null);\n    setSelectedPiece(null);\n    setPricing(null);\n\n    try {\n      const results = await searchPieceByReference(reference.trim());\n      setSearchResults(results);\n      \n      // Si on trouve une pièce, la sélectionner automatiquement\n      if (results.success && results.results.length > 0) {\n        const firstPiece = results.results[0];\n        setSelectedPiece(firstPiece);\n        onPieceFound?.(firstPiece);\n        \n        // Charger le pricing avancé\n        await loadAdvancedPricing(firstPiece.piece_id);\n      }\n    } catch (error) {\n      console.error('Erreur recherche:', error);\n    } finally {\n      setIsLoading(false);\n    }\n  };\n\n  const loadAdvancedPricing = async (pieceId: string) => {\n    setIsPricingLoading(true);\n    try {\n      const pricingData = await getAdvancedPricing(pieceId);\n      setPricing(pricingData);\n    } catch (error) {\n      console.error('Erreur pricing:', error);\n    } finally {\n      setIsPricingLoading(false);\n    }\n  };\n\n  const handlePieceSelect = (piece: any) => {\n    setSelectedPiece(piece);\n    onPieceFound?.(piece);\n    loadAdvancedPricing(piece.piece_id);\n  };\n\n  return (\n    <div className={`v5-ultimate-search ${className}`}>\n      {/* En-tête avec statut des services */}\n      <div className=\"mb-4 p-3 bg-slate-50 rounded-lg\">\n        <div className=\"flex items-center justify-between\">\n          <h3 className=\"text-lg font-semibold text-slate-800\">\n            🎯 Recherche V5 Ultimate\n          </h3>\n          <div className=\"flex items-center gap-2\">\n            <span className={`px-2 py-1 rounded-full text-xs font-medium ${\n              health?.status === 'healthy' \n                ? 'bg-green-100 text-green-800' \n                : 'bg-red-100 text-red-800'\n            }`}>\n              {health?.status || 'loading'}\n            </span>\n            <span className=\"text-xs text-slate-500\">\n              {health?.summary?.total_services || 0} services\n            </span>\n          </div>\n        </div>\n      </div>\n\n      {/* Formulaire de recherche */}\n      <form onSubmit={handleSearch} className=\"mb-6\">\n        <div className=\"flex gap-2\">\n          <input\n            type=\"text\"\n            value={reference}\n            onChange={(e) => setReference(e.target.value)}\n            placeholder=\"Référence pièce (ex: KTBWP8841, 0001106017)\"\n            className=\"flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500\"\n            disabled={isLoading}\n          />\n          <button\n            type=\"submit\"\n            disabled={isLoading || !reference.trim()}\n            className=\"px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2\"\n          >\n            {isLoading ? (\n              <>\n                <div className=\"w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin\" />\n                Recherche...\n              </>\n            ) : (\n              <>\n                🔍 Rechercher\n              </>\n            )}\n          </button>\n        </div>\n      </form>\n\n      {/* Résultats de recherche */}\n      {searchResults && (\n        <div className=\"mb-6\">\n          <div className=\"flex items-center justify-between mb-3\">\n            <h4 className=\"font-semibold text-slate-800\">\n              Résultats ({searchResults.found_count})\n            </h4>\n            <span className=\"text-xs text-slate-500\">\n              {searchResults._metadata.response_time.toFixed(1)}ms\n            </span>\n          </div>\n\n          {searchResults.found_count === 0 ? (\n            <div className=\"p-4 bg-yellow-50 border border-yellow-200 rounded-lg\">\n              <p className=\"text-yellow-800\">Aucune pièce trouvée pour la référence \"{searchResults.search_query}\"</p>\n            </div>\n          ) : (\n            <div className=\"space-y-3\">\n              {searchResults.results.map((piece, index) => (\n                <div\n                  key={`${piece.piece_id}-${index}`}\n                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${\n                    selectedPiece?.piece_id === piece.piece_id\n                      ? 'border-blue-500 bg-blue-50'\n                      : 'border-slate-200 hover:border-slate-300'\n                  }`}\n                  onClick={() => handlePieceSelect(piece)}\n                >\n                  <div className=\"flex items-start justify-between\">\n                    <div className=\"flex-1\">\n                      <div className=\"flex items-center gap-3 mb-2\">\n                        <h5 className=\"font-semibold text-slate-900\">\n                          {piece.reference}\n                        </h5>\n                        <span className={`px-2 py-1 rounded-full text-xs ${\n                          piece.stock_status === 'En stock'\n                            ? 'bg-green-100 text-green-800'\n                            : 'bg-red-100 text-red-800'\n                        }`}>\n                          {piece.stock_status}\n                        </span>\n                      </div>\n                      \n                      <p className=\"text-slate-700 mb-2\">{piece.designation}</p>\n                      \n                      <div className=\"flex items-center gap-4 text-sm text-slate-600\">\n                        <span><strong>Fournisseur:</strong> {piece.supplier}</span>\n                        <span><strong>Marque:</strong> {piece.brand}</span>\n                        <span><strong>Pièce ID:</strong> {piece.piece_id}</span>\n                      </div>\n                    </div>\n                    \n                    <div className=\"text-right\">\n                      <div className=\"text-lg font-semibold text-slate-900\">\n                        {parseFloat(piece.raw_price_ttc).toFixed(2)}€\n                      </div>\n                      <div className=\"text-sm text-slate-500\">\n                        HT: {parseFloat(piece.raw_price_ht).toFixed(2)}€\n                      </div>\n                    </div>\n                  </div>\n                </div>\n              ))}\n            </div>\n          )}\n        </div>\n      )}\n\n      {/* Pricing avancé */}\n      {selectedPiece && (\n        <div className=\"mb-6\">\n          <h4 className=\"font-semibold text-slate-800 mb-3\">\n            💰 Pricing V5 Ultimate - {selectedPiece.reference}\n          </h4>\n          \n          {isPricingLoading ? (\n            <div className=\"p-4 bg-slate-50 rounded-lg flex items-center gap-2\">\n              <div className=\"w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin\" />\n              Chargement du pricing avancé...\n            </div>\n          ) : pricing && pricing.success ? (\n            <div className=\"p-4 bg-green-50 border border-green-200 rounded-lg\">\n              <div className=\"grid grid-cols-2 gap-4 mb-3\">\n                <div>\n                  <span className=\"text-sm text-green-700\">Prix HT</span>\n                  <div className=\"font-semibold text-green-900\">\n                    {pricing.pricing?.base_prices[0]?.price_ht.toFixed(2)}€\n                  </div>\n                </div>\n                <div>\n                  <span className=\"text-sm text-green-700\">Prix TTC</span>\n                  <div className=\"font-semibold text-green-900\">\n                    {pricing.pricing?.base_prices[0]?.price_ttc.toFixed(2)}€\n                  </div>\n                </div>\n              </div>\n              \n              <div className=\"flex items-center justify-between text-xs text-green-600\">\n                <span>Service V5 Ultimate actif</span>\n                <span>\n                  {pricing._metadata.cache_hit ? '⚡ Cache hit' : '🔍 Fresh data'}\n                  - {pricing._metadata.response_time.toFixed(1)}ms\n                </span>\n              </div>\n            </div>\n          ) : (\n            <div className=\"p-4 bg-yellow-50 border border-yellow-200 rounded-lg\">\n              <p className=\"text-yellow-800\">Pricing avancé non disponible</p>\n            </div>\n          )}\n        </div>\n      )}\n\n      {/* Debug info */}\n      {searchResults && (\n        <div className=\"text-xs text-slate-500 p-3 bg-slate-50 rounded\">\n          <strong>Méthodologie:</strong> {searchResults._metadata.methodology}\n        </div>\n      )}\n    </div>\n  );\n}
    try {
      const healthData = await getV5UltimateHealth();
      setHealth(healthData);
    } catch (error) {
      console.error('Erreur health check:', error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) return;

    setIsLoading(true);
    setSearchResults(null);
    setSelectedPiece(null);
    setPricing(null);

    try {
      const results = await searchPieceByReference(reference.trim());
      setSearchResults(results);
      
      // Si on trouve une pièce, la sélectionner automatiquement
      if (results.success && results.results.length > 0) {
        const firstPiece = results.results[0];
        setSelectedPiece(firstPiece);
        onPieceFound?.(firstPiece);
        
        // Charger le pricing avancé
        await loadAdvancedPricing(firstPiece.piece_id);
      }
    } catch (error) {
      console.error('Erreur recherche:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAdvancedPricing = async (pieceId: string) => {
    setIsPricingLoading(true);
    try {
      const pricingData = await getAdvancedPricing(pieceId);
      setPricing(pricingData);
    } catch (error) {
      console.error('Erreur pricing:', error);
    } finally {
      setIsPricingLoading(false);
    }
  };

  const handlePieceSelect = (piece: any) => {
    setSelectedPiece(piece);
    onPieceFound?.(piece);
    loadAdvancedPricing(piece.piece_id);
  };

  return (
    <div className={`v5-ultimate-search ${className}`}>
      {/* En-tête avec statut des services */}
      <div className="mb-4 p-3 bg-slate-50 rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">
            🎯 Recherche V5 Ultimate
          </h3>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              health?.status === 'healthy' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {health?.status || 'loading'}
            </span>
            <span className="text-xs text-slate-500">
              {health?.summary?.total_services || 0} services
            </span>
          </div>
        </div>
      </div>

      {/* Formulaire de recherche */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Référence pièce (ex: KTBWP8841, 0001106017)"
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !reference.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Recherche...
              </>
            ) : (
              <>
                🔍 Rechercher
              </>
            )}
          </button>
        </div>
      </form>

      {/* Résultats de recherche */}
      {searchResults && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-slate-800">
              Résultats ({searchResults.found_count})
            </h4>
            <span className="text-xs text-slate-500">
              {searchResults._metadata.response_time.toFixed(1)}ms
            </span>
          </div>

          {searchResults.found_count === 0 ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">
                Aucune pièce trouvée pour la référence "{searchResults.search_query}"
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {searchResults.results.map((piece, index) => (
                <div
                  key={`${piece.piece_id}-${index}`}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedPiece?.piece_id === piece.piece_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => handlePieceSelect(piece)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h5 className="font-semibold text-slate-900">
                          {piece.reference}
                        </h5>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          piece.stock_status === 'En stock'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {piece.stock_status}
                        </span>
                      </div>
                      
                      <p className="text-slate-700 mb-2">{piece.designation}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span><strong>Fournisseur:</strong> {piece.supplier}</span>
                        <span><strong>Marque:</strong> {piece.brand}</span>
                        <span><strong>Pièce ID:</strong> {piece.piece_id}</span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-lg font-semibold text-slate-900">
                        {parseFloat(piece.raw_price_ttc).toFixed(2)}€
                      </div>
                      <div className="text-sm text-slate-500">
                        HT: {parseFloat(piece.raw_price_ht).toFixed(2)}€
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pricing avancé */}
      {selectedPiece && (
        <div className="mb-6">
          <h4 className="font-semibold text-slate-800 mb-3">
            💰 Pricing V5 Ultimate - {selectedPiece.reference}
          </h4>
          
          {isPricingLoading ? (
            <div className="p-4 bg-slate-50 rounded-lg flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              Chargement du pricing avancé...
            </div>
          ) : pricing && pricing.success ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <span className="text-sm text-green-700">Prix HT</span>
                  <div className="font-semibold text-green-900">
                    {pricing.pricing?.base_prices[0]?.price_ht.toFixed(2)}€
                  </div>
                </div>
                <div>
                  <span className="text-sm text-green-700">Prix TTC</span>
                  <div className="font-semibold text-green-900">
                    {pricing.pricing?.base_prices[0]?.price_ttc.toFixed(2)}€
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-green-600">
                <span>Service V5 Ultimate actif</span>
                <span>
                  {pricing._metadata.cache_hit ? '⚡ Cache hit' : '🔍 Fresh data'}
                  - {pricing._metadata.response_time.toFixed(1)}ms
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">Pricing avancé non disponible</p>
            </div>
          )}
        </div>
      )}

      {/* Debug info */}
      {searchResults && (
        <div className="text-xs text-slate-500 p-3 bg-slate-50 rounded">
          <strong>Méthodologie:</strong> {searchResults._metadata.methodology}
        </div>
      )}
    </div>
  );
}