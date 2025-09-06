/**
 * 🏷️ PRODUCTS RANGES - INTERFACE AVANCÉE
 * 
 * Gestion complète des gammes avec fonctionnalités avancées :
 * - Pagination intelligente
 * - Recherche dans les gammes
 * - Filtres par statut
 * - Navigation vers produits par gamme
 * - Mode Pro avec analytics
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link, useSearchParams, Form } from '@remix-run/react';
import { 
  ArrowLeft, Filter, Package, TrendingUp, BarChart3, Star, 
  Search, ChevronLeft, ChevronRight, Eye, Edit, Grid, List,
  SortAsc, SortDesc, RefreshCw
} from 'lucide-react';
import { requireUser } from '../auth/unified.server';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

interface ProductRange {
  id: string;
  name: string;
  alias?: string;
  is_active: boolean;
  is_top: boolean;
  description?: string;
  image?: string | null;
  product_count: number;
  category?: string;
  // Pro exclusive fields
  average_margin?: number;
  monthly_sales?: number;
  stock_status?: 'high' | 'medium' | 'low';
  performance_score?: number;
  last_updated?: string;
}

interface RangesAdvancedData {
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
    filtered: number;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: {
    search: string;
    status: string;
    sort: string;
    view: 'grid' | 'list';
  };
  enhanced: boolean;
  error?: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  try {
    // Authentification utilisateur
    const user = await requireUser({ context });
    
    const url = new URL(request.url);
    const enhanced = url.searchParams.get("enhanced") === "true";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "12");
    const search = url.searchParams.get("search") || "";
    const statusFilter = url.searchParams.get("status") || "all";
    const sortBy = url.searchParams.get("sort") || "name";
    const viewMode = (url.searchParams.get("view") || "grid") as 'grid' | 'list';
    
    const userName = user.name || user.email?.split('@')[0] || 'Utilisateur';
    const userLevel = user.level || 1;
    const userRole = userLevel >= 4 ? 'pro' : 'commercial';
    
    const baseUrl = process.env.API_URL || "http://localhost:3000";

    // Récupérer TOUTES les gammes pour filtrer et paginer côté serveur
    const rangesResponse = await fetch(`${baseUrl}/api/products/gammes`, {
      headers: { 
        'internal-call': 'true',
        'user-role': userRole,
        'user-level': userLevel.toString()
      }
    });

    let allRanges: ProductRange[] = [];
    let totalFound = 0;
    
    if (rangesResponse.ok) {
      const realRanges = await rangesResponse.json();
      console.log(`🎯 ${realRanges.length} gammes récupérées pour filtrage avancé`);
      
      // Mapper et enrichir les données
      const enrichedRanges = await Promise.all(realRanges.map(async (gamme: any, index: number) => {
        // Simuler comptage de produits (dans la vraie app, récupérer depuis la base)
        const productCount = Math.floor(Math.random() * 2000) + 50;
        
        return {
          id: gamme.id,
          name: gamme.name,
          alias: gamme.alias,
          description: gamme.alias || `Gamme automobile: ${gamme.name}`,
          image: gamme.image ? `/images/gammes/${gamme.image}` : null,
          product_count: productCount,
          is_active: gamme.is_active,
          is_top: gamme.is_top,
          category: gamme.name.includes('Adaptateur') ? 'Adaptateurs' : 
                   gamme.name.includes('Accumulateur') ? 'Systèmes' :
                   gamme.name.includes('frein') ? 'Freinage' : 'Divers',
          ...(userRole === 'pro' && enhanced && {
            average_margin: Math.floor(Math.random() * 35) + 10,
            monthly_sales: Math.floor(Math.random() * 1000) + 100,
            stock_status: (['high', 'medium', 'low'] as const)[Math.floor(Math.random() * 3)],
            performance_score: Math.floor(Math.random() * 100) + 1,
            last_updated: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
          })
        } as ProductRange;
      }));
      
      // Appliquer les filtres
      let filteredRanges = enrichedRanges.filter((range) => {
        // Filtre de recherche
        if (search) {
          const searchTerm = search.toLowerCase();
          const matchName = range.name.toLowerCase().includes(searchTerm);
          const matchAlias = range.alias && range.alias.toLowerCase().includes(searchTerm);
          const matchCategory = range.category && range.category.toLowerCase().includes(searchTerm);
          if (!matchName && !matchAlias && !matchCategory) return false;
        }
        
        // Filtre de statut
        if (statusFilter === 'active' && !range.is_active) return false;
        if (statusFilter === 'inactive' && range.is_active) return false;
        if (statusFilter === 'top' && !range.is_top) return false;
        
        return true;
      });
      
      // Appliquer le tri
      filteredRanges.sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'name_desc':
            return b.name.localeCompare(a.name);
          case 'products':
            return b.product_count - a.product_count;
          case 'products_asc':
            return a.product_count - b.product_count;
          case 'performance':
            return (b.performance_score || 0) - (a.performance_score || 0);
          default:
            return a.name.localeCompare(b.name);
        }
      });
      
      totalFound = filteredRanges.length;
      
      // Appliquer la pagination
      const startIndex = (page - 1) * limit;
      allRanges = filteredRanges.slice(startIndex, startIndex + limit);
    }

    const totalPages = Math.ceil(totalFound / limit);
    
    return json<RangesAdvancedData>({
      user: {
        id: user.id,
        name: userName,
        level: userLevel,
        role: userRole
      },
      ranges: allRanges,
      stats: {
        total: totalFound,
        active: allRanges.filter(r => r.is_active).length,
        top: allRanges.filter(r => r.is_top).length,
        totalProducts: allRanges.reduce((sum, r) => sum + r.product_count, 0),
        filtered: totalFound
      },
      pagination: {
        total: totalFound,
        page,
        limit,
        totalPages
      },
      filters: {
        search,
        status: statusFilter,
        sort: sortBy,
        view: viewMode
      },
      enhanced
    });

  } catch (error) {
    console.error("❌ Erreur loader products.ranges.advanced:", error);
    
    return json<RangesAdvancedData>({
      user: { id: 'error', name: 'Erreur', level: 1, role: 'commercial' },
      ranges: [],
      stats: { total: 0, active: 0, top: 0, totalProducts: 0, filtered: 0 },
      pagination: { total: 0, page: 1, limit: 12, totalPages: 0 },
      filters: { search: "", status: "all", sort: "name", view: "grid" },
      enhanced: false,
      error: "Impossible de charger les gammes"
    });
  }
}

export default function ProductsRangesAdvanced() {
  const data = useLoaderData<typeof loader>();
  const { user, ranges, stats, pagination, filters, enhanced, error } = data;
  const [searchParams, setSearchParams] = useSearchParams();

  // Gestion des filtres
  const handleSearch = (search: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (search) {
      newParams.set('search', search);
    } else {
      newParams.delete('search');
    }
    newParams.set('page', '1'); // Retour à la première page
    setSearchParams(newParams);
  };

  const handleFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1'); // Retour à la première page
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
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
          <Button onClick={() => window.location.reload()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header avec navigation */}
      <div className="flex items-center gap-4 mb-8">
        <Button asChild variant="outline" size="sm">
          <Link to="/products/admin">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Products Admin
          </Link>
        </Button>
        
        <div className="flex-1">
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
            <Link to="/products/admin" className="hover:text-gray-900">Products</Link>
            <span>/</span>
            <span className="text-gray-900">Gammes Avancées</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            🏷️ Gestion Avancée des Gammes
          </h1>
          <p className="text-gray-600">
            {stats.filtered} gammes trouvées • {stats.totalProducts.toLocaleString()} produits total
          </p>
        </div>

        {enhanced && (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            ⚡ Mode Avancé
          </Badge>
        )}
        
        {user.role === 'pro' && (
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">
            💎 PRO
          </Badge>
        )}
      </div>

      {/* Statistiques rapides */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <p className="text-sm text-gray-600">Gammes Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-sm text-gray-600">Actives</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.top}</div>
            <p className="text-sm text-gray-600">Top Gammes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{stats.totalProducts.toLocaleString()}</div>
            <p className="text-sm text-gray-600">Produits</p>
          </CardContent>
        </Card>
      </div>

      {/* Barre de recherche et filtres */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Recherche et Filtres Avancés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-6">
            {/* Recherche */}
            <div className="md:col-span-2">
              <Form method="get" className="flex gap-2">
                <Input
                  name="search"
                  placeholder="Rechercher une gamme..."
                  defaultValue={filters.search}
                  className="flex-1"
                />
                <Button type="submit" size="sm">
                  <Search className="h-4 w-4" />
                </Button>
              </Form>
            </div>
            
            {/* Filtre statut */}
            <Select 
              value={filters.status} 
              onValueChange={(value) => handleFilter('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">✅ Actives</SelectItem>
                <SelectItem value="inactive">❌ Inactives</SelectItem>
                <SelectItem value="top">⭐ Top Gammes</SelectItem>
              </SelectContent>
            </Select>

            {/* Tri */}
            <Select 
              value={filters.sort} 
              onValueChange={(value) => handleFilter('sort', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">📝 Nom A-Z</SelectItem>
                <SelectItem value="name_desc">📝 Nom Z-A</SelectItem>
                <SelectItem value="products">📦 Plus de produits</SelectItem>
                <SelectItem value="products_asc">📦 Moins de produits</SelectItem>
                {user.role === 'pro' && enhanced && (
                  <SelectItem value="performance">📈 Performance</SelectItem>
                )}
              </SelectContent>
            </Select>

            {/* Limite par page */}
            <Select 
              value={pagination.limit.toString()} 
              onValueChange={(value) => handleFilter('limit', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Par page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 par page</SelectItem>
                <SelectItem value="12">12 par page</SelectItem>
                <SelectItem value="24">24 par page</SelectItem>
                <SelectItem value="48">48 par page</SelectItem>
              </SelectContent>
            </Select>

            {/* Vue */}
            <div className="flex gap-2">
              <Button
                variant={filters.view === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilter('view', 'grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={filters.view === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilter('view', 'list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Actions rapides */}
          <div className="flex gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/products/ranges?enhanced=true">
                ⚡ Mode Avancé
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/products/catalog">
                📦 Voir Catalogue
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Liste des gammes */}
      {ranges.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune gamme trouvée</h3>
            <p className="text-gray-600 mb-4">
              Essayez de modifier vos critères de recherche ou vos filtres.
            </p>
            <Button variant="outline" onClick={() => {
              setSearchParams(new URLSearchParams({ page: '1' }));
            }}>
              Réinitialiser les filtres
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Gammes en mode grille */}
          {filters.view === 'grid' && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
              {ranges.map((range) => (
                <Card key={range.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg leading-tight mb-2">
                          {range.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mb-2">
                          {range.is_active ? (
                            <Badge className="bg-green-100 text-green-800">✅ Actif</Badge>
                          ) : (
                            <Badge variant="secondary">❌ Inactif</Badge>
                          )}
                          {range.is_top && (
                            <Badge className="bg-yellow-100 text-yellow-800">⭐ Top</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {range.description}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    {/* Statistiques de la gamme */}
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Produits</span>
                        <span className="font-medium">{range.product_count.toLocaleString()}</span>
                      </div>
                      
                      {user.role === 'pro' && enhanced && range.average_margin && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Marge moy.</span>
                          <span className="font-medium text-green-600">{range.average_margin}%</span>
                        </div>
                      )}
                      
                      {user.role === 'pro' && enhanced && range.monthly_sales && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Ventes/mois</span>
                          <span className="font-medium">{range.monthly_sales}</span>
                        </div>
                      )}
                      
                      {user.role === 'pro' && enhanced && range.stock_status && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Stock</span>
                          <Badge variant={
                            range.stock_status === 'high' ? 'default' : 
                            range.stock_status === 'medium' ? 'secondary' : 'destructive'
                          }>
                            {range.stock_status === 'high' ? '🟢 Élevé' :
                             range.stock_status === 'medium' ? '🟡 Moyen' : '🔴 Faible'}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button asChild size="sm" className="flex-1">
                        <Link to={`/products/catalog?gamme_id=${range.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          Voir Produits
                        </Link>
                      </Button>
                      {user.level >= 4 && (
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/products/ranges/${range.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Gammes en mode liste */}
          {filters.view === 'list' && (
            <Card className="mb-8">
              <CardContent className="p-0">
                <div className="divide-y">
                  {ranges.map((range) => (
                    <div key={range.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {range.name}
                            </h3>
                            <div className="flex items-center gap-2">
                              {range.is_active ? (
                                <Badge className="bg-green-100 text-green-800">✅</Badge>
                              ) : (
                                <Badge variant="secondary">❌</Badge>
                              )}
                              {range.is_top && (
                                <Badge className="bg-yellow-100 text-yellow-800">⭐</Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {range.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>📦 {range.product_count.toLocaleString()} produits</span>
                            {user.role === 'pro' && enhanced && range.average_margin && (
                              <span>💰 {range.average_margin}% marge</span>
                            )}
                            {user.role === 'pro' && enhanced && range.monthly_sales && (
                              <span>📊 {range.monthly_sales} ventes/mois</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button asChild size="sm">
                            <Link to={`/products/catalog?gamme_id=${range.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Voir Produits
                            </Link>
                          </Button>
                          {user.level >= 4 && (
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/products/ranges/${range.id}/edit`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>
                      Page {pagination.page} sur {pagination.totalPages}
                    </span>
                    <span>•</span>
                    <span>
                      {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} 
                      sur {pagination.total} gammes
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => handlePageChange(pagination.page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Précédent
                    </Button>
                    
                    {/* Pages rapides */}
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === pagination.page ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => handlePageChange(pagination.page + 1)}
                    >
                      Suivant
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
