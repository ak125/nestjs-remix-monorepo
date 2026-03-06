/**
 * CART PAGE - Route principale du panier
 *
 * - useFetcher pour update/remove/clear (via api.cart action)
 * - Types CartItem/CartSummary depuis ~/types/cart
 * - Per-item fetchers (pas de global isProcessing)
 * - Debounce 300ms sur quantite +/-
 * - Inline confirmation pour vider le panier
 */

import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useNavigation,
  useFetcher,
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
import { useEffect, useState, useRef, useCallback } from "react";
import { CheckoutStepper } from "~/components/checkout/CheckoutStepper";
import { Error404 } from "~/components/errors/Error404";
import Container from "~/components/layout/Container";

import {
  MobileBottomBar,
  MobileBottomBarSpacer,
} from "~/components/layout/MobileBottomBar";
import { Alert } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import {
  type CartItem as CartItemType,
  type CartSummary as CartSummaryType,
} from "~/types/cart";
import { trackViewCart } from "~/utils/analytics";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { getCart } from "../services/cart.server";

export const handle = {
  hideGlobalFooter: true,
  pageRole: createPageRoleMeta(PageRole.R2_PRODUCT, {
    clusterId: "cart",
    canonicalEntity: "panier",
    funnelStage: "decision",
    conversionGoal: "purchase",
  }),
};

export const meta: MetaFunction = () => [
  { title: "Mon panier | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/cart",
  },
];

const FREE_SHIPPING_THRESHOLD = 150;

export const loader = async ({ request }: LoaderFunctionArgs) => {
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
  } catch {
    return json({
      cart: {
        items: [],
        summary: {
          total_items: 0,
          total_price: 0,
          subtotal: 0,
          tax_amount: 0,
          shipping_cost: 0,
          consigne_total: 0,
          currency: "EUR",
        },
      },
      success: false,
      error: "Erreur lors du chargement du panier",
      cleared: false,
    });
  }
};

const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:3000";

export async function action({ request }: ActionFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "update") {
      const productId = formData.get("productId") as string;
      const quantity = parseInt(formData.get("quantity") as string, 10);

      const response = await fetch(`${API_BASE}/api/cart/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          product_id: parseInt(productId, 10),
          quantity,
          replace: true,
        }),
      });

      const data = await response.json();
      return json(data);
    }

    if (intent === "remove") {
      const productId = formData.get("productId") as string;

      const response = await fetch(`${API_BASE}/api/cart/items/${productId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Cookie: cookie },
      });

      const data = await response.json();
      return json(data);
    }

    if (intent === "clear") {
      const response = await fetch(`${API_BASE}/api/cart`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Cookie: cookie },
      });

      const data = await response.json();
      return json(data);
    }

    logger.error("[Cart Action] Intent inconnu:", intent);
    return json({ error: "Intent inconnu", intent }, { status: 400 });
  } catch (error) {
    logger.error("[Cart Action] Erreur:", error);
    return json(
      { error: "Erreur serveur", details: String(error) },
      { status: 500 },
    );
  }
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

