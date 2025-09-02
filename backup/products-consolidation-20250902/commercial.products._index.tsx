/**
 * 📦 GESTION PRODUITS COMMERCIAL
 * 
 * Page de gestion des produits pour l'équipe commerciale
 * Route: /commercial/products
 */

import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { 
  Package, 
  Search, 
  Filter, 
  Tag, 
  Car,
  TrendingUp,
  AlertTriangle,
  BarChart3
} from "lucide-react";
import { requireUser } from "../auth/unified.server";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

interface ProductsData {
  stats: {
    totalProducts: number;
    totalBrands: number;
    totalCategories: number;
    lowStockItems: number;
  };
  recentProducts: Array<{
    id: string;
    name: string;
    alias?: string;
    is_active: boolean;
    is_top: boolean;
  }>;
  recentBrands: Array<{
    marque_id: number;
    marque_name: string;
  }>;
  error?: string;
}

export async function loader({ context }: LoaderFunctionArgs) {
  // Vérifier l'authentification
  const user = await requireUser({ context });
  
  // Vérifier le niveau d'accès commercial (niveau 3+)
  if (!user.level || user.level < 3) {
    throw redirect('/unauthorized');
  }

  const baseUrl = process.env.API_URL || "http://localhost:3000";

  try {
    // Récupération des données produits en parallèle
    const [statsResponse, gammesResponse, brandsResponse] = await Promise.all([
      fetch(`${baseUrl}/api/products/stats`, {
        headers: { 'internal-call': 'true' }
      }),
      fetch(`${baseUrl}/api/products/gammes`, {
        headers: { 'internal-call': 'true' }
      }),
      fetch(`${baseUrl}/api/products/brands-test`, {
        headers: { 'internal-call': 'true' }
      })
    ]);

    let stats = {
      totalProducts: 0,
      totalBrands: 0,
      totalCategories: 0,
      lowStockItems: 0
    };
    let recentProducts: any[] = [];
    let recentBrands: any[] = [];

    // Parse des vraies statistiques
    if (statsResponse.ok) {
      const realStats = await statsResponse.json();
      stats = {
        totalProducts: realStats.totalProducts || 0,
        totalBrands: realStats.totalBrands || 0,
        totalCategories: realStats.totalCategories || 0,
        lowStockItems: realStats.lowStockItems || 0
      };
    }

    // Parse des données gammes pour l'affichage
    if (gammesResponse.ok) {
      const gammes = await gammesResponse.json();
      if (Array.isArray(gammes)) {
        recentProducts = gammes.slice(0, 6); // Top 6 pour affichage
      }
    }

    // Parse des données marques pour l'affichage
    if (brandsResponse.ok) {
      const brandsData = await brandsResponse.json();
      if (brandsData.data && Array.isArray(brandsData.data)) {
        recentBrands = brandsData.data.slice(0, 8); // Top 8 pour affichage
      }
    }

    const productsData: ProductsData = {
      stats,
      recentProducts,
      recentBrands,
    };

    return json(productsData);

  } catch (error) {
    console.error("Erreur chargement produits commercial:", error);
    return json({
      stats: {
        totalProducts: 0,
        totalBrands: 0,
        totalCategories: 0,
        lowStockItems: 0,
      },
      recentProducts: [],
      recentBrands: [],
      error: "Erreur de chargement des données produits"
    } as ProductsData);
  }
}

export default function CommercialProducts() {
  const { stats, recentProducts, recentBrands, error } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestion Produits</h1>
              <p className="text-gray-600 mt-1">Catalogue et stock des pièces automobiles</p>
            </div>
            <div className="flex items-center space-x-3">
              <Button asChild variant="outline">
                <Link to="/commercial">
                  ← Retour au dashboard
                </Link>
              </Button>
              <Button asChild>
                <Link to="/commercial/products/catalog">
                  <Package className="h-4 w-4 mr-2" />
                  Parcourir le catalogue
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Alerte erreur si nécessaire */}
        {error && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center text-yellow-700">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Statistiques principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Produits totaux</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats.totalProducts.toLocaleString()}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    <TrendingUp className="inline h-4 w-4 mr-1" />
                    Catalogue complet
                  </p>
                </div>
                <Package className="h-12 w-12 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Marques</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats.totalBrands}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Références actives</p>
                </div>
                <Tag className="h-12 w-12 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Gammes</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats.totalCategories}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Catégories produits</p>
                </div>
                <Filter className="h-12 w-12 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Stock faible</p>
                  <p className="text-3xl font-bold text-red-600">
                    {stats.lowStockItems}
                  </p>
                  <p className="text-sm text-red-500 mt-1">Attention requise</p>
                </div>
                <AlertTriangle className="h-12 w-12 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contenu principal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gammes récentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Gammes principales</span>
                <Button asChild variant="outline" size="sm">
                  <Link to="/commercial/products/gammes">
                    Voir tout
                  </Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentProducts.length > 0 ? (
                <div className="space-y-4">
                  {recentProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <h3 className="font-medium text-gray-900 text-sm">
                          {product.name.length > 50 ? product.name.substring(0, 50) + "..." : product.name}
                        </h3>
                        <div className="flex items-center mt-1 space-x-2">
                          <span className="text-xs text-gray-500">ID: {product.id}</span>
                          {product.is_top && (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                              TOP
                            </Badge>
                          )}
                          <Badge 
                            variant={product.is_active ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {product.is_active ? "Actif" : "Inactif"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Filter className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Aucune gamme trouvée</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Marques récentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Marques automobiles</span>
                <Button asChild variant="outline" size="sm">
                  <Link to="/commercial/products/brands">
                    Voir tout
                  </Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentBrands.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {recentBrands.map((brand) => (
                    <div
                      key={brand.marque_id}
                      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center"
                    >
                      <div className="flex items-center justify-center mb-2">
                        <Car className="h-5 w-5 text-gray-600" />
                      </div>
                      <h3 className="font-medium text-gray-900 text-sm">
                        {brand.marque_name}
                      </h3>
                      <div className="text-xs text-gray-500 mt-1">
                        ID: {brand.marque_id}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Tag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Aucune marque trouvée</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions rapides */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button asChild variant="outline" className="h-auto p-4">
                <Link to="/commercial/products/catalog" className="flex flex-col items-center text-center">
                  <Search className="h-8 w-8 mb-2 text-blue-600" />
                  <span className="font-medium">Parcourir catalogue</span>
                  <span className="text-sm text-gray-500 mt-1">
                    {stats.totalProducts.toLocaleString()} produits
                  </span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="h-auto p-4">
                <Link to="/commercial/products/gammes" className="flex flex-col items-center text-center">
                  <Filter className="h-8 w-8 mb-2 text-green-600" />
                  <span className="font-medium">Gérer gammes</span>
                  <span className="text-sm text-gray-500 mt-1">
                    {stats.totalCategories} catégories
                  </span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="h-auto p-4">
                <Link to="/commercial/products/brands" className="flex flex-col items-center text-center">
                  <Tag className="h-8 w-8 mb-2 text-purple-600" />
                  <span className="font-medium">Marques auto</span>
                  <span className="text-sm text-gray-500 mt-1">
                    {stats.totalBrands} marques
                  </span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="h-auto p-4">
                <Link to="/commercial/stock" className="flex flex-col items-center text-center">
                  <BarChart3 className="h-8 w-8 mb-2 text-red-600" />
                  <span className="font-medium">Stock faible</span>
                  <span className="text-sm text-gray-500 mt-1">
                    {stats.lowStockItems} alertes
                  </span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
