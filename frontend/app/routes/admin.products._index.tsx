/**
 * ⚙️ ADMIN PRODUCTS - INTERFACE SYSTÈME
 *
 * ⚠️ IMPORTANT: Cette route est DIFFÉRENTE de /products/admin
 *
 * 🎯 Usage:
 * - Route: /admin/products
 * - Audience: ADMIN SYSTÈME uniquement (level 7+)
 * - Contexte: Configuration système, gestion technique des produits
 *
 * 🔧 Features système:
 * - CRUD basique des produits (Create, Read, Update, Delete)
 * - Activation/désactivation produits
 * - Gestion des SKU et alias techniques
 * - Configuration base de données
 * - Interface simple et fonctionnelle
 *
 * 🔄 Comparaison avec /products/admin:
 * - /admin/products (ICI): Interface système basique, config, niveau 7+
 * - /products/admin: Interface commerciale riche, full-featured, niveau 3+
 *
 * ✅ Quand utiliser cette route:
 * - Ajouter/modifier des produits en BDD
 * - Activer/désactiver des références
 * - Configurer les SKU techniques
 * - Maintenance système des produits
 *
 * 🚫 NE PAS utiliser pour:
 * - Recherche produit quotidienne → Utiliser /products/admin
 * - Créer une commande → Utiliser /products/admin
 *
 * @meta noindex, nofollow - Admin only
 */
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link, Form } from "@remix-run/react";
import { useState } from "react";
import { AdminBreadcrumb } from "~/components/admin/AdminBreadcrumb";
import { Alert } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export const meta: MetaFunction = () => [
  { title: "Produits | Admin AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/admin/products",
  },
];

interface Product {
  piece_id: number;
  piece_name: string;
  piece_alias: string;
  piece_sku: string;
  piece_activ: boolean;
  piece_top: boolean;
  piece_description: string | null;
}

interface ProductsApiResponse {
  success: boolean;
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const page = url.searchParams.get("page") || "1";
    const limit = url.searchParams.get("limit") || "25";
    const search = url.searchParams.get("search") || "";

    console.log(
      `🔄 Produits Admin: Chargement page ${page}, limit ${limit}, search: "${search}"`,
    );

