/**
 * 🏷️ PRODUCTS GAMME DETAIL - GESTION AVANCÉE
 * 
 * Affichage des produits d'une gamme spécifique avec :
 * - Pagination intelligente 
 * - Recherche temps réel
 * - Tri multi-critères
 * - Filtres avancés
 * - Mode Pro/Commercial
 * 
 * Route: /products/gammes/:gammeId
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link, Form, useSearchParams } from '@remix-run/react';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Grid, 
  List, 
  SortAsc, 
  SortDesc,
  Package,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { requireUser } from '../auth/unified.server';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

interface Product {
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
  // Nouvelles informations enrichies
  weight?: number;
  quantity_sale?: number;
  quantity_pack?: number;
  sort_order?: number;
  reference_clean?: string;
  category_name?: string;
  brand_id?: number;
  gamme_id?: number;
  filiere_id?: number;
  brand?: {
    id: number;
    name: string;
    logo?: string;
    is_active?: boolean;
    country?: string;
  };
  pricing?: {
    price_ht?: number;
    price_ttc?: number;
    discount?: number;
    date?: string;
  };
  oem_references?: Array<{
    reference: string;
    brand_name: string;
  }>;
  quality_rating?: {
    stars: number;
    quality_level: string;
  };
}

interface Gamme {
  id: string;
  name: string;
  alias?: string;
  image?: string;
  is_active: boolean;
}

interface GammeDetailData {
  user: {
    id: string;
    name: string;
    level: number;
    role: 'pro' | 'commercial';
  };
  gamme: Gamme;
  products: Product[];
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
  };
  enhanced: boolean;
  error?: string;
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  try {
    // Authentification utilisateur (optionnelle pour cette page publique)
    let user;
    try {
      user = await requireUser({ context });
    } catch {
      // Si pas d'utilisateur connecté, utiliser des valeurs par défaut
      user = {
        id: 'guest',
        name: 'Visiteur',
        email: 'guest@example.com',
        level: 1,
      };
    }
    
    const { gammeId } = params;
    if (!gammeId) {
      throw new Error('ID de gamme manquant');
    }
    
    const url = new URL(request.url);
    const enhanced = url.searchParams.get("enhanced") === "true";
    const search = url.searchParams.get("search") || "";
    const sortBy = url.searchParams.get("sortBy") || "piece_name";
    const sortOrder = url.searchParams.get("sortOrder") || "asc";
    
    const userName = user.name || user.email?.split('@')[0] || 'Utilisateur';
    const userLevel = user.level || 1;
    const userRole = userLevel >= 4 ? 'pro' : 'commercial';
    
    const baseUrl = process.env.API_URL || "http://localhost:3000";

    // Récupérer les données de la gamme via notre nouvelle API REST
    const response = await fetch(`${baseUrl}/api/gamme-rest/${gammeId}`, {
      headers: { 
        'internal-call': 'true',
        'user-role': userRole,
        'user-level': userLevel.toString()
      }
    });

    if (!response.ok) {
      console.error(`❌ API error ${response.status} for gamme ${gammeId}`);
      
      // Au lieu de lancer une erreur, retournons des données par défaut
      return json<GammeDetailData>({
        user: {
          id: user.id,
          name: userName,
          level: userLevel,
          role: userRole
        },
        gamme: {
          id: gammeId,
          name: `Gamme ${gammeId}`,
          is_active: true
        },
        products: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 24,
          totalPages: 0
        },
        filters: {
          search,
          sortBy,
          sortOrder
        },
        enhanced,
        error: `Erreur API: ${response.status}`
      });
    }

    const apiData = await response.json();
    
    // Gérer les redirections spéciales de l'API (comme la gamme 3940)
    if (!apiData.success && apiData.redirect) {
      throw new Response(null, {
        status: apiData.status || 301,
        headers: {
          Location: apiData.redirect,
        },
      });
    }
    
    // Adapter les données de notre nouvelle API au format attendu
    const gammeData = apiData.success ? apiData.data : null;
    
    return json<GammeDetailData>({
      user: {
        id: user.id,
        name: userName,
        level: userLevel,
        role: userRole
      },
      gamme: {
        id: gammeId,
        name: gammeData?.pg_name_site || `Gamme ${gammeId}`,
        alias: gammeData?.pg_alias,
        is_active: true
      },
      products: gammeData?.products || [],
      pagination: {
        total: gammeData?.products_count || 0,
        page: 1,
        limit: 50,
        totalPages: 1
      },
      filters: {
        search: "",
        sortBy: "piece_name",
        sortOrder: "asc"
      },
      enhanced
    });

  } catch (error) {
    console.error("❌ Erreur loader gamme detail:", error);
    
    return json<GammeDetailData>({
      user: {
        id: 'error',
        name: 'Erreur',
        level: 1,
        role: 'commercial'
      },
      gamme: { id: '', name: 'Erreur', is_active: false },
      products: [],
      pagination: { total: 0, page: 1, limit: 24, totalPages: 0 },
      filters: { search: '', sortBy: 'piece_name', sortOrder: 'asc' },
      enhanced: false,
      error: error instanceof Error ? error.message : "Impossible de charger la gamme"
    });
  }
}

export default function ProductsGammeDetail() {
  const data = useLoaderData<typeof loader>();
  const { user, gamme, products, pagination, filters, enhanced, error } = data;
  const [searchParams] = useSearchParams();

  // État de l'affichage
  const viewMode = searchParams.get("view") || "grid";

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button asChild variant="outline" size="sm">
            <Link to="/products/ranges">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux gammes
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
    <div className="space-y-6">
      {/* Header avec navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/products/ranges">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux gammes
            </Link>
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{gamme.name}</h1>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>{pagination.total.toLocaleString()} produits</span>
              <span>•</span>
              <span>Gamme automobile</span>
              {pagination.totalPages > 1 && (
                <>
                  <span>•</span>
                  <span>{pagination.totalPages} pages</span>
                </>
              )}
              {gamme.alias && (
                <>
                  <span>•</span>
                  <span className="text-blue-600 font-mono">{gamme.alias}</span>
                </>
              )}
            </div>
            {/* Statistiques enrichies */}
            <div className="flex items-center gap-6 mt-2 text-sm text-gray-600">
              {products && products.length > 0 && (
                <>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Avec OEM:</span>
                    <span className="text-green-600">
                      {products.filter(p => p.has_oem).length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Avec images:</span>
                    <span className="text-blue-600">
                      {products.filter(p => p.has_image).length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Marques uniques:</span>
                    <span className="text-purple-600">
                      {new Set(products.filter(p => p.brand_id).map(p => p.brand_id)).size}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user.role === 'pro' && (
            <Badge variant="outline" className="bg-primary/5">
              Mode Pro
            </Badge>
          )}
          {enhanced && (
            <Badge variant="outline" className="bg-success/5">
              Mode Avancé
            </Badge>
          )}
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <Card>
        <CardContent className="p-4">
          <Form method="get" className="flex flex-col gap-4">
            {/* Préserver les paramètres existants */}
            {enhanced && <input type="hidden" name="enhanced" value="true" />}
            
            {/* Recherche */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    name="search"
                    placeholder="Rechercher des produits..."
                    defaultValue={filters.search}
                    className="pl-10"
                  />
                </div>
              </div>
              
              {/* Tri */}
              <div className="flex gap-2">
                <Select name="sortBy" defaultValue={filters.sortBy}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="piece_name">Nom</SelectItem>
                    <SelectItem value="piece_ref">Référence</SelectItem>
                    <SelectItem value="year">Année</SelectItem>
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
              </div>
              
              <Button type="submit" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filtrer
              </Button>
            </div>
            
            {/* Options d'affichage */}
            <div className="flex justify-between items-center pt-2 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Affichage :</span>
                <div className="flex border rounded-md">
                  <Button
                    asChild
                    variant={viewMode === "grid" ? "default" : "outline"}
                    size="sm"
                    className="rounded-r-none"
                  >
                    <Link to={`?${new URLSearchParams({...Object.fromEntries(searchParams), view: 'grid'})}`}>
                      <Grid className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant={viewMode === "list" ? "default" : "outline"}
                    size="sm"
                    className="rounded-l-none"
                  >
                    <Link to={`?${new URLSearchParams({...Object.fromEntries(searchParams), view: 'list'})}`}>
                      <List className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
              
              <div className="text-sm text-gray-600">
                {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} sur {pagination.total} produits
              </div>
            </div>
          </Form>
        </CardContent>
      </Card>

      {/* Liste des produits */}
      {products.length > 0 ? (
        <div className={`grid gap-4 ${
          viewMode === "grid" 
            ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "grid-cols-1"
        }`}>
          {products.map((product) => (
            <Card key={product.piece_id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className={`${viewMode === "list" ? "flex items-center gap-4" : ""}`}>
                  {/* Image placeholder */}
                  <div className={`${viewMode === "list" ? "w-20 h-20" : "w-full h-32"} bg-gray-100 rounded-lg flex items-center justify-center mb-3`}>
                    {product.has_image ? (
                      <div className="text-green-600">📷</div>
                    ) : (
                      <Package className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                      {product.piece_name}
                    </h3>
                    
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {product.piece_sku}
                      </Badge>
                      {product.reference_clean && product.reference_clean !== product.piece_sku && (
                        <Badge variant="secondary" className="text-xs">
                          {product.reference_clean}
                        </Badge>
                      )}
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
                      {!product.piece_activ && (
                        <Badge variant="destructive" className="text-xs">
                          Inactif
                        </Badge>
                      )}
                      {product.quality_rating && (
                        <Badge variant="outline" className="text-xs text-yellow-600">
                          {'★'.repeat(product.quality_rating.stars)} {product.quality_rating.quality_level}
                        </Badge>
                      )}
                    </div>

                    {/* Informations enrichies */}
                    <div className="grid grid-cols-2 gap-2 mb-2 text-xs text-gray-600">
                      {product.brand && product.brand.name && product.brand.name !== 'Marque inconnue' ? (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Marque:</span>
                          <span className="text-blue-600">{product.brand.name}</span>
                          {product.brand.country && (
                            <span className="text-gray-400">({product.brand.country})</span>
                          )}
                        </div>
                      ) : product.brand_id && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Marque ID:</span>
                          <span className="text-gray-500">{product.brand_id}</span>
                        </div>
                      )}
                      {product.category_name && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Catégorie:</span>
                          <span>{product.category_name}</span>
                        </div>
                      )}
                      {product.weight && product.weight > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Poids:</span>
                          <span>{product.weight} kg</span>
                        </div>
                      )}
                      {product.quantity_pack && product.quantity_pack > 1 && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Pack:</span>
                          <span>{product.quantity_pack} pcs</span>
                        </div>
                      )}
                    </div>

                    {/* Prix si disponible */}
                    {product.pricing && (
                      <div className="mb-2 p-2 bg-success/5 rounded text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-green-800">Prix TTC: {product.pricing.price_ttc}€</span>
                          {product.pricing.discount && product.pricing.discount > 0 && (
                            <span className="text-red-600">-{product.pricing.discount}%</span>
                          )}
                        </div>
                        {product.pricing.price_ht && (
                          <div className="text-gray-600">Prix HT: {product.pricing.price_ht}€</div>
                        )}
                      </div>
                    )}

                    {/* Références OEM */}
                    {product.oem_references && product.oem_references.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs font-medium text-gray-700 mb-1">Références OEM:</div>
                        <div className="flex flex-wrap gap-1">
                          {product.oem_references.slice(0, 3).map((oem, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {oem.reference} ({oem.brand_name})
                            </Badge>
                          ))}
                          {product.oem_references.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{product.oem_references.length - 3} autres
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {product.piece_description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {product.piece_description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        ID: {product.piece_id}
                        {product.year && ` • ${product.year}`}
                        {product.sort_order && product.sort_order !== 1 && ` • Tri: ${product.sort_order}`}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/products/${product.piece_id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            Voir
                          </Link>
                        </Button>
                        {user.level >= 4 && (
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
              {filters.search ? `Aucun produit ne correspond à "${filters.search}"` : "Cette gamme ne contient pas de produits"}
            </p>
            {filters.search && (
              <Button asChild variant="outline">
                <Link to={`/pieces/${gamme.alias || 'gamme'}-${gamme.id}.html`}>
                  Voir tous les produits
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {pagination.page} sur {pagination.totalPages}
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
                
                {/* Pages */}
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, pagination.page - 2) + i;
                  if (pageNum > pagination.totalPages) return null;
                  
                  return (
                    <Button
                      key={pageNum}
                      asChild
                      variant={pageNum === pagination.page ? "default" : "outline"}
                      size="sm"
                    >
                      <Link to={`?${new URLSearchParams({...Object.fromEntries(searchParams), page: String(pageNum)})}`}>
                        {pageNum}
                      </Link>
                    </Button>
                  );
                })}
                
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

      {/* Mode Enhancement */}
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
