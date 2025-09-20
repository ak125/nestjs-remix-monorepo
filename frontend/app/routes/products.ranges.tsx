/**
 * 📂 PRODUCTS RANGES - UNIFIED MANAGEMENT
 * 
 * Gestion unifiée des gammes de produits
 * Remplace commercial.products.gammes.tsx
 * 
 * Features:
 * - Role-based access (Commercial/Pro)
 * - Progressive Enhancement ready
 * - Advanced analytics (enhanced mode)
 * - Component library integration
 * 
 * Routes:
 * - /products/ranges (base interface)
 * - /products/ranges?enhanced=true (advanced interface)
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { ArrowLeft, Filter, Package, TrendingUp, BarChart3, Star } from 'lucide-react';
import { getOptionalUser } from '../auth/unified.server';
import { ProductsQuickActions } from '../components/products/ProductsQuickActions';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

interface ProductRange {
  id: string;
  name: string;
  alias?: string;
  is_active: boolean;
  is_top: boolean;
  description?: string;
  image?: string | null;
  // Enhanced fields  
  product_count: number;        // Corrected name
  sales_performance?: number;   // Enhanced data (Pro)
  profit_margin?: number;       // Pro exclusive
  last_updated?: string;        // Enhanced data
  category?: string;            // Enhanced data
  // Pro exclusive fields
  average_margin?: number;
  monthly_sales?: number;
  stock_status?: 'high' | 'medium' | 'low';
}

interface ProductsRangesData {
  user: {
    id: string;
    name: string;
    level: number;
    role: 'pro' | 'commercial';
  };
  ranges: ProductRange[];
  stats: {
    total: number;
    active: number;
    top: number;
    totalProducts: number;
  };
  enhanced: boolean;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  try {
    // Authentification optionnelle (permet l'accès aux invités)
    const user = await getOptionalUser({ context });
    
    const url = new URL(request.url);
    const enhanced = url.searchParams.get("enhanced") === "true";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = 50; // Plus de résultats pour voir les vraies données
    
    const userName = user?.name || user?.email?.split('@')[0] || 'Invité';
    const userLevel = user?.level || 1;
    const userRole = userLevel >= 4 ? 'pro' : 'commercial';
    
    const baseUrl = process.env.API_URL || "http://localhost:3000";

    // Récupérer les VRAIES gammes de produits depuis la base de données
    const rangesResponse = await fetch(`${baseUrl}/api/products/gammes`, {
      headers: { 'internal-call': 'true' }
    });

    let ranges: ProductRange[] = [];
    
    if (rangesResponse.ok) {
      const realRanges = await rangesResponse.json();
      console.log(`🎯 ${realRanges.length} vraies gammes récupérées depuis la base`);
      
      // Mapper les vraies données vers l'interface
      ranges = realRanges.slice((page - 1) * limit, page * limit).map((gamme: any) => ({
        id: gamme.id,
        name: gamme.name,
        description: gamme.alias || `Gamme automobile: ${gamme.name}`,
        image: gamme.image ? `/images/gammes/${gamme.image}` : null,
        product_count: Math.floor(Math.random() * 1000) + 100, // À récupérer de la vraie base
        is_active: gamme.is_active,
        is_top: gamme.is_top,
        ...(userRole === 'pro' && enhanced && {
          average_margin: Math.floor(Math.random() * 30) + 15,
          monthly_sales: Math.floor(Math.random() * 500) + 50,
          stock_status: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)]
        })
      }));
    } else {
      console.error("❌ Erreur récupération gammes réelles:", rangesResponse.status);
      // Fallback avec données de démonstration
      ranges = Array.from({ length: 15 }, (_, i) => ({
        id: `fallback_${i + 1}`,
        name: [
          "Freinage", "Moteur", "Carrosserie", "Électronique", "Transmission",
          "Suspension", "Direction", "Éclairage", "Climatisation", "Échappement",
          "Filtration", "Refroidissement", "Pneumatiques", "Accessoires", "Intérieur"
        ][i] || `Gamme ${i + 1}`,
        description: `Description détaillée de la gamme ${i + 1}`,
        image: null,
        product_count: Math.floor(Math.random() * 500) + 50,
        is_active: true,
        is_top: Math.random() > 0.7,
        ...(userRole === 'pro' && enhanced && {
          average_margin: Math.floor(Math.random() * 30) + 15,
          monthly_sales: Math.floor(Math.random() * 100) + 10,
          stock_status: (['high', 'medium', 'low'] as const)[Math.floor(Math.random() * 3)]
        })
      }));
    }

    const totalRanges = ranges.length;
    const pagination = {
      total: totalRanges,
      page,
      limit,
      totalPages: Math.ceil(totalRanges / limit)
    };

    return json<ProductsRangesData>({
      user: user ? {
        id: user.id,
        name: userName,
        level: userLevel,
        role: userRole
      } : {
        id: 'guest',
        name: userName,
        level: userLevel,
        role: userRole
      },
      ranges,
      stats: {
        total: totalRanges,
        active: ranges.filter(r => r.is_active).length,
        top: ranges.filter(r => r.is_top).length,
        totalProducts: ranges.reduce((sum, r) => sum + r.product_count, 0)
      },
      enhanced,
      pagination
    });

  } catch (error) {
    console.error("❌ Erreur loader products.ranges:", error);
    
    return json<ProductsRangesData>({
      user: {
        id: 'error',
        name: 'Erreur',
        level: 1,
        role: 'commercial'
      },
      ranges: [],
      stats: { total: 0, active: 0, top: 0, totalProducts: 0 },
      enhanced: false,
      error: "Impossible de charger les gammes de produits"
    });
  }
}

export default function ProductsRanges() {
  const data = useLoaderData<typeof loader>();
  const { user, ranges, stats, enhanced, error } = data;

  // Handle refresh
  const handleRefresh = () => {
    window.location.reload();
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button asChild variant="outline" size="sm">
            <Link to="/products/admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Link>
          </Button>
        </div>
        
        <div className="text-center">
          <Package className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Erreur de chargement</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/products/admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Link>
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="h-8 w-8 text-purple-600" />
              Gammes Produits {user.role === 'pro' ? 'Pro' : 'Commercial'}
            </h1>
            <p className="text-gray-600 mt-2">
              Gestion des gammes et catégories de produits
            </p>
            {enhanced && (
              <Badge variant="secondary" className="mt-2">
                Mode Avancé - Analytics Détaillées
              </Badge>
            )}
          </div>
        </div>

        {!enhanced && (
          <Link to="/products/ranges?enhanced=true">
            <Button variant="outline" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Mode Avancé
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Gammes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Package className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Actives</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Top Gammes</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.top}</p>
              </div>
              <Star className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactives</p>
                <p className="text-2xl font-bold text-gray-500">{stats.total - stats.active}</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-gray-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <ProductsQuickActions
        enhanced={enhanced}
        userRole={user.role}
        onRefresh={handleRefresh}
      />

      {/* Ranges Grid */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Liste des Gammes</h2>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtrer par statut
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ranges.map((range) => (
            <Card key={range.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">
                      {range.name}
                    </CardTitle>
                    {range.alias && (
                      <p className="text-sm text-gray-600 truncate">
                        {range.alias}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 ml-2">
                    {range.is_top && (
                      <Badge variant="secondary" className="text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        Top
                      </Badge>
                    )}
                    <Badge 
                      variant={range.is_active ? "secondary" : "destructive"}
                      className="text-xs"
                    >
                      {range.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                {range.description && (
                  <p className="text-sm text-gray-700 mb-4 line-clamp-2">
                    {range.description}
                  </p>
                )}

                {enhanced && (
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    {range.product_count && (
                      <div className="flex justify-between">
                        <span>Produits:</span>
                        <span className="font-medium">{range.product_count}</span>
                      </div>
                    )}
                    {range.category && (
                      <div className="flex justify-between">
                        <span>Catégorie:</span>
                        <span className="font-medium">{range.category}</span>
                      </div>
                    )}
                    {user.role === 'pro' && range.profit_margin && (
                      <div className="flex justify-between">
                        <span>Marge:</span>
                        <span className="font-medium text-green-600">
                          {range.profit_margin}%
                        </span>
                      </div>
                    )}
                    {range.last_updated && (
                      <div className="flex justify-between">
                        <span>Mis à jour:</span>
                        <span className="font-medium">
                          {new Date(range.last_updated).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button asChild size="sm" className="flex-1">
                    <Link to={`/products/gammes/${range.id}`}>
                      Voir Produits
                    </Link>
                  </Button>
                  {user.role === 'pro' && (
                    <Button variant="outline" size="sm">
                      Éditer
                    </Button>
                  )}
                </div>

                {enhanced && user.role === 'pro' && range.sales_performance && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex justify-between items-center text-xs text-gray-600 mb-1">
                      <span>Performance:</span>
                      <span>{range.sales_performance}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${range.sales_performance}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {ranges.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune gamme trouvée
            </h3>
            <p className="text-gray-600">
              Aucune gamme n'est actuellement disponible dans le système.
            </p>
          </div>
        )}
      </div>

      {/* Enhanced Analytics */}
      {enhanced && (
        <div className="border-t pt-8">
          <h3 className="text-lg font-semibold mb-6">Analytics Gammes</h3>
          
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Répartition par Statut
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Actives</span>
                    <span className="font-medium">{stats.active} ({Math.round((stats.active / stats.total) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${(stats.active / stats.total) * 100}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Top Gammes</span>
                    <span className="font-medium">{stats.top} ({Math.round((stats.top / stats.total) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${(stats.top / stats.total) * 100}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Inactives</span>
                    <span className="font-medium">{stats.total - stats.active} ({Math.round(((stats.total - stats.active) / stats.total) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gray-400 h-2 rounded-full"
                      style={{ width: `${((stats.total - stats.active) / stats.total) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Overview */}
            {user.role === 'pro' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Performance Globale
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {Math.round(ranges.reduce((acc, r) => acc + (r.sales_performance || 0), 0) / ranges.length)}%
                      </div>
                      <div className="text-sm text-gray-600">
                        Performance moyenne des gammes
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {Math.round(ranges.reduce((acc, r) => acc + (r.profit_margin || 0), 0) / ranges.length)}%
                      </div>
                      <div className="text-sm text-gray-600">
                        Marge moyenne
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
