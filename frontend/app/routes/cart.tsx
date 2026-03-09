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
  Link,
  isRouteErrorResponse,
  useFetcher,
  useFetchers,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import {
  ArrowRight,
  Car,
  ChevronLeft,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { formatPrice } from "~/components/cart/cart-utils";
import {
  CartCrossSell,
  type CrossSellGamme,
} from "~/components/cart/CartCrossSell";
import { CartItemRow } from "~/components/cart/CartItemRow";
import { CartSummaryBlock } from "~/components/cart/CartSummaryBlock";
import { EmptyCart } from "~/components/cart/EmptyCart";
import { FreeShippingProgress } from "~/components/cart/FreeShippingProgress";
import { CheckoutStepper } from "~/components/checkout/CheckoutStepper";
import { Error404 } from "~/components/errors/Error404";
import Container from "~/components/layout/Container";
import {
  MobileBottomBar,
  MobileBottomBarSpacer,
} from "~/components/layout/MobileBottomBar";
import { Button } from "~/components/ui/button";
import {
  cartActionSchema,
  type CartItem as CartItemType,
  type CartSummary as CartSummaryType,
} from "~/schemas/cart.schemas";
import { trackViewCart } from "~/utils/analytics";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import {
  getVehicleFromCookie,
  getVehicleBreadcrumbData,
  type VehicleCookie,
} from "~/utils/vehicle-cookie";
import {
  clearCart,
  getCart,
  removeFromCart,
  updateQuantity,
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const vehicle = await getVehicleFromCookie(request.headers.get("Cookie"));

  try {
    const cartData = await getCart(request);

    // Shadow validation Zod (log sans bloquer)
    const { cartSchema } = await import("~/schemas/cart.schemas");
    const validation = cartSchema.safeParse(cartData);
    if (!validation.success) {
      logger.warn(
        "[Cart Loader] Validation Zod echouee:",
        validation.error.flatten(),
      );
    }

    // Derive dominant type_id from cart items (priorite sur cookie)
    const typeIdCounts = new Map<number, number>();
    for (const item of cartData.items) {
      if (item.type_id) {
        typeIdCounts.set(
          item.type_id,
          (typeIdCounts.get(item.type_id) || 0) + (item.quantity || 1),
        );
      }
    }
    let cartTypeId: number | null = null;
    let maxCount = 0;
    for (const [tid, count] of typeIdCounts) {
      if (count > maxCount) {
        maxCount = count;
        cartTypeId = tid;
      }
    }
    const crossSellTypeId = cartTypeId || vehicle?.type_id;

    // Cross-sell : fetch en parallele (non-bloquant)
    let crossSellGammes: CrossSellGamme[] = [];
    const firstPgId = cartData.items.find((i) => i.pg_id)?.pg_id;
    if (crossSellTypeId && firstPgId) {
      try {
        const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
        const res = await fetch(
          `${backendUrl}/api/cross-selling/v5/${crossSellTypeId}/${firstPgId}`,
          { headers: { "User-Agent": "RemixCartLoader/1.0" } },
        );
        if (res.ok) {
          const data = (await res.json()) as {
            data?: { cross_gammes?: CrossSellGamme[] };
          };
          crossSellGammes = (data.data?.cross_gammes ?? []).slice(0, 4);
        }
      } catch {
        // Cross-sell failure is non-critical
      }
    }

    // Vehicle display: use cookie if cart type_id matches, or if no cart type_id (backwards compat)
    // Only hide vehicle if cart has type_ids but they don't match the cookie
    const effectiveVehicle =
      cartTypeId && vehicle && cartTypeId !== vehicle.type_id ? null : vehicle;

    return json({
      cart: cartData,
      vehicle: effectiveVehicle,
      crossSellGammes,
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
      vehicle,
      crossSellGammes: [] as CrossSellGamme[],
      success: false,
      error: "Erreur lors du chargement du panier",
    });
  }
};

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

export default function CartPage() {
  const { cart, vehicle, crossSellGammes, success, error } =
    useLoaderData<typeof loader>();
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
              <Link to="/">Retour à l'accueil</Link>
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
          <EmptyCart vehicle={vehicle as VehicleCookie | null} />
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-slate-100 py-4 sm:py-6">
      <Container>
        <CheckoutStepper current="cart" />

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-cta p-3 rounded-xl">
              <ShoppingBag className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Mon panier
              </h1>
              <p className="text-slate-600">
                {cart.items.length} référence
                {cart.items.length > 1 ? "s" : ""} · {cart.summary.total_items}{" "}
                unité
                {cart.summary.total_items > 1 ? "s" : ""}{" "}
                {cart.summary.total_items > 1
                  ? "prêtes à être commandées"
                  : "prête à être commandée"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <FreeShippingProgress subtotal={cart.summary.subtotal} />

            {cart.items.map((item) => (
              <CartItemRow key={item.id} item={item as CartItemType} />
            ))}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-4 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" asChild className="gap-2">
                  <Link to="/">
                    <ChevronLeft className="h-4 w-4" />
                    Continuer mes achats
                  </Link>
                </Button>
                {vehicle && (
                  <Button
                    variant="ghost"
                    asChild
                    className="gap-2 text-slate-500"
                  >
                    <Link
                      to={
                        getVehicleBreadcrumbData(vehicle as VehicleCookie).href
                      }
                    >
                      <Car className="h-4 w-4" />
                      Voir d'autres pièces compatibles pour mon{" "}
                      {(vehicle as VehicleCookie).marque_name}{" "}
                      {(vehicle as VehicleCookie).modele_name}
                    </Link>
                  </Button>
                )}
              </div>

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

            <CartCrossSell
              gammes={crossSellGammes as CrossSellGamme[]}
              vehicle={vehicle as VehicleCookie | null}
            />
          </div>

          <div>
            <div className="lg:sticky lg:top-24">
              <CartSummaryBlock
                summary={cart.summary as CartSummaryType}
                isUpdating={isAnyMutating}
                checkoutDisabled={isAnyMutating}
              />
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
            {cart.summary.total_items} article
            {cart.summary.total_items > 1 ? "s" : ""} &middot;{" "}
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
