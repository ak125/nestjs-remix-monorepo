/**
 * 🔧 ADMIN PRODUCTS GAMME MANAGEMENT - DASHBOARD AVANCÉ
 * 
 * Page d'administration pour la gestion des produits par gamme
 * - Pagination avancée 
 * - Recherche administrative
 * - Tri multi-critères
 * - Gestion des stocks/prix
 * - Actions bulk (modification, suppression)
 * 
 * Route: /admin/products/gammes/:gammeId
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link, Form, useSearchParams } from '@remix-run/react';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc,
  Package,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Settings,
  Trash2,
  Plus,
  Download,
  Upload
} from 'lucide-react';
import { requireUser } from '../auth/unified.server';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

interface AdminProduct {
  piece_id: number;
  piece_name: string;
  piece_alias: string;
  piece_sku: string;
  piece_description?: string;
  piece_activ: boolean;
  piece_top: boolean;
  has_image: boolean;
  has_oem: boolean;
  year?: number;
  // Champs admin supplémentaires
  stock_quantity?: number;
  price_ht?: number;
  price_ttc?: number;
  last_updated?: string;
}

interface AdminGamme {
  id: string;
  name: string;
  alias?: string;
  image?: string;
  is_active: boolean;
  total_products?: number;
  active_products?: number;
}

interface AdminGammeData {
  user: {
    id: string;
    name: string;
    level: number;
    role: 'pro' | 'commercial';
  };
  gamme: AdminGamme;
  products: AdminProduct[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: {
    search: string;
    sortBy: string;
    sortOrder: string;
    status?: string;
  };
  enhanced: boolean;
  error?: string;
  stats: {
    total: number;
    active: number;
    inactive: number;
    with_images: number;
    low_stock: number;
  };
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  try {
    // Authentification OBLIGATOIRE pour l'admin
    const user = await requireUser({ context });
    
    // Vérifier les permissions admin (niveau 4+)
    if (!user.level || user.level < 4) {
      throw new Error('Accès non autorisé - Niveau administrateur requis');
    }
    
    const { gammeId } = params;
    if (!gammeId) {
      throw new Error('ID de gamme manquant');
    }
    
    const url = new URL(request.url);
    const enhanced = url.searchParams.get("enhanced") === "true";
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20"); // Plus petit pour l'admin
    const sortBy = url.searchParams.get("sortBy") || "piece_name";
    const sortOrder = url.searchParams.get("sortOrder") || "asc";
    const status = url.searchParams.get("status") || "all";
    
    const userName = user.name || user.email?.split('@')[0] || 'Administrateur';
    const userLevel = user.level || 4;
    const userRole = 'pro'; // Toujours pro en admin
    
    const baseUrl = process.env.API_URL || "http://localhost:3000";

    // Récupérer les produits avec données admin étendues
    const response = await fetch(`${baseUrl}/api/products/gammes/${gammeId}/products?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}&admin=true`, {
      headers: { 
        'internal-call': 'true',
        'user-role': 'admin',
        'user-level': userLevel.toString()
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Gamme non trouvée');
      }
      if (response.status === 403) {
        throw new Error('Accès non autorisé');
      }
      throw new Error(`Erreur API: ${response.status}`);
    }

    const data = await response.json();

    // Calculer les statistiques pour l'admin
    const products = data.products || [];
    const stats = {
      total: data.pagination?.total || 0,
      active: products.filter((p: AdminProduct) => p.piece_activ).length,
      inactive: products.filter((p: AdminProduct) => !p.piece_activ).length,
      with_images: products.filter((p: AdminProduct) => p.has_image).length,
      low_stock: products.filter((p: AdminProduct) => (p.stock_quantity || 0) < 10).length,
    };

    return json<AdminGammeData>({
      user: {
        id: user.id,
        name: userName,
        level: userLevel,
        role: userRole
      },
      gamme: {
        ...data.gamme,
        total_products: stats.total,
        active_products: stats.active
      },
      products,
      pagination: data.pagination,
      filters: {
        search,
        sortBy,
        sortOrder,
        status
      },
      enhanced,
      stats
    });

  } catch (error) {
    console.error("❌ Erreur loader admin gamme:", error);
    
    return json<AdminGammeData>({
      user: {
        id: 'error',
        name: 'Erreur',
        level: 1,
        role: 'commercial'
      },
      gamme: { id: '', name: 'Erreur', is_active: false },
      products: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      filters: { search: '', sortBy: 'piece_name', sortOrder: 'asc' },
      enhanced: false,
      stats: { total: 0, active: 0, inactive: 0, with_images: 0, low_stock: 0 },
      error: error instanceof Error ? error.message : "Impossible de charger la gamme"
    });
  }
}

export default function AdminProductsGammeManagement() {
  const data = useLoaderData<typeof loader>();
  const { user, gamme, products, pagination, filters, enhanced, error, stats } = data;
  const [searchParams] = useSearchParams();

  const _viewMode = searchParams.get("view") || "grid";

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/products">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à l'admin
            </Link>
          </Button>
        </div>
        
        <div className="text-center">
          <Package className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Erreur Administrative</h1>
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
    <div className="space-y-6">
      {/* Header Admin */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/products">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour Admin
            </Link>
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              🔧 {gamme.name} - Gestion Admin
            </h1>
            <p className="text-muted-foreground">
              {stats.total} produits • {stats.active} actifs • {stats.inactive} inactifs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-red-50">
            Admin Level {user.level}
          </Badge>
          {enhanced && (
            <Badge variant="outline" className="bg-purple-50">
              Mode Avancé
            </Badge>
          )}
        </div>
      </div>

      {/* Statistiques Admin Rapides */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-sm text-gray-600">Actifs</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
            <div className="text-sm text-gray-600">Inactifs</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.with_images}</div>
            <div className="text-sm text-gray-600">Avec Images</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.low_stock}</div>
            <div className="text-sm text-gray-600">Stock Faible</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Admin */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 mb-4">
            <Button variant="default" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Produit
            </Button>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Config Gamme
            </Button>
          </div>

          {/* Filtres Admin Avancés */}
          <Form method="get" className="flex flex-col gap-4">
            {enhanced && <input type="hidden" name="enhanced" value="true" />}
            
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Recherche */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    name="search"
                    placeholder="Rechercher produits, SKU, références..."
                    defaultValue={filters.search}
                    className="pl-10"
                  />
                </div>
              </div>
              
              {/* Statut */}
              <Select name="status" defaultValue={filters.status}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="active">Actifs seulement</SelectItem>
                  <SelectItem value="inactive">Inactifs seulement</SelectItem>
                  <SelectItem value="low_stock">Stock faible</SelectItem>
                  <SelectItem value="no_image">Sans image</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Tri */}
              <Select name="sortBy" defaultValue={filters.sortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="piece_name">Nom</SelectItem>
                  <SelectItem value="piece_sku">SKU</SelectItem>
                  <SelectItem value="piece_id">ID</SelectItem>
                  <SelectItem value="year">Année</SelectItem>
                  <SelectItem value="stock_quantity">Stock</SelectItem>
                  <SelectItem value="price_ttc">Prix</SelectItem>
                </SelectContent>
              </Select>
              
              <Select name="sortOrder" defaultValue={filters.sortOrder}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">
                    <div className="flex items-center">
                      <SortAsc className="h-4 w-4 mr-2" />
                      Croissant
                    </div>
                  </SelectItem>
                  <SelectItem value="desc">
                    <div className="flex items-center">
                      <SortDesc className="h-4 w-4 mr-2" />
                      Décroissant
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              <Button type="submit" size="sm" variant="default">
                <Filter className="h-4 w-4 mr-2" />
                Appliquer
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      {/* Liste Produits Admin */}
      {products.length > 0 ? (
        <div className="space-y-4">
          {/* Mode List pour l'admin (plus d'infos) */}
          {products.map((product) => (
            <Card key={product.piece_id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Image */}
                  <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                    {product.has_image ? (
                      <div className="text-green-600 text-2xl">📷</div>
                    ) : (
                      <Package className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  
                  {/* Infos Produit */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1 truncate">
                      {product.piece_name}
                    </h3>
                    
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        ID: {product.piece_id}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        SKU: {product.piece_sku}
                      </Badge>
                      {product.year && (
                        <Badge variant="outline" className="text-xs">
                          {product.year}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Stock: {product.stock_quantity || 'N/A'}</span>
                      <span>Prix: {product.price_ttc ? `${product.price_ttc}€` : 'N/A'}</span>
                      {product.last_updated && (
                        <span>MAJ: {new Date(product.last_updated).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Statuts */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={product.piece_activ ? "default" : "secondary"}
                        className={`text-xs ${product.piece_activ ? 'success' : 'error'}`}
                      >
                        {product.piece_activ ? '✅ Actif' : '❌ Inactif'}
                      </Badge>
                      
                      {product.piece_top && (
                        <Badge variant="secondary" className="text-xs">
                          ⭐ Top
                        </Badge>
                      )}
                      
                      {product.has_oem && (
                        <Badge variant="outline" className="text-xs">
                          OEM
                        </Badge>
                      )}
                    </div>
                    
                    {/* Actions Admin */}
                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/admin/products/${product.piece_id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun produit trouvé</h3>
            <p className="text-gray-600 mb-4">
              {filters.search ? `Aucun produit ne correspond aux critères` : "Cette gamme ne contient pas de produits"}
            </p>
            <Button asChild variant="default">
              <Link to={`?${new URLSearchParams({...Object.fromEntries(searchParams.entries()), search: '', status: 'all'})}`}>
                Réinitialiser les filtres
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pagination Admin */}
      {pagination.totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {pagination.page} sur {pagination.totalPages} • {pagination.total} produits au total
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={pagination.page <= 1 ? "opacity-50 cursor-not-allowed" : ""}
                >
                  <Link 
                    to={`?${new URLSearchParams({...Object.fromEntries(searchParams), page: String(pagination.page - 1)})}`}
                    className={pagination.page <= 1 ? "pointer-events-none" : ""}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Précédent
                  </Link>
                </Button>
                
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={pagination.page >= pagination.totalPages ? "opacity-50 cursor-not-allowed" : ""}
                >
                  <Link 
                    to={`?${new URLSearchParams({...Object.fromEntries(searchParams), page: String(pagination.page + 1)})}`}
                    className={pagination.page >= pagination.totalPages ? "pointer-events-none" : ""}
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toggle Mode */}
      <div className="flex justify-center">
        <Button asChild variant="outline">
          <Link to={`?${new URLSearchParams({...Object.fromEntries(searchParams), enhanced: enhanced ? 'false' : 'true'})}`}>
            {enhanced ? 'Mode Simple' : 'Mode Avancé'}
          </Link>
        </Button>
      </div>
    </div>
  );
}
