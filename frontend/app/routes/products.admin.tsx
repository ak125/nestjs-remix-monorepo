/**
 * � PRODUCTS ADMIN - INTERFACE COMMERCIALE
 *
 * ⚠️ IMPORTANT: Cette route est DIFFÉRENTE de /admin/products
 *
 * 🎯 Usage:
 * - Route: /products/admin
 * - Audience: COMMERCIAL (level 3+) + ADMIN (level 7+)
 * - Contexte: Gestion quotidienne des produits, catalogue enrichi
 *
 * 📊 Features commerciales:
 * - 4M+ produits automobile avec recherche avancée
 * - Visualisation enrichie (images, specs, compatibilité)
 * - Progressive Enhancement (?enhanced=true)
 * - Stats temps réel (stock, ventes, tendances)
 * - Interface optimisée pour la vente
 *
 * 🔄 Comparaison avec /admin/products:
 * - /products/admin (ICI): Interface commerciale richeFull-featured UI, niveau 3+
 * - /admin/products: Interface système basique, config, niveau 7+
 *
 * ✅ Quand utiliser cette route:
 * - Recherche produit pour créer une commande
 * - Consultation catalogue client
 * - Vérification stock disponible
 * - Analytics ventes par produit
 *
 * Routes:
 * - /products/admin (interface base)
 * - /products/admin?enhanced=true (interface avancée)
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
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  ShoppingCart,
  Eye,
  TrendingUp,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { Error404 } from "~/components/errors/Error404";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";
import { requireUser } from "../auth/unified.server";
import { Pagination } from "../components/products/Pagination";
import { ProductFilters } from "../components/products/ProductFilters";
import { ProductsQuickActions } from "../components/products/ProductsQuickActions";
import { ProductsStatsCard } from "../components/products/ProductsStatsCard";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Produits - Interface Commerciale");

// API Product Interface (from backend)
interface APIProduct {
  id: number;
  name: string;
  reference: string;
  description: string | null;
  brand: {
    id: number;
    name: string;
    logo?: string;
  };
  pricing: {
    publicTTC: number;
    proHT: number;
    consigneTTC: number;
    margin: number;
    currency: string;
  };
  stock: {
    available: number;
    status: "in_stock" | "low_stock" | "out_of_stock";
    minAlert: number;
  };
  status: {
    isActive: boolean;
    hasImage: boolean;
    year: number;
  };
  categoryId: number;
  available: boolean;
}

// UI Product Interface (for display)
interface Product {
  id: string;
  name: string;
  description: string;
  reference: string;
  price: number;
  priceProf?: number;
  brand: string;
  category: string;
  image: string;
  stock: number;
  rating: number;
  reviews: number;
  deliveryTime: string;
  discount?: number;
  margin?: number;
  is_active?: boolean;
  stockStatus?: "in_stock" | "low_stock" | "out_of_stock";
}

interface ProductStats {
  totalProducts: number;
  categoriesCount?: number;
  brandsCount?: number;
  averageRating?: number;
  inStock?: number;
  exclusiveProducts?: number; // Pro-only
  lowStockItems?: number; // Commercial focus
  totalBrands?: number; // Commercial naming
  totalCategories?: number; // Commercial naming
}

interface ProductsData {
  user: {
    id: string;
    name: string;
    level: number;
    role: "pro" | "commercial";
  };
  stats: ProductStats;
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filterLists: {
    gammes: Array<{ id: string; name: string }>;
    brands: Array<{ id: string; name: string }>;
  };
  recentProducts?: Product[]; // Commercial style
  recentBrands?: Array<{
    marque_id: number;
    marque_name: string;
  }>;
  enhanced: boolean;
  error?: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUser({ context });

  // Vérifier accès commercial (niveau 3+)
  const userLevel = user.level || 0;
  const userName = user.name || "Utilisateur";
  const userRole = "commercial"; // Une seule interface commerciale
  if (userLevel < 3) {
    throw new Response("Accès refusé - Compte commercial requis", {
      status: 403,
    });
  }

  // Paramètres URL
  const url = new URL(request.url);
  logger.log("🌐 [LOADER] Full URL:", url.toString());
  logger.log(
    "🌐 [LOADER] Search params:",
    Object.fromEntries(url.searchParams.entries()),
  );

  const enhanced = url.searchParams.get("enhanced") === "true";
  const search = url.searchParams.get("search") || "";
  const page = url.searchParams.get("page") || "1";
  const limit = url.searchParams.get("limit") || "50";
  const gammeId = url.searchParams.get("gammeId") || "";
  const brandId = url.searchParams.get("brandId") || "";
  // Par défaut: actifs seulement (sauf si explicitement demandé tous)
  const activeOnly = url.searchParams.get("activeOnly");
  const isActive = activeOnly === "true" || activeOnly === null ? "true" : "";
  const lowStock = url.searchParams.get("lowStock") || "";

  logger.log("🔍 [LOADER] Extracted params:", {
    gammeId,
    brandId,
    search,
    page,
    limit,
    isActive,
    lowStock,
  });

  const baseUrl = getInternalApiUrl("");

  try {
    // Appels API pour interface commerciale
    const apiCalls = [
      fetch(`${baseUrl}/api/products/stats`, {
        headers: {
          "internal-call": "true",
          "user-level": userLevel.toString(),
        },
      }),
      fetch(`${baseUrl}/api/products/gammes`, {
        headers: { "internal-call": "true" },
      }),
      fetch(`${baseUrl}/api/products/brands-test`, {
        headers: { "internal-call": "true" },
      }),
    ];

    const responses = await Promise.all(apiCalls);

    // Parse stats (common to both roles)
    let stats: ProductStats = {
      totalProducts: 0,
      brandsCount: 0,
      categoriesCount: 0,
    };

    if (responses[0]?.ok) {
      const statsData = await responses[0].json();
      stats = {
        totalProducts: statsData.totalProducts || 0,
        brandsCount: statsData.totalBrands || statsData.brandsCount || 0,
        categoriesCount:
          statsData.totalCategories || statsData.categoriesCount || 0,
        lowStockItems: statsData.lowStockItems || 0,
        inStock: statsData.activeProducts || statsData.inStock || 0,
      };
    }

    // 🔥 VRAIES DONNÉES - Récupérer produits depuis l'API avec prix + filtres
    let products: Product[] = [];
    let pagination = { page: 1, limit: 50, total: 0, totalPages: 0 };
    let filterLists = { gammes: [], brands: [] };

    try {
      // Construire URL avec paramètres
      const queryParams = new URLSearchParams();
      if (search) queryParams.set("search", search);
      if (page) queryParams.set("page", page);
      if (limit) queryParams.set("limit", limit);
      if (gammeId) queryParams.set("gammeId", gammeId);
      if (brandId) queryParams.set("brandId", brandId);
      if (isActive) queryParams.set("isActive", isActive);
      if (lowStock) queryParams.set("lowStock", lowStock);

      const apiUrl = `${baseUrl}/api/products/admin/list?${queryParams.toString()}`;
      logger.log("📡 [LOADER] Calling API:", apiUrl);

      // Construire URL pour les filtres dynamiques
      const filtersParams = new URLSearchParams();
      if (gammeId) filtersParams.set("gammeId", gammeId);
      if (brandId) filtersParams.set("brandId", brandId);
      const filtersUrl = `${baseUrl}/api/products/filters/lists?${filtersParams.toString()}`;
      logger.log("📡 [LOADER] Calling Filters API:", filtersUrl);

      const [productsResponse, filtersResponse] = await Promise.all([
        fetch(apiUrl, {
          headers: {
            "internal-call": "true",
            "user-level": userLevel.toString(),
          },
        }),
        fetch(filtersUrl, {
          headers: { "internal-call": "true" },
        }),
      ]);

      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        pagination = productsData.pagination || pagination;

        // Transformer les données API vers format UI
        products = (productsData.products || []).map(
          (apiProduct: APIProduct) => ({
            id: apiProduct.id.toString(),
            name: apiProduct.name,
            description:
              apiProduct.description || `Référence: ${apiProduct.reference}`,
            reference: apiProduct.reference,
            price: apiProduct.pricing.publicTTC,
            priceProf: apiProduct.pricing.proHT,
            margin: apiProduct.pricing.margin,
            brand: apiProduct.brand.name,
            category: `Catégorie ${apiProduct.categoryId}`,
            image: apiProduct.status.hasImage
              ? `/images/products/${apiProduct.id}.jpg`
              : "/images/product-placeholder.jpg",
            stock: apiProduct.stock.available,
            stockStatus: apiProduct.stock.status,
            rating: 4.5, // TODO: Implémenter système d'avis
            reviews: 0,
            deliveryTime:
              apiProduct.stock.status === "in_stock" ? "24-48h" : "3-5j",
            is_active: apiProduct.status.isActive,
          }),
        );
      }

      if (filtersResponse.ok) {
        filterLists = await filtersResponse.json();
      }
    } catch (error) {
      logger.error("❌ Erreur chargement produits:", error);
      // Continuer avec tableau vide
    }

    return json<ProductsData>({
      user: {
        id: user.id,
        name: userName,
        level: userLevel,
        role: userRole,
      },
      stats,
      products,
      pagination,
      filterLists,
      enhanced,
      recentProducts: responses[1]?.ok
        ? (await responses[1].json()).slice(0, 6)
        : [],
      recentBrands: responses[2]?.ok ? await responses[2].json() : [],
    });
  } catch (error) {
    logger.error("Products data loading error:", error);
    return json<ProductsData>({
      user: {
        id: user.id,
        name: userName,
        level: userLevel,
        role: userRole,
      },
      stats: { totalProducts: 0, brandsCount: 0, categoriesCount: 0 },
      products: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      filterLists: { gammes: [], brands: [] },
      enhanced,
      error: "Erreur lors du chargement des données produits",
    });
  }
}

export default function ProductsAdmin() {
  const data = useLoaderData<typeof loader>();
  const { user, stats, products, pagination, filterLists, enhanced, error } =
    data;

  // Compter filtres actifs
  const [searchParams] = useSearchParams();
  const activeFiltersCount = [
    "search",
    "gammeId",
    "brandId",
    "isActive",
    "lowStock",
  ].filter((key) => searchParams.get(key)).length;

  // Handle refresh
  const handleRefresh = () => {
    window.location.reload();
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
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
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Gestion Produits {user.role === "pro" ? "Pro" : "Commercial"}
          </h1>
          <p className="text-gray-600 mt-2">
            {user.role === "pro"
              ? "Interface professionnelle avec accès exclusif et tarifs négociés"
              : "Interface commerciale pour la gestion catalogue et stocks"}
          </p>
          {enhanced && (
            <Badge variant="secondary" className="mt-2">
              Mode Avancé Activé
            </Badge>
          )}
        </div>

        {!enhanced && (
          <Link to="/products/admin?enhanced=true">
            <Button variant="outline" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Mode Avancé
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <ProductsStatsCard
        totalProducts={stats.totalProducts}
        categoriesCount={stats.categoriesCount || stats.totalCategories}
        brandsCount={stats.brandsCount || stats.totalBrands}
        averageRating={stats.averageRating}
        inStock={stats.inStock}
        exclusiveProducts={stats.exclusiveProducts}
        lowStockItems={stats.lowStockItems}
        enhanced={enhanced}
        userRole={user.role}
      />

      {/* Quick Actions */}
      <ProductsQuickActions
        enhanced={enhanced}
        userRole={user.role}
        onRefresh={handleRefresh}
      />

      {/* Filtres Avancés */}
      <ProductFilters
        gammes={filterLists.gammes}
        brands={filterLists.brands}
        activeFiltersCount={activeFiltersCount}
      />

      {/* Products Table - Interface Commerciale */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            Catalogue Produits ({pagination.total.toLocaleString()} produits -
            Page {pagination.page}/{pagination.totalPages})
          </h2>
        </div>

        {/* Tableau Produits */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Référence
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prix Public TTC
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prix Pro HT
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Marge %
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => {
                    // Badge stock coloré
                    const stockBadge =
                      product.stockStatus === "out_of_stock"
                        ? { color: "error", label: "Rupture" }
                        : product.stockStatus === "low_stock"
                          ? { color: "orange", label: "Stock Faible" }
                          : { color: "success", label: "Disponible" };

                    return (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {product.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {product.brand}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 font-mono">
                            {product.reference}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            {product.price.toFixed(2)} €
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-semibold text-blue-600">
                            {product.priceProf?.toFixed(2) || "—"} €
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {product.margin && product.margin > 0 ? (
                            <Badge variant="secondary" className="font-mono">
                              {product.margin.toFixed(1)}%
                            </Badge>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge className={stockBadge.color}>
                              {stockBadge.label}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {product.stock} unités
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {product.is_active ? (
                            <Badge className="bg-success/20 text-success">
                              ✓ Actif
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inactif</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link to={`/products/${product.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button size="sm" variant="outline">
                              <ShoppingCart className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
        />
      </div>

      {enhanced && (
        <div className="border-t pt-8">
          <h3 className="text-lg font-semibold mb-4">Analytics Avancées</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">Tendances</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Analyse des ventes et tendances marché
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Performance</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Métriques de performance produits
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <span className="font-medium">Alertes</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Stock faible et actions requises
                </p>
              </CardContent>
            </Card>
          </div>
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