    // Appel API produits
    const apiUrl = `http://127.0.0.1:3000/api/admin/products?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const productsData: ProductsApiResponse = await response.json();

    // Statistiques produits
    const statsResponse = await fetch(
      "http://127.0.0.1:3000/api/admin/products/stats/detailed",
    );
    const statsData = statsResponse.ok ? await statsResponse.json() : null;

    console.log(`✅ Produits chargés: ${productsData.data.length} items`);

    return json({
      products: productsData,
      stats: statsData?.stats || null,
      searchQuery: search,
    });
  } catch (error) {
    console.error("❌ Erreur chargement produits:", error);

    return json({
      products: {
        success: false,
        data: [],
        pagination: { page: 1, limit: 25, total: 0, pages: 0 },
        error: "Erreur de chargement",
      },
      stats: null,
      searchQuery: "",
      error: String(error),
    });
  }
};

export default function AdminProducts() {
  const { products, stats, searchQuery } = useLoaderData<typeof loader>();
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);

  const toggleProduct = (productId: number) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId],
    );
  };

  const toggleAll = () => {
    if (selectedProducts.length === products.data.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.data.map((p) => p.piece_id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <AdminBreadcrumb currentPage="Gestion des produits" />

      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold leading-6 text-gray-900">
              📦 Gestion des Produits
            </h1>
            <p className="mt-2 max-w-4xl text-sm text-gray-500">
              Administration et gestion complète des produits
            </p>
          </div>
          <div className="flex space-x-3">
            <Button
              className="px-4 py-2 border border-transparent shadow-sm text-sm  rounded-md"
              variant="blue"
              asChild
            >
              <Link to="/admin/products/new">➕ Nouveau Produit</Link>
            </Button>
            <Link
              to="/admin/products/export"
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              📤 Exporter
            </Link>
          </div>
        </div>

        {/* Statistiques rapides */}
        {stats && (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white overflow-hidden shadow rounded-lg p-4">
              <dt className="text-sm font-medium text-gray-500">
                Total Produits
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">
                {stats.totalProducts?.toLocaleString("fr-FR") || "0"}
              </dd>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg p-4">
              <dt className="text-sm font-medium text-gray-500">
                Produits Actifs
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-green-600">
                {stats.activeProducts?.toLocaleString("fr-FR") || "0"}
              </dd>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg p-4">
              <dt className="text-sm font-medium text-gray-500">Catégories</dt>
              <dd className="mt-1 text-2xl font-semibold text-blue-600">
                {stats.totalCategories?.toLocaleString("fr-FR") || "0"}
              </dd>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg p-4">
              <dt className="text-sm font-medium text-gray-500">
                Stock Faible
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-red-600">
                {stats.lowStockItems?.toLocaleString("fr-FR") || "0"}
              </dd>
            </div>
          </div>
        )}
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white shadow rounded-lg p-6">
        <Form
          method="get"
          className="space-y-4 sm:flex sm:items-center sm:space-y-0 sm:space-x-4"
        >
          <div className="flex-1">
            <label htmlFor="search" className="sr-only">
              Rechercher
            </label>
            <input
              type="text"
              name="search"
              id="search"
              defaultValue={searchQuery}
              placeholder="Rechercher par nom, référence, SKU..."
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <Button
            className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            variant="blue"
            type="submit"
          >
            \n 🔍 Rechercher\n
          </Button>
          {searchQuery && (
            <Link
              to="/admin/products"
              className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              🗑️ Effacer
            </Link>
          )}
        </Form>
      </div>

      {/* Actions en lot */}
      {selectedProducts.length > 0 && (
        <Alert className="rounded-lg p-4" variant="info">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">
              {selectedProducts.length} produit(s) sélectionné(s)
            </span>
            <div className="flex space-x-2">
              <Button className="text-sm  px-3 py-1 rounded" variant="blue">
                \n Activer\n
              </Button>
              <button className="text-sm bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700">
                Désactiver
              </button>
              <Button className="text-sm  px-3 py-1 rounded" variant="red">
                \n Supprimer\n
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {/* Tableau des produits */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {products.success ? (
          <>
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Produits ({products.pagination.total.toLocaleString("fr-FR")})
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Page {products.pagination.page} sur {products.pagination.pages}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          selectedProducts.length === products.data.length &&
                          products.data.length > 0
                        }
                        onChange={toggleAll}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Référence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      État
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.data.map((product) => (
                    <tr key={product.piece_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.piece_id)}
                          onChange={() => toggleProduct(product.piece_id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.piece_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8">
                            <div className="h-8 w-8 rounded-md bg-gray-200 flex items-center justify-center">
                              <span className="text-xs">📦</span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {product.piece_name}
                            </div>
                            {product.piece_top && (
                              <div className="text-xs text-orange-600 font-medium">
                                ⭐ Top
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.piece_alias}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.piece_sku}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          className="inline-flex px-2 py-1 text-xs font-semibold rounded-full "
                          variant={product.piece_activ ? "success" : "error"}
                        >
                          \n {product.piece_activ ? "Actif" : "Inactif"}\n
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Link
                          to={`/admin/products/${product.piece_id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          👁️ Voir
                        </Link>
                        <Link
                          to={`/admin/products/${product.piece_id}/edit`}
                          className="text-green-600 hover:text-green-900"
                        >
                          ✏️ Modifier
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 flex justify-between sm:hidden">
                  {products.pagination.page > 1 && (
                    <Link
                      to={`/admin/products?page=${products.pagination.page - 1}&search=${searchQuery}`}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Précédent
                    </Link>
                  )}
                  {products.pagination.page < products.pagination.pages && (
                    <Link
                      to={`/admin/products?page=${products.pagination.page + 1}&search=${searchQuery}`}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Suivant
                    </Link>
                  )}
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Affichage de{" "}
                      <span className="font-medium">
                        {(products.pagination.page - 1) *
                          products.pagination.limit +
                          1}
                      </span>{" "}
                      à{" "}
                      <span className="font-medium">
                        {Math.min(
                          products.pagination.page * products.pagination.limit,
                          products.pagination.total,
                        )}
                      </span>{" "}
                      sur{" "}
                      <span className="font-medium">
                        {products.pagination.total}
                      </span>{" "}
                      résultats
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      {products.pagination.page > 1 && (
                        <Link
                          to={`/admin/products?page=${products.pagination.page - 1}&search=${searchQuery}`}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        >
                          ←
                        </Link>
                      )}

                      {/* Pages numbers */}
                      {Array.from(
                        { length: Math.min(5, products.pagination.pages) },
                        (_, i) => {
                          const pageNum =
                            Math.max(1, products.pagination.page - 2) + i;
                          if (pageNum > products.pagination.pages) return null;

                          return (
                            <Link
                              key={pageNum}
                              to={`/admin/products?page=${pageNum}&search=${searchQuery}`}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                pageNum === products.pagination.page
                                  ? "z-10 bg-primary/5 border-blue-500 text-blue-600"
                                  : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                              }`}
                            >
                              {pageNum}
                            </Link>
                          );
                        },
                      )}

                      {products.pagination.page < products.pagination.pages && (
                        <Link
                          to={`/admin/products?page=${products.pagination.page + 1}&search=${searchQuery}`}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        >
                          →
                        </Link>
                      )}
                    </nav>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500">
              <p className="text-lg">❌ Erreur de chargement des produits</p>
              <p className="text-sm mt-2">{products.error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
