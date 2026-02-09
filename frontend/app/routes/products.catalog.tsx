/**
 * 📋 PRODUCTS CATALOG - UNIFIED INTERFACE
 *
 * Catalogue unifié des produits
 * Remplace commercial.products.catalog.tsx
 *
 * Features:
 * - Role-based access (Commercial/Pro)
 * - Advanced search and filtering
 * - Progressive Enhancement ready
 * - Component library integration
 *
 * Routes:
 * - /products/catalog (base interface)
 * - /products/catalog?enhanced=true (advanced interface)
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useSearchParams,
  Form,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  ArrowLeft,
  Search,
  Filter,
  Package,
  Grid,
  List,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Error404 } from "~/components/errors/Error404";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { requireUser } from "../auth/unified.server";
import { ProductsQuickActions } from "../components/products/ProductsQuickActions";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";

/**
 * 🔍 SEO Meta Tags - Catalogue produits (accès restreint)
 */
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const total = data?.pagination?.total || 0;
  return [
    { title: `Catalogue Produits (${total.toLocaleString()}) | Espace Pro` },
    {
      name: "description",
      content: `Catalogue de ${total.toLocaleString()} pièces détachées automobiles. Accès réservé aux professionnels.`,
    },
    { name: "robots", content: "noindex, nofollow" }, // Espace pro - pas d'indexation
  ];
};

interface Product {
  piece_id: string;
  piece_name: string;
  piece_alias?: string;
  piece_sku: string;
  piece_activ: boolean;
  piece_top: boolean;
  piece_description?: string;
  price?: number; // Pro feature
  stock_level?: number; // Enhanced data
  category?: string; // Enhanced data
  brand?: string; // Enhanced data
}

