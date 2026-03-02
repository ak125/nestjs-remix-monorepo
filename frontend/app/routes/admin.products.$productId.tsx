import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Alert } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction<typeof loader> = ({ data }) =>
  createNoIndexMeta(
    data?.product?.piece_name
      ? `${data.product.piece_name} - Admin`
      : "Produit - Admin",
  );

interface Product {
  piece_id: number;
  piece_name: string;
  piece_alias: string;
  piece_sku: string;
  piece_activ: boolean;
  piece_top: boolean;
  piece_description: string | null;
  piece_observation: string | null;
  piece_prix_achat: number | null;
  piece_taux_marge_min: number | null;
  piece_prix_unitaire: number | null;
  piece_qte_stock: number | null;
  piece_qte_stock_mini: number | null;
  piece_unite: string | null;
  piece_marque_reference: string | null;
  piece_fabricant_reference: string | null;
  piece_application: string | null;
  piece_critere_technique: string | null;
  piece_gamme_reference: string | null;
  piece_keyword_reference: string | null;
  piece_fiche_technique: string | null;
  piece_fiche_catalogue: string | null;
}

interface ProductDetailData {
  success: boolean;
  data: Product;
  message?: string;
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const productId = params.productId;

  if (!productId) {
    throw new Response("ID produit manquant", { status: 400 });
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:3000/api/admin/products/${productId}`,
    );
    const productData: ProductDetailData = await response.json();

    if (!productData.success) {
      throw new Response("Produit non trouvé", { status: 404 });
    }

    return json({ product: productData.data });
  } catch (error) {
    // Propager les Response HTTP (404, etc.) telles quelles
    if (error instanceof Response) {
      throw error;
    }
    logger.error("Erreur lors du chargement du produit:", error);
    throw new Response("Erreur lors du chargement du produit", { status: 500 });
  }
};

export default function AdminProductDetail() {
  const { product } = useLoaderData<typeof loader>();

  const formatPrice = (price: number | null) => {
    if (price === null) return "Non défini";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const formatPercentage = (value: number | null) => {
    if (value === null) return "Non défini";
    return `${value}%`;
  };

  const formatStock = (stock: number | null) => {
    if (stock === null) return "Non défini";
    return stock.toLocaleString("fr-FR");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center space-x-2">
              <Link
                to="/admin/products"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Retour aux produits
              </Link>
            </div>
            <h1 className="mt-2 text-3xl font-bold leading-6 text-gray-900">
              {product.piece_name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              ID #{product.piece_id} • {product.piece_alias}
            </p>
          </div>
          <div className="flex space-x-3">
            <Link
              to={`/admin/products/${product.piece_id}/edit`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
            >
              ✏️ Modifier
            </Link>
            <Link
              to="/admin/products/new"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              ➕ Dupliquer
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations principales */}
        <div className="lg:col-span-2 space-y-6">
          {/* Statut */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Statut</h2>
            <div className="flex space-x-4">
              <span
                className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                  product.piece_activ ? "success" : "error"
                }`}
              >
                {product.piece_activ
                  ? "✅ Produit Actif"
                  : "❌ Produit Inactif"}
              </span>
              {product.piece_top && (
                <Badge variant="warning">⭐ Produit TOP</Badge>
              )}
            </div>
          </div>

          {/* Informations générales */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Informations Générales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nom du produit
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {product.piece_name}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Référence
                </label>
                <p className="mt-1 text-sm text-gray-900 font-mono">
                  {product.piece_alias}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  SKU
                </label>
                <p className="mt-1 text-sm text-gray-900 font-mono">
                  {product.piece_sku}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Unité
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {product.piece_unite || "Non définie"}
                </p>
              </div>
              {product.piece_description && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {product.piece_description}
                  </p>
                </div>
              )}
              {product.piece_observation && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Observations
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {product.piece_observation}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Références fabricant */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Références Fabricant
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Marque / Référence
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {product.piece_marque_reference || "Non définie"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Fabricant / Référence
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {product.piece_fabricant_reference || "Non définie"}
                </p>
              </div>
            </div>
          </div>

          {/* Informations techniques */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Informations Techniques
            </h2>
            <div className="grid grid-cols-1 gap-6">
              {product.piece_application && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Application
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {product.piece_application}
                  </p>
                </div>
              )}
              {product.piece_critere_technique && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Critères Techniques
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {product.piece_critere_technique}
                  </p>
                </div>
              )}
              {product.piece_gamme_reference && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Gamme
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {product.piece_gamme_reference}
                  </p>
                </div>
              )}
              {product.piece_keyword_reference && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Mots-clés
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {product.piece_keyword_reference}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tarification */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Tarification
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Prix d'achat
                </label>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {formatPrice(product.piece_prix_achat)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Prix unitaire
                </label>
                <p className="mt-1 text-lg font-semibold text-green-600">
                  {formatPrice(product.piece_prix_unitaire)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Taux de marge min.
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {formatPercentage(product.piece_taux_marge_min)}
                </p>
              </div>
            </div>
          </div>

          {/* Stock */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Stock</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Quantité en stock
                </label>
                <p
                  className={`mt-1 text-2xl font-bold ${
                    product.piece_qte_stock &&
                    product.piece_qte_stock_mini &&
                    product.piece_qte_stock <= product.piece_qte_stock_mini
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {formatStock(product.piece_qte_stock)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Stock minimum
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {formatStock(product.piece_qte_stock_mini)}
                </p>
              </div>
              {product.piece_qte_stock &&
                product.piece_qte_stock_mini &&
                product.piece_qte_stock <= product.piece_qte_stock_mini && (
                  <Alert intent="error">⚠️ Stock faible !</Alert>
                )}
            </div>
          </div>

          {/* Documentation */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Documentation
            </h2>
            <div className="space-y-3">
              {product.piece_fiche_technique ? (
                <a
                  href={product.piece_fiche_technique}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                >
                  <span>📋</span>
                  <span>Fiche technique</span>
                </a>
              ) : (
                <span className="flex items-center space-x-2 text-gray-400">
                  <span>📋</span>
                  <span>Pas de fiche technique</span>
                </span>
              )}

              {product.piece_fiche_catalogue ? (
                <a
                  href={product.piece_fiche_catalogue}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                >
                  <span>📄</span>
                  <span>Fiche catalogue</span>
                </a>
              ) : (
                <span className="flex items-center space-x-2 text-gray-400">
                  <span>📄</span>
                  <span>Pas de fiche catalogue</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
