/**
 * 🔍 CATALOGUE PRODUITS COMMERCIAL
 * 
 * Catalogue des produits pour l'équipe commerciale
 * Route: /commercial/products/catalog
 */

import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { ArrowLeft, Search, Filter, Package, Grid, List } from "lucide-react";
import { useState } from "react";
import { requireUser } from "../auth/unified.server";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

interface Product {
  piece_id: string;
  piece_name: string;
  piece_alias?: string;
  piece_sku: string;
  piece_activ: boolean;
  piece_top: boolean;
  piece_description?: string;
}

interface LoaderData {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  searchTerm: string;
  error?: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Vérifier l'authentification
  const user = await requireUser({ context });
  
  // Vérifier le niveau d'accès commercial (niveau 3+)
  if (!user.level || user.level < 3) {
    throw redirect('/unauthorized');
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "24"), 100);
  const page = parseInt(url.searchParams.get("page") || "1");
  
  const baseUrl = process.env.API_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}/api/products/pieces-catalog?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`, {
      headers: { 'internal-call': 'true' }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    
    return json({
      products: data.products || [],
      total: data.total || 0,
      page: data.page || 1,
      limit: data.limit || 24,
      totalPages: data.totalPages || 0,
      searchTerm: search,
    } as LoaderData);

  } catch (error) {
    console.error("Erreur chargement catalogue commercial:", error);
    return json({
      products: [],
      total: 0,
      page: 1,
      limit: 24,
      totalPages: 0,
      searchTerm: "",
      error: "Impossible de charger le catalogue"
    } as LoaderData);
  }
}

export default function CommercialProductsCatalog() {
  const { products, total, searchTerm, error } = useLoaderData<typeof loader>();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'id' | 'popular'>('name');
  const [sortOrder] = useState<'asc' | 'desc'>('asc');

  // Tri côté client
  const sortedProducts = [...products].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.piece_name.localeCompare(b.piece_name);
        break;
      case 'id':
        comparison = parseInt(a.piece_id) - parseInt(b.piece_id);
        break;
      case 'popular':
        comparison = (b.piece_top ? 1 : 0) - (a.piece_top ? 1 : 0);
        break;
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                <Link to="/commercial" className="hover:text-gray-900">Commercial</Link>
                <span>/</span>
                <Link to="/commercial/products" className="hover:text-gray-900">Produits</Link>
                <span>/</span>
                <span className="text-gray-900">Catalogue</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Catalogue produits</h1>
              <p className="text-gray-600 mt-1">
                {total.toLocaleString()} pièces automobiles disponibles
                {searchTerm && ` • Recherche: "${searchTerm}"`}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button asChild variant="outline">
                <Link to="/commercial/products">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Barre de recherche et filtres */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Recherche */}
              <div className="flex-1 relative">
                <form method="GET" className="relative">
                  <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="search"
                    placeholder="Rechercher des produits..."
                    defaultValue={searchTerm}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </form>
              </div>

              {/* Tri */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Nom A-Z</option>
                <option value="id">Plus récents</option>
                <option value="popular">Popularité</option>
              </select>

              {/* Mode d'affichage */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistiques rapides */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Affichés</p>
                  <p className="text-xl font-bold text-gray-900">{products.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Filter className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Actifs</p>
                  <p className="text-xl font-bold text-gray-900">
                    {products.filter(p => p.piece_activ).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-purple-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Populaires</p>
                  <p className="text-xl font-bold text-gray-900">
                    {products.filter(p => p.piece_top).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Search className="h-8 w-8 text-orange-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-xl font-bold text-gray-900">{total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contenu principal */}
        <Card>
          {error ? (
            <CardContent className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
              </div>
            </CardContent>
          ) : products.length > 0 ? (
            <CardContent className="p-6">
              {viewMode === 'grid' ? (
                /* Vue grille */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {sortedProducts.map((product) => (
                    <div
                      key={product.piece_id}
                      className={`border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                        product.piece_top ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {/* Image ou placeholder */}
                      <div className="w-full h-32 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                        <Package className="h-12 w-12 text-gray-300" />
                      </div>
                      
                      {/* Informations */}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <h3 className="font-medium text-gray-900 text-sm line-clamp-2 flex-1 mr-2">
                            {product.piece_name.length > 60 ? product.piece_name.substring(0, 60) + "..." : product.piece_name}
                          </h3>
                          {product.piece_top && (
                            <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                              TOP
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          ID: {product.piece_id}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Badge variant={product.piece_activ ? "default" : "destructive"} className="text-xs">
                            {product.piece_activ ? 'Actif' : 'Inactif'}
                          </Badge>
                          
                          <Button asChild variant="outline" size="sm" className="text-xs">
                            <Link to={`/commercial/products/${product.piece_id}`}>
                              Détails
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Vue liste */
                <div className="divide-y divide-gray-200">
                  {sortedProducts.map((product) => (
                    <div
                      key={product.piece_id}
                      className={`py-4 hover:bg-gray-50 transition-colors ${
                        product.piece_top ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        {/* Image miniature */}
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="h-6 w-6 text-gray-300" />
                        </div>
                        
                        {/* Informations principales */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {product.piece_name}
                            </h3>
                            {product.piece_top && (
                              <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                                TOP
                              </Badge>
                            )}
                          </div>
                          
                          <div className="mt-1 text-sm text-gray-500">
                            ID: {product.piece_id}
                          </div>
                        </div>
                        
                        {/* Status et actions */}
                        <div className="flex items-center space-x-4">
                          <Badge variant={product.piece_activ ? "default" : "destructive"} className="text-xs">
                            {product.piece_activ ? 'Actif' : 'Inactif'}
                          </Badge>
                          
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/commercial/products/${product.piece_id}`}>
                              Voir détails
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          ) : (
            <CardContent className="p-12 text-center">
              <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? "Aucun produit trouvé" : "Catalogue vide"}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm 
                  ? `Aucun produit ne correspond à "${searchTerm}"`
                  : "Il n'y a actuellement aucun produit dans le catalogue."}
              </p>
              {searchTerm && (
                <Button asChild>
                  <Link to="/commercial/products/catalog">
                    Effacer la recherche
                  </Link>
                </Button>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