interface CatalogData {
  user: {
    id: string;
    name: string;
    level: number;
    role: "pro" | "commercial";
  };
  products: Product[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: {
    searchTerm: string;
    brand?: string;
    category?: string;
    activeOnly: boolean;
  };
  enhanced: boolean;
  error?: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUser({ context });

  // Determine user role and check access
  const userLevel = user.level || 0;
  const userName = user.name || "Utilisateur";
  const userRole =
    userLevel >= 4 ? "pro" : userLevel >= 3 ? "commercial" : null;

  if (!userRole) {
    throw new Response(
      "Accès refusé - Compte professionnel ou commercial requis",
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const enhanced = url.searchParams.get("enhanced") === "true";
  const searchTerm = url.searchParams.get("search") || "";
  const brand = url.searchParams.get("brand") || "";
  const category = url.searchParams.get("category") || "";
  const activeOnly = url.searchParams.get("active") === "true";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "24"), 100);
  const page = parseInt(url.searchParams.get("page") || "1");

  const baseUrl = getInternalApiUrl("");

  try {
    // Build query parameters
    const queryParams = new URLSearchParams({
      search: searchTerm,
      page: page.toString(),
      limit: limit.toString(),
      ...(brand && { brand }),
      ...(category && { category }),
      ...(activeOnly && { active: "true" }),
      ...(enhanced && { enhanced: "true" }),
    });

    const response = await fetch(
      `${baseUrl}/api/products/catalog?${queryParams}`,
      {
        headers: {
          "internal-call": "true",
          "user-role": userRole,
          "user-level": userLevel.toString(),
        },
      },
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const catalogData = await response.json();

    // Map and enhance products data
    const products: Product[] = (catalogData.products || []).map(
      (product: any) => ({
        piece_id: product.piece_id || product.id,
        piece_name: product.piece_name || product.name,
        piece_alias: product.piece_alias || product.alias,
        piece_sku: product.piece_sku || product.sku,
        piece_activ: product.piece_activ ?? product.is_active ?? true,
        piece_top: product.piece_top ?? product.is_top ?? false,
        piece_description: product.piece_description || product.description,
        ...(userRole === "pro" && product.price && { price: product.price }),
        ...(enhanced && {
          stock_level: product.stock_level,
          category: product.category,
          brand: product.brand,
        }),
      }),
    );

    const pagination = {
      total: catalogData.total || products.length,
      page,
      limit,
      totalPages: Math.ceil((catalogData.total || products.length) / limit),
    };

    return json<CatalogData>({
      user: {
        id: user.id,
        name: userName,
        level: userLevel,
        role: userRole,
      },
      products,
      pagination,
      filters: {
        searchTerm,
        brand: brand || undefined,
        category: category || undefined,
        activeOnly,
      },
      enhanced,
    });
  } catch (error) {
    logger.error("Catalog loading error:", error);
    return json<CatalogData>({
      user: {
        id: user.id,
        name: userName,
        level: userLevel,
        role: userRole,
      },
      products: [],
      pagination: { total: 0, page: 1, limit, totalPages: 0 },
      filters: { searchTerm, activeOnly: false },
      enhanced,
      error: "Erreur lors du chargement du catalogue",
    });
  }
}

export default function ProductsCatalog() {
  const data = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, products, pagination, filters, enhanced, error } = data;
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Handle refresh
  const handleRefresh = () => {
    window.location.reload();
  };

  // Handle search
  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const search = formData.get("search") as string;

    const newParams = new URLSearchParams(searchParams);
    if (search) {
      newParams.set("search", search);
    } else {
      newParams.delete("search");
    }
    newParams.set("page", "1"); // Reset to first page
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Erreur de chargement
          </h1>
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
      {/* Breadcrumb */}
      <PublicBreadcrumb
        items={[
          { label: "Produits", href: "/products" },
          { label: "Catalogue" },
        ]}
      />

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
              <Package className="h-8 w-8 text-blue-600" />
              Catalogue Produits {user.role === "pro" ? "Pro" : "Commercial"}
            </h1>
            <p className="text-gray-600 mt-2">
              {pagination.total} produits disponibles
            </p>
            {enhanced && (
              <Badge variant="secondary" className="mt-2">
                Mode Avancé - Données Complètes
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {!enhanced && (
            <Link
              to={`/products/catalog?enhanced=true${searchParams.toString() ? "&" + searchParams.toString() : ""}`}
            >
              <Button variant="outline" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Mode Avancé
              </Button>
            </Link>
          )}

          <div className="flex border border-gray-200 rounded-lg">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="rounded-r-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 border border-gray-200 rounded-lg space-y-4">
        <Form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1">
            <Input
              type="text"
              name="search"
              placeholder="Rechercher des produits..."
              defaultValue={filters.searchTerm}
              className="w-full"
            />
          </div>
          <Button type="submit" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Rechercher
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtres
          </Button>
        </Form>

        {/* Active Filters */}
        {(filters.searchTerm || filters.brand || filters.category) && (
          <div className="flex flex-wrap gap-2">
            {filters.searchTerm && (
              <Badge variant="secondary">Recherche: {filters.searchTerm}</Badge>
            )}
            {filters.brand && (
              <Badge variant="secondary">Marque: {filters.brand}</Badge>
            )}
            {filters.category && (
              <Badge variant="secondary">Catégorie: {filters.category}</Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchParams({})}
              className="text-gray-500 hover:text-gray-700"
            >
              Effacer tout
            </Button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <ProductsQuickActions
        enhanced={enhanced}
        userRole={user.role}
        onRefresh={handleRefresh}
      />

      {/* Products Grid/List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Page {pagination.page} sur {pagination.totalPages}(
            {pagination.total} produits au total)
          </div>

          <div className="text-sm text-gray-600">
            {products.length} produits affichés
          </div>
        </div>

        {viewMode === "grid" ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <Card
                key={product.piece_id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">
                        {product.piece_name}
                      </h3>
                      {product.piece_alias && (
                        <p className="text-xs text-gray-600 truncate">
                          {product.piece_alias}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 ml-2">
                      {product.piece_top && (
                        <Badge variant="secondary" className="text-xs">
                          Top
                        </Badge>
                      )}
                      {!product.piece_activ && (
                        <Badge variant="destructive" className="text-xs">
                          Inactif
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-gray-600 mb-4">
                    <div>SKU: {product.piece_sku}</div>
                    {enhanced && (
                      <>
                        {product.brand && <div>Marque: {product.brand}</div>}
                        {product.category && (
                          <div>Catégorie: {product.category}</div>
                        )}
                        {product.stock_level !== undefined && (
                          <div>Stock: {product.stock_level}</div>
                        )}
                      </>
                    )}
                    {user.role === "pro" && product.price && (
                      <div className="font-semibold text-green-600">
                        Prix: {product.price}€
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button asChild size="sm" className="flex-1 text-xs">
                      <Link to={`/products/${product.piece_id}`}>
                        Voir Détails
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((product) => (
              <Card
                key={product.piece_id}
                className="hover:shadow-sm transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900">
                          {product.piece_name}
                        </h3>
                        {product.piece_top && (
                          <Badge variant="secondary" className="text-xs">
                            Top
                          </Badge>
                        )}
                        {!product.piece_activ && (
                          <Badge variant="destructive" className="text-xs">
                            Inactif
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-4 text-sm text-gray-600 mt-1">
                        <span>SKU: {product.piece_sku}</span>
                        {product.piece_alias && (
                          <span>Alias: {product.piece_alias}</span>
                        )}
                        {enhanced && product.brand && (
                          <span>Marque: {product.brand}</span>
                        )}
                        {enhanced && product.category && (
                          <span>Catégorie: {product.category}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {enhanced && product.stock_level !== undefined && (
                        <div className="text-sm text-gray-600">
                          Stock: {product.stock_level}
                        </div>
                      )}
                      {user.role === "pro" && product.price && (
                        <div className="text-sm font-semibold text-green-600">
                          {product.price}€
                        </div>
                      )}
                      <Button asChild size="sm">
                        <Link to={`/products/${product.piece_id}`}>Voir</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {products.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun produit trouvé
            </h3>
            <p className="text-gray-600">
              Essayez de modifier vos critères de recherche ou vos filtres.
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {pagination.page > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newParams = new URLSearchParams(searchParams);
                newParams.set("page", (pagination.page - 1).toString());
                setSearchParams(newParams);
              }}
            >
              Précédent
            </Button>
          )}

          <span className="flex items-center px-3 text-sm text-gray-600">
            Page {pagination.page} sur {pagination.totalPages}
          </span>

          {pagination.page < pagination.totalPages && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newParams = new URLSearchParams(searchParams);
                newParams.set("page", (pagination.page + 1).toString());
                setSearchParams(newParams);
              }}
            >
              Suivant
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
