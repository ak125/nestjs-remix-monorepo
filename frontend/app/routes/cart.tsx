/**
 * 🛒 CART PAGE - Route principale du panier
 * Version simplifiée sans CartContext
 *
 * ✅ Fonctionnalités:
 * - Affichage du panier avec produits
 * - Actions via useFetcher (approche Remix native)
 * - Gestion des erreurs et états vides
 * - Compatible avec l'authentification NestJS/Remix
 * - Barre de progression livraison gratuite (150€)
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useNavigation,
  useRevalidator,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  ShoppingBag,
  Truck,
  Shield,
  CreditCard,
  Package,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ChevronLeft,
} from "lucide-react";
import React, { useEffect } from "react";
import { getCart } from "../services/cart.server";
import { Error404 } from "~/components/errors/Error404";

import {
  MobileBottomBar,
  MobileBottomBarSpacer,
} from "~/components/layout/MobileBottomBar";
import { Alert, Badge } from "~/components/ui";
import { Button } from "~/components/ui/button";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { trackViewCart } from "~/utils/analytics";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

// Phase 9: PageRole pour analytics
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R2_PRODUCT, {
    clusterId: "cart",
    canonicalEntity: "panier",
    funnelStage: "decision",
    conversionGoal: "purchase",
  }),
};

// 🤖 SEO: Page transactionnelle non indexable
export const meta: MetaFunction = () => [
  { title: "Mon panier | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/cart",
  },
];

// Seuil pour la livraison gratuite
const FREE_SHIPPING_THRESHOLD = 150;

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  // console.log("🛒 [CART LOADER] Chargement du panier depuis cart.tsx");
  try {
    const url = new URL(request.url);
    const cleared = url.searchParams.get("cleared");

    const cartData = await getCart(request);
    return json({
      cart: cartData,
      success: true,
      error: null,
      cleared: cleared === "true",
    });
  } catch (error) {
    console.error("Erreur lors du chargement du panier:", error);
    return json({
      cart: {
        items: [],
        summary: {
          total_items: 0,
          total_price: 0,
          subtotal: 0,
          tax_amount: 0,
          shipping_cost: 0,
          consigne_total: 0, // ✅ PHASE 4
          currency: "EUR",
        },
      },
      success: false,
      error: "Erreur lors du chargement du panier",
      cleared: false,
    });
  }
};

// NOTE: Les fonctions API ont été supprimées.
// Utiliser les méthodes du hook useCart() qui appellent cart.api.ts

// Helper: formater le prix
function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

// Composant Barre de progression livraison gratuite
function FreeShippingProgress({ subtotal }: { subtotal: number }) {
  const progress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const remaining = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
  const isEligible = subtotal >= FREE_SHIPPING_THRESHOLD;

  // Message dynamique selon la progression
  const getMessage = () => {
    if (progress >= 90) return "Vous y êtes presque ! 🔥";
    if (progress >= 70) return "Encore un petit effort !";
    if (progress >= 50) return "Vous êtes à mi-chemin !";
    return "Ajoutez des articles pour économiser !";
  };

  return (
    <div
      className={`rounded-2xl p-5 mb-6 transition-all duration-300 ${
        isEligible
          ? "bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white shadow-lg shadow-green-200"
          : "bg-white border-2 border-blue-100 shadow-md"
      }`}
    >
      {isEligible ? (
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-full animate-bounce">
            <Truck className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-xl">
              🎉 Félicitations ! Livraison OFFERTE
            </p>
            <p className="text-sm opacity-90">
              Vous économisez 9,90€ sur cette commande
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
            <span className="text-2xl">🚚</span>
            <span className="font-bold">0,00€</span>
          </div>
        </div>
      ) : (
        <div>
          {/* Header avec icône et progression */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2.5 rounded-full">
                <Truck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900">
                  Livraison gratuite dès {formatPrice(FREE_SHIPPING_THRESHOLD)}
                </p>
                <p className="text-sm text-gray-500">{getMessage()}</p>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="info" className="text-lg font-bold px-3 py-1">
                {Math.round(progress)}%
              </Badge>
            </div>
          </div>

          {/* Barre de progression améliorée */}
          <div className="relative w-full bg-gray-100 rounded-full h-4 overflow-hidden mb-4">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-green-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
            {/* Marqueur objectif */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow" />
          </div>

          {/* Message incitatif avec montant restant */}
          <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3">
            <span className="text-xl">💡</span>
            <p className="text-gray-700">
              Plus que{" "}
              <span className="font-extrabold text-xl text-blue-600 mx-1">
                {formatPrice(remaining)}
              </span>
              pour débloquer la{" "}
              <span className="font-bold text-green-600">
                livraison gratuite
              </span>{" "}
              !
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Composant CartSummary avec design amélioré
function CartSummary({
  summary,
  children,
  isUpdating,
}: {
  summary: any;
  children?: React.ReactNode;
  isUpdating?: boolean;
}) {
  const total =
    summary.total_price ||
    summary.subtotal +
      (summary.consigne_total || 0) +
      summary.tax_amount +
      summary.shipping_cost -
      (summary.discount_amount || 0);
  const isEligibleFreeShipping = summary.subtotal >= FREE_SHIPPING_THRESHOLD;

  return (
    <div
      className={`bg-white border-2 border-gray-200 rounded-2xl shadow-xl overflow-hidden transition-all ${
        isUpdating ? "opacity-50 scale-[0.98]" : "hover:shadow-2xl"
      }`}
    >
      {/* Header avec icône */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white px-6 py-4">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Package className="h-6 w-6" />
          Résumé de la commande
          {isUpdating && (
            <Badge variant="info" size="sm" className="ml-auto">
              <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full mr-2 inline-block"></div>
              Mise à jour...
            </Badge>
          )}
        </h2>
      </div>

      <div className="p-6 space-y-4">
        {/* Nombre de pièces */}
        <div className="flex justify-between items-center p-4 bg-blue-50 rounded-xl border border-blue-100">
          <span className="font-semibold text-gray-700 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-blue-600" />
            Nombre d'articles
          </span>
          <Badge variant="info" size="lg" className="text-lg px-4 py-1">
            {summary.total_items}
          </Badge>
        </div>

        {/* Sous-total */}
        <div className="flex justify-between items-center py-3 border-b border-gray-100">
          <span className="text-gray-600">Sous-total produits</span>
          <span className="font-semibold text-lg">
            {formatPrice(summary.subtotal)}
          </span>
        </div>

        {/* Consignes */}
        {summary.consigne_total > 0 && (
          <div className="flex justify-between items-center p-3 bg-amber-50 rounded-xl border-2 border-amber-200">
            <span className="text-amber-800 font-medium flex items-center gap-2">
              <span className="text-xl">♻️</span>
              Consignes
              <span className="text-xs bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                remboursables
              </span>
            </span>
            <span className="font-bold text-amber-700">
              +{formatPrice(summary.consigne_total)}
            </span>
          </div>
        )}

        {/* Livraison - Affichée uniquement si gratuite */}
        {isEligibleFreeShipping && (
          <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl border-2 border-green-200">
            <span className="text-green-700 font-medium flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Livraison
            </span>
            <span className="font-bold text-green-600 flex items-center gap-1">
              ✓ OFFERTE
            </span>
          </div>
        )}

        {summary.tax_amount > 0 && (
          <div className="flex justify-between py-3 border-b border-gray-100">
            <span className="text-gray-600">TVA incluse</span>
            <span className="font-medium">
              {formatPrice(summary.tax_amount)}
            </span>
          </div>
        )}

        {summary.discount_amount > 0 && (
          <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl border-2 border-green-200">
            <span className="text-green-700 font-medium flex items-center gap-2">
              <span className="text-xl">🎁</span>
              Remise appliquée
            </span>
            <span className="font-bold text-green-700">
              -{formatPrice(summary.discount_amount)}
            </span>
          </div>
        )}

        {/* Total */}
        <div className="mt-4 pt-4 border-t-2 border-gray-200">
          <div className="flex justify-between items-center p-5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg">
            <span className="font-bold text-lg text-white">Total TTC</span>
            <span className="font-extrabold text-3xl text-white">
              {formatPrice(total)}
            </span>
          </div>
        </div>
      </div>

      {children && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

// Composant CartItem simplifié avec design moderne et compact
function CartItem({
  item,
  onUpdate,
  onRemove,
}: {
  item: any;
  onUpdate: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
}) {
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [currentQuantity, setCurrentQuantity] = React.useState(item.quantity);
  const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 1 || newQuantity === currentQuantity || isUpdating)
      return;

    const oldQuantity = currentQuantity;
    setIsUpdating(true);
    setCurrentQuantity(newQuantity);

    try {
      await onUpdate(item.product_id, newQuantity);
    } catch (error) {
      setCurrentQuantity(oldQuantity);
      console.error("Erreur mise à jour quantité:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onRemove(item.product_id);
    } catch (error) {
      console.error("Erreur suppression:", error);
    } finally {
      setIsRemoving(false);
      setShowConfirmDelete(false);
    }
  };

  // Calcul du prix
  const isTotal = Math.abs(item.price - item.price * item.quantity) < 0.01;
  const unitPrice = isTotal ? item.price / item.quantity : item.price;
  const totalPrice = isTotal ? item.price : item.price * item.quantity;

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm transition-all duration-300 overflow-hidden ${
        isUpdating || isRemoving
          ? "opacity-50 pointer-events-none"
          : "hover:shadow-md hover:border-blue-200"
      }`}
    >
      <div className="p-4 sm:p-5">
        {/* En-tête avec nom produit et badge consigne */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-lg leading-tight truncate">
              {item.product_name || item.name || "Produit sans nom"}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">
                Réf: {item.product_sku || item.product_id}
              </span>
              {item.product_brand &&
                item.product_brand !== "MARQUE INCONNUE" &&
                item.product_brand !== "Non spécifiée" && (
                  <Badge variant="secondary" size="sm">
                    {item.product_brand}
                  </Badge>
                )}
              {item.has_consigne && item.consigne_unit > 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                  ♻️ +{formatPrice(item.consigne_unit)} consigne
                </span>
              )}
            </div>
          </div>

          {/* Bouton supprimer - toujours visible */}
          {!showConfirmDelete ? (
            <button
              onClick={() => setShowConfirmDelete(true)}
              disabled={isUpdating || isRemoving}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
              title="Supprimer cet article"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleRemove}
                disabled={isRemoving}
                className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isRemoving ? "..." : "Confirmer"}
              </button>
            </div>
          )}
        </div>

        {/* Ligne inférieure : Quantité + Prix */}
        <div className="flex items-center justify-between gap-4 pt-3 border-t border-gray-100">
          {/* Contrôle quantité compact */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:inline">
              Quantité:
            </span>
            <div className="flex items-center border rounded-lg overflow-hidden bg-gray-50">
              <button
                onClick={() => handleQuantityChange(currentQuantity - 1)}
                disabled={isUpdating || isRemoving || currentQuantity <= 1}
                className="p-2 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Minus className="h-4 w-4 text-gray-600" />
              </button>
              <span className="px-4 py-2 font-bold text-lg bg-white min-w-[50px] text-center border-x">
                {currentQuantity}
              </span>
              <button
                onClick={() => handleQuantityChange(currentQuantity + 1)}
                disabled={isUpdating || isRemoving}
                className="p-2 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Prix */}
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {formatPrice(totalPrice)}
            </div>
            {currentQuantity > 1 && (
              <div className="text-xs text-gray-500">
                {currentQuantity} × {formatPrice(unitPrice)}
              </div>
            )}
          </div>
        </div>

        {/* Loader discret */}
        {(isUpdating || isRemoving) && (
          <div className="mt-3 flex items-center justify-center gap-2 text-blue-600 text-sm">
            <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span>{isUpdating ? "Mise à jour..." : "Suppression..."}</span>
          </div>
        )}
      </div>
    </div>
  );
} // Composant panier vide avec design amélioré
function EmptyCart() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 sm:p-12 max-w-lg mx-auto shadow-xl border text-center">
        <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="h-12 w-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold mb-3 text-gray-800">
          Votre panier est vide
        </h2>
        <p className="text-gray-600 mb-8">
          Découvrez nos pièces auto et ajoutez-les à votre panier
        </p>

        <Button asChild size="lg" variant="blue" className="w-full sm:w-auto">
          <Link to="/" className="inline-flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Découvrir nos produits
          </Link>
        </Button>
      </div>
    </div>
  );
}

// Composant principal
export default function CartPage() {
  const { cart, success, error, cleared } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [notification, setNotification] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // 📊 GA4: Tracker la vue du panier (une seule fois au montage)
  useEffect(() => {
    if (cart?.items?.length) {
      const validItems = cart.items.filter(
        (item): item is NonNullable<typeof item> => item !== null,
      );
      if (validItems.length > 0) {
        trackViewCart(validItems as any[], cart.summary?.subtotal || 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Afficher une notification temporaire
  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Gérer la mise à jour de quantité via API directe
  const handleUpdateQuantity = async (productId: number, quantity: number) => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          product_id: productId,
          quantity,
          replace: true,
        }),
      });

      if (response.ok) {
        showNotification("success", "Quantité mise à jour");
        revalidator.revalidate();
        // 🔄 Synchroniser la Navbar et Sidecart
        window.dispatchEvent(new Event("cart:updated"));
      } else {
        throw new Error("Erreur mise à jour");
      }
    } catch (err) {
      console.error("Erreur mise à jour quantité:", err);
      showNotification("error", "Erreur lors de la mise à jour");
    } finally {
      setIsProcessing(false);
    }
  };

  // Gérer la suppression d'article via API directe
  const handleRemoveItem = async (productId: number) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/cart/items/${productId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (response.ok) {
        showNotification("success", "Article supprimé");
        revalidator.revalidate();
        // 🔄 Synchroniser la Navbar et Sidecart
        window.dispatchEvent(new Event("cart:updated"));
      } else {
        throw new Error("Erreur suppression");
      }
    } catch (err) {
      console.error("Erreur suppression:", err);
      showNotification("error", "Erreur lors de la suppression");
    } finally {
      setIsProcessing(false);
    }
  };

  // Vider le panier via API directe
  const handleClearCart = async () => {
    if (
      !confirm(
        "Vider le panier ? " +
          cart.summary.total_items +
          " article(s) seront supprimés",
      )
    ) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (response.ok) {
        showNotification("success", "Panier vidé");
        revalidator.revalidate();
        // 🔄 Synchroniser la Navbar et Sidecart
        window.dispatchEvent(new Event("cart:updated"));
      } else {
        throw new Error("Erreur vidage");
      }
    } catch (err) {
      console.error("Erreur vidage panier:", err);
      showNotification("error", "Erreur lors du vidage");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!success || error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold mb-2">Erreur de chargement</h2>
            <p className="text-gray-600 mb-6">
              {error || "Une erreur est survenue"}
            </p>
            <Button
              className="inline-block  px-6 py-3 rounded-lg"
              variant="blue"
              asChild
            >
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!cart.items || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyCart />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <PublicBreadcrumb items={[{ label: "Panier" }]} />

        {/* Notification de succès après vidage */}
        {cleared && (
          <Alert
            intent="success"
            variant="solid"
            icon={<span className="text-lg">✅</span>}
            className="mb-4"
          >
            Panier vidé avec succès !
          </Alert>
        )}

        {/* En-tête amélioré */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-3 rounded-xl">
              <ShoppingBag className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Mon Panier
              </h1>
              <p className="text-gray-600">
                {cart.summary.total_items} article
                {cart.summary.total_items > 1 ? "s" : ""} •{" "}
                {formatPrice(cart.summary.subtotal)}
              </p>
            </div>
          </div>
        </div>

        {/* Barre de progression livraison gratuite */}
        <FreeShippingProgress subtotal={cart.summary.subtotal} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Liste des articles */}
          <div className="lg:col-span-2 space-y-4">
            {notification && (
              <Alert
                intent={notification.type === "success" ? "success" : "error"}
                variant="solid"
                icon={
                  <span className="text-lg">
                    {notification.type === "success" ? "✅" : "❌"}
                  </span>
                }
              >
                {notification.message}
              </Alert>
            )}

            {cart.items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onUpdate={handleUpdateQuantity}
                onRemove={handleRemoveItem}
              />
            ))}

            {/* Actions bas de liste */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-4 border-t border-gray-200">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                <ChevronLeft className="h-4 w-4" />
                Continuer mes achats
              </Link>

              <button
                type="button"
                onClick={handleClearCart}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 text-gray-500 hover:text-red-600 text-sm transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="underline-offset-2 hover:underline">
                  {isProcessing ? "Vidage..." : "Vider le panier"}
                </span>
              </button>
            </div>
          </div>

          {/* Résumé et actions - Sticky sur desktop */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 space-y-4">
              <CartSummary
                summary={cart.summary}
                isUpdating={navigation.state === "loading"}
              >
                <div className="space-y-3">
                  <Link
                    to="/checkout"
                    className="w-full py-4 px-6 bg-orange-500 hover:bg-orange-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-3"
                  >
                    <span className="text-white text-lg">🛒</span>
                    <span className="text-white font-bold text-lg">
                      Finaliser ma commande
                    </span>
                    <ArrowRight className="h-5 w-5 text-white" />
                  </Link>
                </div>
              </CartSummary>

              {/* Avantages */}
              <div className="bg-white rounded-xl border p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <Shield className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">
                      Paiement sécurisé
                    </h3>
                    <p className="text-xs text-gray-600">
                      Transactions cryptées SSL
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Truck className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">
                      Livraison rapide
                    </h3>
                    <p className="text-xs text-gray-600">
                      Expédition sous 24-48h
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <CreditCard className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">
                      Paiement flexible
                    </h3>
                    <p className="text-xs text-gray-600">
                      CB, PayPal, virement
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Spacer for MobileBottomBar */}
        <MobileBottomBarSpacer />
      </div>

      {/* Mobile Bottom Bar - CTA Commander */}
      <MobileBottomBar>
        <Link
          to="/checkout"
          className="flex-1 py-3 px-4 bg-orange-500 hover:bg-orange-600 rounded-xl flex items-center justify-center gap-2 touch-target"
        >
          <span className="text-white font-bold">
            Commander ({cart.summary.total_items})
          </span>
          <ArrowRight className="h-5 w-5 text-white" />
        </Link>
      </MobileBottomBar>
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
