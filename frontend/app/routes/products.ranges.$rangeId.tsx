/**
 * 📦 PRODUCTS BY RANGE - GESTION PAR GAMME
 *
 * Affichage des produits d'une gamme spécifique avec :
 * - Liste complète des produits de la gamme
 * - Pagination avancée
 * - Recherche dans la gamme
 * - Filtres par disponibilité, prix, etc.
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link, useSearchParams, Form } from "@remix-run/react";
import {
  ArrowLeft,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  Grid,
  List,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";
import { requireUser } from "../auth/unified.server";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

export const meta: MetaFunction = () => createNoIndexMeta("Gamme Produits");

interface Product {
  piece_id: number;
  piece_name: string;
  piece_alias?: string;
  piece_sku: string;
  piece_activ: boolean;
  piece_top: boolean;
  piece_description?: string;
  piece_image?: string | null;
  price?: number;
  price_pro?: number;
  stock?: number;
  category?: string;
}

interface ProductsByRangeData {
  user: {
    id: string;
    name: string;
    level: number;
    role: "pro" | "commercial";
  };
  range: {
    id: string;
    name: string;
    description: string;
  };
  products: Product[];
  stats: {
    total: number;
    active: number;
    inStock: number;
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
    view: "grid" | "list";
  };
  enhanced: boolean;
  error?: string;
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  try {
    // Authentification utilisateur
    const user = await requireUser({ context });

    const rangeId = params.rangeId;
    if (!rangeId) {
      throw new Response("ID de gamme requis", { status: 400 });
    }

    const url = new URL(request.url);
    const enhanced = url.searchParams.get("enhanced") === "true";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "24");
    const search = url.searchParams.get("search") || "";
    const statusFilter = url.searchParams.get("status") || "all";
    const sortBy = url.searchParams.get("sort") || "name";
    const viewMode = (url.searchParams.get("view") || "grid") as
      | "grid"
      | "list";

    const userName = user.name || user.email?.split("@")[0] || "Utilisateur";
    const userLevel = user.level || 1;
    const userRole = userLevel >= 4 ? "pro" : "commercial";

    const baseUrl = getInternalApiUrl("");

    // Récupérer les informations de la gamme
    const rangeResponse = await fetch(`${baseUrl}/api/products/gammes`, {
      headers: { "internal-call": "true" },
    });

    let rangeInfo: any = null;
    if (rangeResponse.ok) {
      const ranges = await rangeResponse.json();
      rangeInfo = ranges.find((r: any) => r.id === rangeId);
    }

    if (!rangeInfo) {
      throw new Response("Gamme non trouvée", { status: 404 });
    }

    // Récupérer les produits de cette gamme (simulation avec des données réelles)
    const productsResponse = await fetch(
      `${baseUrl}/api/products/pieces-catalog?limit=1000`,
      {
        headers: {
          "internal-call": "true",
          "user-role": userRole,
          "user-level": userLevel.toString(),
        },
      },
    );

    let allProducts: Product[] = [];

    if (productsResponse.ok) {
      const productsData = await productsResponse.json();
      const realProducts = productsData.products || [];

      // Simuler des produits spécifiques à cette gamme
      // Dans une vraie app, filtrer par gamme_id
      const productsForRange = Array.from(
        { length: Math.floor(Math.random() * 200) + 50 },
        (_, i) => {
          const baseProduct = realProducts[i % realProducts.length];
          return {
            piece_id: baseProduct.piece_id + i * 1000,
            piece_name: `${rangeInfo.name} - ${baseProduct.piece_name} ${i + 1}`,
            piece_alias: baseProduct.piece_alias,
            piece_sku: `${baseProduct.piece_sku}-${rangeId}-${i + 1}`,
            piece_activ: Math.random() > 0.1, // 90% actifs
            piece_top: Math.random() > 0.8, // 20% top
            piece_description: `Produit spécialisé de la gamme ${rangeInfo.name}`,
            piece_image: null,
            price: Math.floor(Math.random() * 500) + 10,
            ...(userRole === "pro" && {
              price_pro: Math.floor(Math.random() * 400) + 8,
            }),
            stock: Math.floor(Math.random() * 100),
            category: rangeInfo.name,
          };
        },
      );

      // Appliquer les filtres
      let filteredProducts = productsForRange.filter((product) => {
        // Filtre de recherche
        if (search) {
          const searchTerm = search.toLowerCase();
          const matchName = product.piece_name
            .toLowerCase()
            .includes(searchTerm);
          const matchSku = product.piece_sku.toLowerCase().includes(searchTerm);
          const matchAlias =
            product.piece_alias &&
            product.piece_alias.toLowerCase().includes(searchTerm);
          if (!matchName && !matchSku && !matchAlias) return false;
        }

        // Filtre de statut
        if (statusFilter === "active" && !product.piece_activ) return false;
        if (statusFilter === "inactive" && product.piece_activ) return false;
        if (statusFilter === "top" && !product.piece_top) return false;
        if (
          statusFilter === "instock" &&
          (!product.stock || product.stock <= 0)
        )
          return false;

        return true;
      });

      // Appliquer le tri
      filteredProducts.sort((a, b) => {
        switch (sortBy) {
          case "name":
            return a.piece_name.localeCompare(b.piece_name);
          case "name_desc":
            return b.piece_name.localeCompare(a.piece_name);
          case "price":
            return (a.price || 0) - (b.price || 0);
          case "price_desc":
            return (b.price || 0) - (a.price || 0);
          case "stock":
            return (b.stock || 0) - (a.stock || 0);
          case "sku":
            return a.piece_sku.localeCompare(b.piece_sku);
          default:
            return a.piece_name.localeCompare(b.piece_name);
        }
      });

      const totalFiltered = filteredProducts.length;

      // Appliquer la pagination
      const startIndex = (page - 1) * limit;
      allProducts = filteredProducts.slice(startIndex, startIndex + limit);

      const totalPages = Math.ceil(totalFiltered / limit);

      return json<ProductsByRangeData>({
        user: {
          id: user.id,
          name: userName,
          level: userLevel,
          role: userRole,
        },
        range: {
          id: rangeId,
          name: rangeInfo.name,
          description: rangeInfo.alias || `Gamme automobile: ${rangeInfo.name}`,
        },
        products: allProducts,
        stats: {
          total: productsForRange.length,
          active: productsForRange.filter((p) => p.piece_activ).length,
          inStock: productsForRange.filter((p) => p.stock && p.stock > 0)
            .length,
          filtered: totalFiltered,
        },
        pagination: {
          total: totalFiltered,
          page,
          limit,
          totalPages,
        },
        filters: {
          search,
          status: statusFilter,
          sort: sortBy,
          view: viewMode,
        },
        enhanced,
      });
    }

    throw new Error("Impossible de charger les produits");
  } catch (error) {
    logger.error("❌ Erreur loader products by range:", error);

    if (error instanceof Response) {
      throw error;
    }

    return json<ProductsByRangeData>({
      user: { id: "error", name: "Erreur", level: 1, role: "commercial" },
      range: { id: "", name: "Erreur", description: "Erreur de chargement" },
      products: [],
      stats: { total: 0, active: 0, inStock: 0, filtered: 0 },
      pagination: { total: 0, page: 1, limit: 24, totalPages: 0 },
      filters: { search: "", status: "all", sort: "name", view: "grid" },
      enhanced: false,
      error: "Impossible de charger les produits de cette gamme",
    });
  }
}

export default function ProductsByRange() {
  const data = useLoaderData<typeof loader>();
  const { user, range, products, stats, pagination, filters, enhanced, error } =
    data;
  const [searchParams, setSearchParams] = useSearchParams();

  const handleFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", newPage.toString());
    setSearchParams(newParams);
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button asChild variant="outline" size="sm">
            <Link to="/products/ranges/advanced">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux gammes
            </Link>
          </Button>
        </div>

        <div className="text-center">
          <Package className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Erreur de chargement
          </h1>
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
          <Link to="/products/ranges/advanced">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Gammes
          </Link>
        </Button>

        <div className="flex-1">
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
            <Link to="/products/admin" className="hover:text-gray-900">
              Products
            </Link>
            <span>/</span>
            <Link
              to="/products/ranges/advanced"
              className="hover:text-gray-900"
            >
              Gammes
            </Link>
            <span>/</span>
            <span className="text-gray-900 truncate">{range.name}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">📦 {range.name}</h1>
          <p className="text-gray-600">
            {stats.filtered} produits trouvés sur {stats.total} total
          </p>
        </div>

        {enhanced && (
          <Badge variant="secondary" className="bg-info/20 text-info">
            ⚡ Mode Avancé
          </Badge>
        )}

        {user.role === "pro" && (
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">
            💎 PRO
          </Badge>
        )}
      </div>

      {/* Statistiques rapides */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {stats.total}
            </div>
            <p className="text-sm text-gray-600">Produits Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {stats.active}
            </div>
            <p className="text-sm text-gray-600">Actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {stats.inStock}
            </div>
            <p className="text-sm text-gray-600">En Stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {stats.filtered}
            </div>
            <p className="text-sm text-gray-600">Filtrés</p>
          </CardContent>
        </Card>
      </div>

      {/* Barre de recherche et filtres */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Recherche dans la gamme "{range.name}"
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-6">
            {/* Recherche */}
            <div className="md:col-span-2">
              <Form method="get" className="flex gap-2">
                <Input
                  name="search"
                  placeholder="Rechercher un produit..."
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
              onValueChange={(value) => handleFilter("status", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">✅ Actifs</SelectItem>
                <SelectItem value="inactive">❌ Inactifs</SelectItem>
                <SelectItem value="top">⭐ Top Produits</SelectItem>
                <SelectItem value="instock">📦 En Stock</SelectItem>
              </SelectContent>
            </Select>

            {/* Tri */}
            <Select
              value={filters.sort}
              onValueChange={(value) => handleFilter("sort", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">📝 Nom A-Z</SelectItem>
                <SelectItem value="name_desc">📝 Nom Z-A</SelectItem>
                <SelectItem value="price">💰 Prix croissant</SelectItem>
                <SelectItem value="price_desc">💰 Prix décroissant</SelectItem>
                <SelectItem value="stock">📦 Stock</SelectItem>
                <SelectItem value="sku">🔢 SKU</SelectItem>
              </SelectContent>
            </Select>

            {/* Limite par page */}
            <Select
              value={pagination.limit.toString()}
              onValueChange={(value) => handleFilter("limit", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Par page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12 par page</SelectItem>
                <SelectItem value="24">24 par page</SelectItem>
                <SelectItem value="48">48 par page</SelectItem>
                <SelectItem value="96">96 par page</SelectItem>
              </SelectContent>
            </Select>

            {/* Vue */}
            <div className="flex gap-2">
              <Button
                variant={filters.view === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => handleFilter("view", "grid")}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={filters.view === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => handleFilter("view", "list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des produits */}
      {products.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucun produit trouvé
            </h3>
            <p className="text-gray-600 mb-4">
              Aucun produit ne correspond à vos critères dans cette gamme.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchParams(new URLSearchParams({ page: "1" }));
              }}
            >
              Réinitialiser les filtres
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Produits en mode grille */}
          {filters.view === "grid" && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
              {products.map((product) => (
                <Card
                  key={product.piece_id}
                  className="hover:shadow-lg transition-shadow"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm leading-tight mb-2 line-clamp-2">
                          {product.piece_name}
                        </CardTitle>
                        <div className="flex items-center gap-1 mb-2">
                          {product.piece_activ ? (
                            <Badge className="bg-success/20 text-success text-xs">
                              ✅
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              ❌
                            </Badge>
                          )}
                          {product.piece_top && (
                            <Badge className="bg-warning/20 text-warning text-xs">
                              ⭐
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">
                          SKU: {product.piece_sku}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Prix et stock */}
                    <div className="space-y-2 mb-4">
                      {product.price && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Prix</span>
                          <span className="font-medium">{product.price}€</span>
                        </div>
                      )}

                      {user.role === "pro" && product.price_pro && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Prix Pro</span>
                          <span className="font-medium text-purple-600">
                            {product.price_pro}€
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Stock</span>
                        <Badge
                          variant={
                            !product.stock || product.stock === 0
                              ? "destructive"
                              : product.stock < 10
                                ? "secondary"
                                : "default"
                          }
                        >
                          {product.stock || 0}
                        </Badge>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button asChild size="sm" className="flex-1">
                        <Link to={`/products/${product.piece_id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          Détail
                        </Link>
                      </Button>
                      {product.piece_activ &&
                        product.stock &&
                        product.stock > 0 && (
                          <Button variant="outline" size="sm">
                            <ShoppingCart className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Produits en mode liste */}
          {filters.view === "list" && (
            <Card className="mb-8">
              <CardContent className="p-0">
                <div className="divide-y">
                  {products.map((product) => (
                    <div
                      key={product.piece_id}
                      className="p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {product.piece_name}
                            </h3>
                            <div className="flex items-center gap-2">
                              {product.piece_activ ? (
                                <Badge className="bg-success/20 text-success">
                                  ✅
                                </Badge>
                              ) : (
                                <Badge variant="secondary">❌</Badge>
                              )}
                              {product.piece_top && (
                                <Badge className="bg-warning/20 text-warning">
                                  ⭐
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>SKU: {product.piece_sku}</span>
                            {product.price && <span>💰 {product.price}€</span>}
                            {user.role === "pro" && product.price_pro && (
                              <span>💎 {product.price_pro}€ Pro</span>
                            )}
                            <span>📦 Stock: {product.stock || 0}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button asChild size="sm">
                            <Link to={`/products/${product.piece_id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Détail
                            </Link>
                          </Button>
                          {product.piece_activ &&
                            product.stock &&
                            product.stock > 0 && (
                              <Button variant="outline" size="sm">
                                <ShoppingCart className="h-4 w-4" />
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
                      {(pagination.page - 1) * pagination.limit + 1}-
                      {Math.min(
                        pagination.page * pagination.limit,
                        pagination.total,
                      )}
                      sur {pagination.total} produits
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

                    <div className="flex gap-1">
                      {Array.from(
                        { length: Math.min(5, pagination.totalPages) },
                        (_, i) => {
                          const pageNum = Math.max(1, pagination.page - 2) + i;
                          if (pageNum > pagination.totalPages) return null;
                          return (
                            <Button
                              key={pageNum}
                              variant={
                                pageNum === pagination.page
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        },
                      )}
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