function FreeShippingProgress({ subtotal }: { subtotal: number }) {
  const progress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const remaining = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
  const isEligible = subtotal >= FREE_SHIPPING_THRESHOLD;
  const isCompact = subtotal < 60;

  if (isEligible) {
    return (
      <div className="rounded-xl p-3 sm:p-4 mb-4 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white shadow-md">
        <div className="flex items-center gap-3">
          <Truck className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
          <p className="font-bold text-sm sm:text-base flex-1">
            Livraison OFFERTE
          </p>
          <Badge
            variant="secondary"
            size="sm"
            className="bg-white/20 text-white border-0 text-xs"
          >
            0,00&nbsp;€
          </Badge>
        </div>
      </div>
    );
  }

  if (isCompact) {
    return (
      <div className="rounded-xl p-3 mb-4 bg-white border border-slate-200">
        <div className="flex items-center gap-2 mb-2">
          <Truck className="h-4 w-4 text-cta flex-shrink-0" />
          <p className="text-sm text-gray-700">
            Plus que{" "}
            <strong className="text-cta">{formatPrice(remaining)}</strong> pour
            livraison offerte
          </p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-cta rounded-full h-1.5 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  const getMessage = () => {
    if (progress >= 90) return "Vous y \u00eates presque !";
    if (progress >= 70) return "Encore un petit effort !";
    return "Vous \u00eates \u00e0 mi-chemin !";
  };

  return (
    <div className="rounded-xl p-4 mb-4 bg-white border-2 border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-cta" />
          <p className="text-sm font-semibold text-gray-900">
            Livraison gratuite d\u00e8s {formatPrice(FREE_SHIPPING_THRESHOLD)}
          </p>
        </div>
        <span className="text-xs text-gray-500">{getMessage()}</span>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3">
        <div
          className="bg-gradient-to-r from-cta to-emerald-500 rounded-full h-2.5 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-sm text-center text-gray-600">
        Plus que{" "}
        <span className="font-bold text-cta">{formatPrice(remaining)}</span>{" "}
        pour d\u00e9bloquer la livraison gratuite
      </p>
    </div>
  );
}

function CartSummaryBlock({
  summary,
  children,
  isUpdating,
}: {
  summary: CartSummaryType;
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
  const isLite =
    summary.total_items <= 3 &&
    !(summary.consigne_total > 0) &&
    !(summary.discount_amount && summary.discount_amount > 0);

  return (
    <div
      className={`bg-white border-2 border-gray-200 rounded-2xl shadow-xl overflow-hidden transition-all ${
        isUpdating ? "opacity-50 scale-[0.98]" : "hover:shadow-2xl"
      }`}
    >
      <div className="bg-navy text-white px-4 sm:px-6 py-3 sm:py-4">
        <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
          <Package className="h-5 w-5" />
          R\u00e9sum\u00e9 de la commande
          {isUpdating && (
            <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full ml-auto"></div>
          )}
        </h2>
      </div>

      <div className="p-4 sm:p-6 space-y-3">
        {!isLite && (
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-semibold text-gray-700 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-navy" />
              Articles
            </span>
            <Badge variant="info" size="sm" className="text-sm px-3 py-0.5">
              {summary.total_items}
            </Badge>
          </div>
        )}

        <div className="flex justify-between items-center py-3 border-b border-gray-100">
          <span className="text-gray-600">Sous-total produits</span>
          <span className="font-semibold text-lg">
            {formatPrice(summary.subtotal)}
          </span>
        </div>

        {(summary.consigne_total ?? 0) > 0 && (
          <div className="flex justify-between items-center p-3 bg-amber-50 rounded-xl border-2 border-amber-200">
            <span className="text-amber-800 font-medium flex items-center gap-2">
              <span className="text-xl">&#9851;</span>
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

        {isEligibleFreeShipping && (
          <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl border-2 border-green-200">
            <span className="text-green-700 font-medium flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Livraison
            </span>
            <span className="font-bold text-green-600 flex items-center gap-1">
              OFFERTE
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

        {(summary.discount_amount ?? 0) > 0 && (
          <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl border-2 border-green-200">
            <span className="text-green-700 font-medium flex items-center gap-2">
              <span className="text-xl">&#127873;</span>
              Remise appliqu\u00e9e
            </span>
            <span className="font-bold text-green-700">
              -{formatPrice(summary.discount_amount!)}
            </span>
          </div>
        )}

        <div className="mt-4 pt-4 border-t-2 border-gray-200">
          <div className="flex justify-between items-center p-5 bg-cta rounded-xl shadow-lg">
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

function CartItemRow({ item }: { item: CartItemType }) {
  const updateFetcher = useFetcher();
  const removeFetcher = useFetcher();
  const [currentQuantity, setCurrentQuantity] = useState(item.quantity);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isUpdating = updateFetcher.state !== "idle";
  const isRemoving = removeFetcher.state !== "idle";

  // Sync cart:updated when fetcher completes
  useEffect(() => {
    if (updateFetcher.state === "idle" && updateFetcher.data) {
      window.dispatchEvent(new Event("cart:updated"));
    }
  }, [updateFetcher.state, updateFetcher.data]);

  useEffect(() => {
    if (removeFetcher.state === "idle" && removeFetcher.data) {
      window.dispatchEvent(new Event("cart:updated"));
    }
  }, [removeFetcher.state, removeFetcher.data]);

  const handleQuantityChange = useCallback(
    (newQuantity: number) => {
      if (newQuantity < 1 || newQuantity === currentQuantity) return;

      setCurrentQuantity(newQuantity);

      // Debounce 300ms
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateFetcher.submit(
          {
            intent: "update",
            productId: String(item.product_id),
            quantity: String(newQuantity),
          },
          { method: "post" },
        );
      }, 300);
    },
    [currentQuantity, item.product_id, updateFetcher],
  );

  const handleRemove = useCallback(() => {
    removeFetcher.submit(
      {
        intent: "remove",
        productId: String(item.product_id),
      },
      { method: "post" },
    );
  }, [item.product_id, removeFetcher]);

  // Price calculation: prefer explicit fields, fallback to price as unit
  const unitPrice = Number(item.unit_price ?? item.price ?? 0);
  const totalPrice = Number(item.total_price ?? unitPrice * currentQuantity);

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm transition-all duration-300 overflow-hidden ${
        isUpdating || isRemoving
          ? "opacity-50 pointer-events-none"
          : "hover:shadow-md hover:border-blue-200"
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-lg leading-tight truncate">
              {item.product_name || item.name || "Produit sans nom"}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">
                R\u00e9f: {item.product_sku || item.product_id}
              </span>
              {item.product_brand &&
                item.product_brand !== "MARQUE INCONNUE" &&
                item.product_brand !== "Non sp\u00e9cifi\u00e9e" && (
                  <Badge variant="secondary" size="sm">
                    {item.product_brand}
                  </Badge>
                )}
              {item.has_consigne && (item.consigne_unit ?? 0) > 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                  +{formatPrice(item.consigne_unit!)} consigne
                </span>
              )}
            </div>
          </div>

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

        <div className="flex items-center justify-between gap-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden md:inline">
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

          <div className="text-right">
            <div className="text-2xl font-bold text-navy">
              {formatPrice(totalPrice)}
            </div>
            {currentQuantity > 1 && (
              <div className="text-xs text-gray-500">
                {currentQuantity} x {formatPrice(unitPrice)}
              </div>
            )}
          </div>
        </div>

        {(isUpdating || isRemoving) && (
          <div className="mt-3 flex items-center justify-center gap-2 text-cta text-sm">
            <div className="animate-spin w-4 h-4 border-2 border-cta border-t-transparent rounded-full"></div>
            <span>{isUpdating ? "Mise \u00e0 jour..." : "Suppression..."}</span>
          </div>
        )}
      </div>
    </div>
  );
}

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
          D\u00e9couvrez nos pi\u00e8ces auto et ajoutez-les \u00e0 votre panier
        </p>

        <Button asChild size="lg" variant="blue" className="w-full sm:w-auto">
          <Link to="/" className="inline-flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            D\u00e9couvrir nos produits
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function CartPage() {
  const { cart, success, error, cleared } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const clearFetcher = useFetcher();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const isClearPending = clearFetcher.state !== "idle";

  // GA4: track view_cart once on mount
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

  // Sync navbar after clear cart completes
  useEffect(() => {
    if (clearFetcher.state === "idle" && clearFetcher.data) {
      window.dispatchEvent(new Event("cart:updated"));
      setShowClearConfirm(false);
    }
  }, [clearFetcher.state, clearFetcher.data]);

  const handleClearCart = () => {
    clearFetcher.submit({ intent: "clear" }, { method: "post" });
  };

  if (!success || error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <Container>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">&#9888;</div>
            <h2 className="text-xl font-semibold mb-2">Erreur de chargement</h2>
            <p className="text-gray-600 mb-6">
              {error || "Une erreur est survenue"}
            </p>
            <Button
              className="inline-block px-6 py-3 rounded-lg"
              variant="blue"
              asChild
            >
              <Link to="/">Retour \u00e0 l'accueil</Link>
            </Button>
          </div>
        </Container>
      </div>
    );
  }

  if (!cart.items || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <Container>
          <EmptyCart />
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-6 sm:py-8">
      <Container>
        <PublicBreadcrumb
          items={[{ label: "Panier" }]}
          className="hidden sm:block"
        />

        <CheckoutStepper current="cart" />

        {cleared && (
          <Alert
            intent="success"
            variant="solid"
            icon={<span className="text-lg">&#10004;</span>}
            className="mb-4"
          >
            Panier vid\u00e9 avec succ\u00e8s !
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-cta p-3 rounded-xl">
              <ShoppingBag className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Mon Panier
              </h1>
              <p className="text-gray-600">
                {cart.summary.total_items} article
                {cart.summary.total_items > 1 ? "s" : ""} &bull;{" "}
                {formatPrice(cart.summary.subtotal)}
              </p>
            </div>
          </div>
        </div>

        <FreeShippingProgress subtotal={cart.summary.subtotal} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cart.items.map((item) => (
              <CartItemRow key={item.id} item={item as CartItemType} />
            ))}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-4 border-t border-gray-200">
              <Button variant="outline" asChild className="gap-2">
                <Link to="/">
                  <ChevronLeft className="h-4 w-4" />
                  Continuer mes achats
                </Link>
              </Button>

              {!showClearConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={isClearPending}
                  className="inline-flex items-center gap-1.5 text-gray-500 hover:text-red-600 text-sm transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="underline-offset-2 hover:underline">
                    Vider le panier
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                  <span className="text-sm text-red-700">
                    Supprimer {cart.summary.total_items} article
                    {cart.summary.total_items > 1 ? "s" : ""} ?
                  </span>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isClearPending}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleClearCart}
                    disabled={isClearPending}
                    className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50"
                  >
                    {isClearPending ? "Vidage..." : "Confirmer"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 space-y-4">
              <CartSummaryBlock
                summary={cart.summary as CartSummaryType}
                isUpdating={navigation.state === "loading"}
              >
                <div className="space-y-3">
                  <Link
                    to="/checkout"
                    className="w-full py-4 px-6 bg-cta hover:bg-cta-hover rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-3"
                  >
                    <span className="text-white text-lg">&#128722;</span>
                    <span className="text-white font-bold text-lg">
                      Finaliser ma commande
                    </span>
                    <ArrowRight className="h-5 w-5 text-white" />
                  </Link>
                </div>
              </CartSummaryBlock>

              <div className="bg-white rounded-xl border p-3 flex items-center justify-around text-xs text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="hidden sm:inline">Paiement </span>
                  s\u00e9curis\u00e9
                </span>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-blue-600" />
                  24-48h
                </span>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-purple-600" />
                  CB / PayPal
                </span>
              </div>
            </div>
          </div>
        </div>

        <MobileBottomBarSpacer />
      </Container>

      <MobileBottomBar>
        <Link
          to="/checkout"
          className="flex-1 py-3 px-4 bg-cta hover:bg-cta-hover rounded-xl flex items-center justify-center gap-2 touch-target"
        >
          <span className="text-white font-bold">
            Commander &middot;{" "}
            {formatPrice(cart.summary.total_price || cart.summary.subtotal)}
          </span>
          <ArrowRight className="h-5 w-5 text-white" />
        </Link>
      </MobileBottomBar>

      {/* Mini footer transactionnel (le mega footer est masqué via hideGlobalFooter) */}
      <div className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-500">
        <Container>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link to="/cgv" className="hover:text-gray-700 hover:underline">
              CGV
            </Link>
            <span>&middot;</span>
            <Link
              to="/confidentialite"
              className="hover:text-gray-700 hover:underline"
            >
              Confidentialité
            </Link>
            <span>&middot;</span>
            <Link
              to="/mentions-legales"
              className="hover:text-gray-700 hover:underline"
            >
              Mentions légales
            </Link>
            <span>&middot;</span>
            <Link to="/contact" className="hover:text-gray-700 hover:underline">
              Contact
            </Link>
          </div>
        </Container>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
