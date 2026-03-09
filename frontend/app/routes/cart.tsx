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
  useFetcher,
  useFetchers,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  ShoppingBag,
  Truck,
  Shield,
  RotateCcw,
  Package,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ChevronLeft,
} from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { z } from "zod";
import { CheckoutStepper } from "~/components/checkout/CheckoutStepper";
import { Error404 } from "~/components/errors/Error404";
import Container from "~/components/layout/Container";

import {
  MobileBottomBar,
  MobileBottomBarSpacer,
} from "~/components/layout/MobileBottomBar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  type CartItem as CartItemType,
  type CartSummary as CartSummaryType,
} from "~/types/cart";
import { trackViewCart } from "~/utils/analytics";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import {
  getCart,
  updateQuantity,
  removeFromCart,
  clearCart,
} from "../services/cart.server";

export const handle = {
  hideGlobalFooter: true,
  pageRole: createPageRoleMeta(PageRole.RX_CHECKOUT, {
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
    const cartData = await getCart(request);
    return json({
      cart: cartData,
      success: true,
      error: null,
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
    });
  }
};

const cartActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("update"),
    productId: z.string().min(1),
    quantity: z.coerce.number().int().min(1).max(99),
  }),
  z.object({
    intent: z.literal("remove"),
    productId: z.string().min(1),
  }),
  z.object({
    intent: z.literal("clear"),
  }),
]);

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const parsed = cartActionSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return json(
      {
        success: false,
        error: "Donnees invalides",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  try {
    switch (input.intent) {
      case "update":
        return json(
          await updateQuantity(request, input.productId, input.quantity),
        );
      case "remove":
        return json(await removeFromCart(request, input.productId));
      case "clear":
        return json(await clearCart(request));
    }
  } catch (error) {
    logger.error("[Cart Action] Erreur:", error);
    return json(
      { success: false, error: "Erreur serveur panier" },
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
            0,00&nbsp;\u20ac
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-4 mb-4 bg-white border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-cta" />
          <p className="text-sm font-semibold text-slate-900">
            Livraison offerte d\u00e8s {formatPrice(FREE_SHIPPING_THRESHOLD)}
          </p>
        </div>
        {progress >= 70 && (
          <span className="text-xs text-cta font-medium">
            {progress >= 90 ? "Presque !" : "Encore un peu !"}
          </span>
        )}
      </div>

      <div className="w-full bg-slate-100 rounded-full h-2 mb-2.5">
        <div
          className="bg-gradient-to-r from-cta to-emerald-500 rounded-full h-2 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-sm text-slate-600">
        Ajoutez encore{" "}
        <span className="font-bold text-cta">{formatPrice(remaining)}</span>{" "}
        pour en profiter
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
      className={`bg-white border-2 border-slate-200 rounded-2xl shadow-xl overflow-hidden transition-all ${
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
            <span className="font-semibold text-slate-700 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-navy" />
              Articles
            </span>
            <Badge variant="info" size="sm" className="text-sm px-3 py-0.5">
              {summary.total_items}
            </Badge>
          </div>
        )}

        <div className="flex justify-between items-center py-3 border-b border-slate-100">
          <span className="text-slate-600">Sous-total produits</span>
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

        <div className="flex justify-between items-center py-3 border-b border-slate-100">
          <span className="text-slate-600 flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Livraison
          </span>
          {isEligibleFreeShipping ? (
            <span className="font-bold text-green-600">OFFERTE</span>
          ) : summary.shipping_cost > 0 ? (
            <span className="font-medium">
              {formatPrice(summary.shipping_cost)}
            </span>
          ) : (
            <span className="text-sm text-slate-400 italic">
              Calcul\u00e9e \u00e0 l'\u00e9tape suivante
            </span>
          )}
        </div>

        {summary.tax_amount > 0 && (
          <div className="flex justify-between py-3 border-b border-slate-100">
            <span className="text-slate-600">TVA incluse</span>
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

        <div className="mt-4 pt-4 border-t-2 border-slate-200">
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

const MAX_CART_QUANTITY = 99;

function CartItemRow({ item }: { item: CartItemType }) {
  const updateFetcher = useFetcher();
  const removeFetcher = useFetcher();
  const [currentQuantity, setCurrentQuantity] = useState(item.quantity);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmedQuantityRef = useRef(item.quantity);

  const isUpdating = updateFetcher.state !== "idle";
  const isRemoving = removeFetcher.state !== "idle";

  // Sync local quantity with server truth on revalidation
  useEffect(() => {
    setCurrentQuantity(item.quantity);
    confirmedQuantityRef.current = item.quantity;
  }, [item.quantity]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Rollback on error, sync navbar on success
  useEffect(() => {
    if (updateFetcher.state === "idle" && updateFetcher.data) {
      const data = updateFetcher.data as { success?: boolean; error?: string };
      if (data.error || data.success === false) {
        setCurrentQuantity(confirmedQuantityRef.current);
      }
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
      if (
        newQuantity < 1 ||
        newQuantity > MAX_CART_QUANTITY ||
        newQuantity === currentQuantity
      )
        return;

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
          : "hover:shadow-md hover:border-slate-300"
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-20 h-20 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden">
            {item.product_image &&
            item.product_image !== "/images/categories/default.svg" ? (
              <img
                src={item.product_image}
                alt={item.product_name || "Produit"}
                className="w-full h-full object-contain p-1"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-8 w-8 text-slate-300" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-base sm:text-lg leading-tight truncate">
              {item.product_name || item.name || "Produit sans nom"}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
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
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
              aria-label="Supprimer cet article"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-3 py-2 min-h-[44px] text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleRemove}
                disabled={isRemoving}
                className="px-3 py-2 min-h-[44px] text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isRemoving ? "..." : "Confirmer"}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden md:inline">
              Quantité:
            </span>
            <div className="flex items-center border rounded-lg overflow-hidden bg-slate-50">
              <button
                onClick={() => handleQuantityChange(currentQuantity - 1)}
                disabled={isUpdating || isRemoving || currentQuantity <= 1}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Diminuer la quantité"
              >
                <Minus className="h-4 w-4 text-slate-600" />
              </button>
              <span className="px-4 py-2 font-bold text-lg bg-white min-w-[50px] text-center border-x">
                {currentQuantity}
              </span>
              <button
                onClick={() => handleQuantityChange(currentQuantity + 1)}
                disabled={
                  isUpdating ||
                  isRemoving ||
                  currentQuantity >= MAX_CART_QUANTITY
                }
                className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Augmenter la quantité"
              >
                <Plus className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-navy">
              {formatPrice(totalPrice)}
            </div>
            <div className="text-xs text-slate-500">
              {currentQuantity > 1
                ? `${currentQuantity} x ${formatPrice(unitPrice)}`
                : `Prix unitaire : ${formatPrice(unitPrice)}`}
            </div>
          </div>
        </div>

        {(isUpdating || isRemoving) && (
          <div className="mt-3 flex items-center justify-center gap-2 text-cta text-sm">
            <div className="animate-spin w-4 h-4 border-2 border-cta border-t-transparent rounded-full"></div>
            <span>{isUpdating ? "Mise \u00e0 jour..." : "Suppression..."}</span>
          </div>
        )}

        {updateFetcher.state === "idle" &&
          (updateFetcher.data as { error?: string } | undefined)?.error && (
            <p className="mt-2 text-sm text-red-600 bg-red-50 rounded px-3 py-1.5">
              {(updateFetcher.data as { error: string }).error}
            </p>
          )}
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="min-h-[60dvh] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 sm:p-12 max-w-lg mx-auto shadow-xl border text-center">
        <div className="bg-slate-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="h-12 w-12 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold mb-3 text-slate-800">
          Votre panier est vide
        </h2>
        <p className="text-slate-600 mb-8">
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
  const { cart, success, error } = useLoaderData<typeof loader>();
  const clearFetcher = useFetcher();
  const fetchers = useFetchers();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const isClearPending = clearFetcher.state !== "idle";
  const isAnyMutating = fetchers.some(
    (f) => f.state !== "idle" && f.formData?.get("intent"),
  );

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
      <div className="min-h-[100dvh] bg-slate-50 py-8">
        <Container>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">&#9888;</div>
            <h2 className="text-xl font-semibold mb-2">Erreur de chargement</h2>
            <p className="text-slate-600 mb-6">
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
      <div className="min-h-[100dvh] bg-slate-50 py-8">
        <Container>
          <EmptyCart />
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-slate-100 py-6 sm:py-8">
      <Container>
        <CheckoutStepper current="cart" />

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-cta p-3 rounded-xl">
              <ShoppingBag className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Mon Panier
              </h1>
              <p className="text-slate-600">
                {cart.summary.total_items} article
                {cart.summary.total_items > 1 ? "s" : ""}{" "}
                {cart.summary.total_items > 1 ? "prêts" : "prêt"} à être
                commandé{cart.summary.total_items > 1 ? "s" : ""}
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

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-4 border-t border-slate-200">
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
                  className="inline-flex items-center gap-1.5 min-h-[44px] text-slate-500 hover:text-red-600 text-sm transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
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
                    className="px-3 py-2 min-h-[44px] text-sm bg-white border border-slate-300 hover:bg-slate-50 rounded transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleClearCart}
                    disabled={isClearPending}
                    className="px-3 py-2 min-h-[44px] text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50"
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
                isUpdating={isAnyMutating}
              >
                <div className="space-y-3">
                  <Link
                    to="/checkout"
                    aria-disabled={isAnyMutating}
                    className={`w-full py-4 px-6 bg-cta hover:bg-cta-hover rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-3 ${isAnyMutating ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <span className="text-white font-bold text-lg">
                      Passer commande
                    </span>
                    <ArrowRight className="h-5 w-5 text-white" />
                  </Link>
                  <p className="text-xs text-center text-slate-500 mt-2">
                    Paiement sécurisé · Expédition 24-48h · Retours 30 jours
                  </p>
                </div>
              </CartSummaryBlock>

              <div className="bg-white rounded-xl border p-4 grid grid-cols-3 gap-3 text-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-xs font-medium text-slate-700 leading-tight">
                    Paiement 100% s\u00e9curis\u00e9
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
                    <Truck className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-xs font-medium text-slate-700 leading-tight">
                    Exp\u00e9dition 24-48h
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center">
                    <RotateCcw className="h-4 w-4 text-amber-600" />
                  </div>
                  <span className="text-xs font-medium text-slate-700 leading-tight">
                    Retours 30 jours
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <MobileBottomBarSpacer />
      </Container>

      <MobileBottomBar>
        <Link
          to="/checkout"
          aria-disabled={isAnyMutating}
          className={`flex-1 py-3 px-4 bg-cta hover:bg-cta-hover rounded-xl flex items-center justify-center gap-2 touch-target ${isAnyMutating ? "pointer-events-none opacity-50" : ""}`}
        >
          <span className="text-white font-bold">
            Commander &middot;{" "}
            {formatPrice(cart.summary.total_price || cart.summary.subtotal)}
          </span>
          <ArrowRight className="h-5 w-5 text-white" />
        </Link>
      </MobileBottomBar>

      {/* Mini footer transactionnel (le mega footer est masqué via hideGlobalFooter) */}
      <div className="border-t border-slate-100 bg-slate-50/50 py-3 text-center text-[11px] text-slate-400">
        <Container>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link to="/cgv" className="hover:text-slate-700 hover:underline">
              CGV
            </Link>
            <span>&middot;</span>
            <Link
              to="/confidentialite"
              className="hover:text-slate-700 hover:underline"
            >
              Confidentialité
            </Link>
            <span>&middot;</span>
            <Link
              to="/mentions-legales"
              className="hover:text-slate-700 hover:underline"
            >
              Mentions légales
            </Link>
            <span>&middot;</span>
            <Link
              to="/contact"
              className="hover:text-slate-700 hover:underline"
            >
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
