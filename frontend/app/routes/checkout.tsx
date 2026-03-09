/**
 * CHECKOUT PAGE — One-page accordion (Livraison + Paiement)
 * Fusionne l'ancien checkout.tsx + checkout-payment.tsx
 * Flow: /cart → /checkout → Paybox (2 etapes au lieu de 4)
 */

import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Form,
  useLoaderData,
  useNavigation,
  useActionData,
  useSubmit,
  Link,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CartVehicleBanner } from "~/components/cart/CartVehicleBanner";
import {
  CheckoutLivraisonSection,
  type ShippingAddress,
} from "~/components/checkout/CheckoutLivraisonSection";
import { CheckoutOrderSummary } from "~/components/checkout/CheckoutOrderSummary";
import { CheckoutPaiementSection } from "~/components/checkout/CheckoutPaiementSection";
import { CheckoutStepper } from "~/components/checkout/CheckoutStepper";
import { Error404 } from "~/components/errors/Error404";
import {
  MobileBottomBar,
  MobileBottomBarSpacer,
} from "~/components/layout/MobileBottomBar";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import {
  type CartItem as CartItemType,
  type CartSummary as CartSummaryType,
} from "~/schemas/cart.schemas";
import {
  type CheckoutActionError,
  type CheckoutFieldErrors,
  type CheckoutUserProfile,
  parseCheckoutFormData,
} from "~/schemas/checkout.schemas";
import {
  buildOrderLines,
  buildPayboxRedirectUrl,
  createCheckoutOrder,
  getOrderForPayment,
} from "~/services/order.server";
import { getUserProfile } from "~/services/profile.server";
import { type PaymentMethod } from "~/types/payment";
import { trackBeginCheckout, trackAddPaymentInfo } from "~/utils/analytics";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import {
  getVehicleFromCookie,
  type VehicleCookie,
} from "~/utils/vehicle-cookie";
import { getOptionalUser } from "../auth/unified.server";
import { getCart } from "../services/cart.server";
import { getAvailablePaymentMethods } from "../services/payment.server";

export const handle = {
  hideGlobalFooter: true,
  pageRole: createPageRoleMeta(PageRole.RX_CHECKOUT, {
    clusterId: "checkout",
    canonicalEntity: "finalisation",
    funnelStage: "decision",
    conversionGoal: "purchase",
  }),
};

export const meta: MetaFunction = () => [
  { title: "Finalisation de commande | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/checkout",
  },
];

// -- Loader ------------------------------------------------------------------

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const user = await getOptionalUser({ context });
  const userId = user?.id || null;
  const vehicle = await getVehicleFromCookie(request.headers.get("Cookie"));

  logger.log("[Checkout] Loader - User:", userId || "guest");

  try {
    const cart = await getCart(request, context);

    if (!cart || !cart.items) {
      return json({
        cart: null,
        error: "Erreur de structure du panier. Veuillez recharger.",
      });
    }

    const itemsCount = Array.isArray(cart.items) ? cart.items.length : 0;
    const totalItems = cart?.summary?.total_items || 0;

    if (itemsCount === 0 && totalItems === 0) {
      return json({
        cart: null,
        error:
          "Votre panier est vide. Ajoutez des articles avant de passer commande.",
      });
    }

    // Profil utilisateur (adresse pre-remplie)
    const userProfile: CheckoutUserProfile | null = user
      ? await getUserProfile(request)
      : null;

    // Payment methods (merged from checkout-payment)
    const paymentMethods = await getAvailablePaymentMethods();

    return json({ cart, user, userProfile, paymentMethods, vehicle });
  } catch (error) {
    logger.error("[Checkout] Erreur chargement:", error);
    return json({
      cart: null,
      error: "Erreur lors du chargement du panier. Veuillez reessayer.",
    });
  }
};

// -- Action ------------------------------------------------------------------

export async function action({ request, context }: ActionFunctionArgs) {
  logger.log("[Checkout] Action Start");

  try {
    // 1. Parse + validate with Zod (single schema, structured errors)
    const formData = await request.formData();
    const parsed = parseCheckoutFormData(formData);

    if (!parsed.success) {
      return json(
        {
          ok: false,
          error: "Veuillez corriger les informations du formulaire.",
          code: "VALIDATION_ERROR",
          fieldErrors: parsed.fieldErrors,
        } satisfies CheckoutActionError,
        { status: 400 },
      );
    }

    const {
      guestEmail,
      firstName,
      lastName,
      address,
      zipCode,
      city,
      civility,
      country,
      phone,
      paymentMethod,
    } = parsed.data;

    const isGuest = !!guestEmail;

    // 2. Client connecte sans adresse complete → completer avec le profil
    let finalFirstName = firstName;
    let finalLastName = lastName;
    let finalAddress = address;
    let finalZipCode = zipCode;
    let finalCity = city;

    if (!isGuest && !address) {
      const profile = await getUserProfile(request);
      if (profile) {
        finalFirstName = finalFirstName || profile.firstName;
        finalLastName = finalLastName || profile.lastName;
        finalAddress = profile.address;
        finalZipCode = finalZipCode || profile.zipCode;
        finalCity = finalCity || profile.city;
      }
    }

    // 3. Recuperer le panier via service
    const cartData = await getCart(request);

    if (!cartData.items || cartData.items.length === 0) {
      return json(
        {
          ok: false,
          error: "Votre panier est vide.",
          code: "EMPTY_CART",
        } satisfies CheckoutActionError,
        { status: 400 },
      );
    }

    // 4. Transformer les items en lignes de commande
    const orderLines = buildOrderLines(cartData.items);

    // 5. Creer la commande via service
    const addressData = {
      civility,
      firstName: finalFirstName,
      lastName: finalLastName,
      address: finalAddress,
      phone: phone || "",
      zipCode: finalZipCode,
      city: finalCity,
      country,
    };

    const orderResult = await createCheckoutOrder(request, {
      customerId: cartData.metadata?.user_id ?? undefined,
      guestEmail: isGuest ? guestEmail : undefined,
      orderLines,
      billingAddress: addressData,
      shippingAddress: addressData,
      customerNote: "",
      shippingMethod: "standard",
      paymentMethod,
    });

    if (!orderResult.success) {
      // Handle redirect (auth required, or orderId fallback)
      if (orderResult.redirect) {
        return redirect(orderResult.redirect);
      }
      // Handle email conflict
      if (orderResult.emailConflict) {
        return json(
          {
            ok: false,
            error: orderResult.error,
            code: "EMAIL_CONFLICT",
            emailConflict: true,
            conflictEmail: orderResult.conflictEmail,
          } satisfies CheckoutActionError,
          { status: orderResult.status },
        );
      }
      return json(
        {
          ok: false,
          error: orderResult.error,
          code: "ORDER_CREATION_FAILED",
        } satisfies CheckoutActionError,
        { status: orderResult.status },
      );
    }

    const { orderId } = orderResult;

    // 6. Recuperer les details pour Paybox
    const orderDetails = await getOrderForPayment(request, orderId);

    if (!orderDetails) {
      return json(
        {
          ok: false,
          error: "Commande creee mais impossible de recuperer les details.",
          code: "PAYMENT_UNAVAILABLE",
        } satisfies CheckoutActionError,
        { status: 500 },
      );
    }

    if (orderDetails.isPaid) {
      return redirect(`/account/orders/${orderId}`);
    }

    if (orderDetails.totalTTC <= 0) {
      return json(
        {
          ok: false,
          error: "Montant de commande invalide.",
          code: "ORDER_CREATION_FAILED",
        } satisfies CheckoutActionError,
        { status: 400 },
      );
    }

    const customerEmail = orderDetails.customerEmail || guestEmail || "";
    if (!customerEmail) {
      return json(
        {
          ok: false,
          error: "Email client manquant sur la commande.",
          code: "ORDER_CREATION_FAILED",
        } satisfies CheckoutActionError,
        { status: 400 },
      );
    }

    logger.log("[Checkout] Order created, building Paybox redirect:", {
      orderId,
      totalTTC: orderDetails.totalTTC,
    });

    // 7. Build Paybox redirect URL
    const redirectUrl = buildPayboxRedirectUrl(
      orderId,
      orderDetails.totalTTC,
      customerEmail,
    );

    return json({ ok: true, redirectUrl, orderId });
  } catch (error) {
    logger.error("[Checkout] Action error:", error);
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erreur inconnue",
        code: "UNKNOWN_ERROR",
      } satisfies CheckoutActionError,
      { status: 500 },
    );
  }
}

// -- Component ---------------------------------------------------------------

function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

// -- localStorage helpers for guest persistence (point 7) --
const STORAGE_KEY = "automecanik_checkout";

function loadCheckoutState(): {
  guestEmail?: string;
  shippingAddress?: Partial<ShippingAddress>;
} {
  try {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCheckoutState(guestEmail: string, addr: ShippingAddress) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ guestEmail, shippingAddress: addr }),
    );
  } catch {
    // localStorage full or unavailable — ignore
  }
}

function clearCheckoutState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export default function CheckoutPage() {
  const data = useLoaderData<typeof loader>();
  const { cart, user, userProfile, paymentMethods, vehicle } = data as {
    cart: { items: CartItemType[]; summary: CartSummaryType } | null;
    user?: {
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
    };
    userProfile?: CheckoutUserProfile;
    paymentMethods?: PaymentMethod[];
    vehicle?: VehicleCookie | null;
  };
  const loaderError = "error" in data ? (data as any).error : undefined;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const submit = useSubmit();

  // Refs for smooth scroll (point 2)
  const paiementRef = useRef<HTMLDivElement>(null);
  // Double-submit guard (point 5)
  const [isRedirecting, setIsRedirecting] = useState(false);
  const isLocked = isSubmitting || isRedirecting;

  // Auto-detect if connected user has complete address → skip livraison
  const hasCompleteAddress = !!(
    userProfile &&
    userProfile.firstName?.trim() &&
    userProfile.lastName?.trim() &&
    userProfile.address?.trim() &&
    userProfile.zipCode?.trim() &&
    userProfile.city?.trim() &&
    userProfile.country?.trim()
  );
  const shouldAutoSkip = !!user && hasCompleteAddress;

  // (point 7) Restore guest state from localStorage
  const savedState = useRef(loadCheckoutState());

  // Accordion state — start on paiement if auto-skip (point 1)
  const [activeSection, setActiveSection] = useState<string>(
    shouldAutoSkip ? "paiement" : "livraison",
  );
  const [addressValidated, setAddressValidated] = useState(shouldAutoSkip);

  // Guest email — restore from localStorage (point 7)
  const [guestEmail, setGuestEmail] = useState(
    !user ? savedState.current.guestEmail || "" : "",
  );

  // Shipping address — restore from localStorage for guest (point 7)
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    civility: "M.",
    firstName:
      userProfile?.firstName ||
      user?.firstName ||
      savedState.current.shippingAddress?.firstName ||
      "",
    lastName:
      userProfile?.lastName ||
      user?.lastName ||
      savedState.current.shippingAddress?.lastName ||
      "",
    address:
      userProfile?.address || savedState.current.shippingAddress?.address || "",
    zipCode:
      userProfile?.zipCode || savedState.current.shippingAddress?.zipCode || "",
    city: userProfile?.city || savedState.current.shippingAddress?.city || "",
    phone:
      userProfile?.phone || savedState.current.shippingAddress?.phone || "",
    country:
      userProfile?.country ||
      savedState.current.shippingAddress?.country ||
      "France",
  });

  // Payment
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>(
    paymentMethods?.find((m) => m.isDefault)?.id ||
      paymentMethods?.[0]?.id ||
      "cyberplus",
  );

  // (point 7) Persist guest state to localStorage on change
  useEffect(() => {
    if (!user) {
      saveCheckoutState(guestEmail, shippingAddress);
    }
  }, [user, guestEmail, shippingAddress]);

  // Redirect to Paybox when action returns ok + redirectUrl
  useEffect(() => {
    if (
      actionData &&
      "ok" in actionData &&
      actionData.ok === true &&
      "redirectUrl" in actionData
    ) {
      setIsRedirecting(true);
      clearCheckoutState();
      window.location.href = actionData.redirectUrl as string;
    }
    if (
      actionData &&
      "ok" in actionData &&
      actionData.ok === false &&
      "error" in actionData
    ) {
      setIsRedirecting(false);
      toast.error(actionData.error as string);
    }
  }, [actionData]);

  // GA4: track begin checkout
  useEffect(() => {
    if (cart?.items?.length) {
      trackBeginCheckout(cart.items, cart.summary?.total_price || 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (point 4) Handle orderId in query param (backward compat from old checkout-payment)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("orderId");
    if (orderId) {
      // Old flow had orderId — the order already exists, user is returning
      // Clean the URL without reload
      window.history.replaceState({}, "", "/checkout");
    }
  }, []);

  // Accordion guard
  const handleAccordionChange = (value: string) => {
    if (value === "paiement" && !addressValidated) return;
    setActiveSection(value);
  };

  // (point 2) Smooth scroll to paiement section
  const scrollToPaiement = useCallback(() => {
    setTimeout(() => {
      paiementRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 350); // Wait for accordion animation
  }, []);

  // Livraison validated → open paiement + scroll (points 1, 2)
  // Note: trackAddPaymentInfo is called in a separate effect below (after total is computed)
  const handleLivraisonValidated = useCallback(() => {
    setAddressValidated(true);
    setActiveSection("paiement");
    scrollToPaiement();
  }, [scrollToPaiement]);

  // Form submit — guard against double submit
  const handleCheckoutSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLocked) return;
    const fd = new FormData();
    if (guestEmail) fd.set("guestEmail", guestEmail);
    fd.set("firstName", shippingAddress.firstName);
    fd.set("lastName", shippingAddress.lastName);
    fd.set("address", shippingAddress.address);
    fd.set("zipCode", shippingAddress.zipCode);
    fd.set("city", shippingAddress.city);
    fd.set("civility", shippingAddress.civility);
    fd.set("country", shippingAddress.country);
    fd.set("paymentMethod", selectedPaymentMethod);
    if (shippingAddress.phone) fd.set("phone", shippingAddress.phone);
    fd.set("acceptTerms", acceptedTerms ? "on" : "");
    submit(fd, { method: "post" });
  };

  // Error states — read from typed action response
  const actionError =
    actionData && "ok" in actionData && actionData.ok === false
      ? (actionData as CheckoutActionError)
      : undefined;
  const error = loaderError || actionError?.error;

  // Field-level errors from Zod validation
  const fieldErrors: CheckoutFieldErrors | undefined =
    actionError?.fieldErrors ?? undefined;

  const total = cart
    ? (cart.summary.total_price ??
      cart.summary.subtotal +
        (cart.summary.tax_amount || 0) +
        (cart.summary.shipping_cost || 0) +
        (cart.summary.consigne_total || 0) -
        (cart.summary.discount_amount || 0))
    : 0;

  const canSubmitOrder =
    addressValidated &&
    acceptedTerms &&
    (cart?.items?.length ?? 0) > 0 &&
    total > 0 &&
    !isLocked &&
    !!selectedPaymentMethod;

  useEffect(() => {
    if (error) {
      toast.error(error as string, { duration: 5000 });
    }
  }, [error]);

  // Track payment info when paiement section opens
  useEffect(() => {
    if (addressValidated && total > 0) {
      trackAddPaymentInfo(total, "card");
    }
  }, [addressValidated, total]);

  // Empty cart state
  if (!cart || loaderError) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-2xl px-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
            <p>{loaderError || "Erreur lors du chargement"}</p>
          </div>
          <Link
            to="/cart"
            className="mt-4 inline-block text-cta hover:underline"
          >
            &larr; Retour au panier
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <Form
        method="post"
        id="checkout-form"
        onSubmit={handleCheckoutSubmit}
        className="mx-auto w-full max-w-6xl px-page py-8"
      >
        {/* Header */}
        <div className="mb-8">
          <PublicBreadcrumb
            items={[{ label: "Panier", href: "/cart" }, { label: "Commande" }]}
            className="hidden sm:block"
          />
          <CheckoutStepper current="checkout" />

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Finalisez votre commande
          </h1>
          {vehicle && (
            <p className="text-sm font-medium text-slate-700 mt-2 flex items-center gap-2">
              Commande pour votre{" "}
              <span className="font-semibold">
                {[vehicle.marque_name, vehicle.modele_name, vehicle.type_name]
                  .filter(Boolean)
                  .join(" ")}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Compatibilite verifiee
              </span>
            </p>
          )}
          <p className="text-slate-600 mt-1">
            Completez vos coordonnees pour acceder au paiement securise.
          </p>

          {/* Reassurance badges */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 mt-3">
            <span className="flex items-center gap-1.5">
              <svg
                className="h-4 w-4 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                />
              </svg>
              Expedition 24-48h
            </span>
            <span className="flex items-center gap-1.5">
              <svg
                className="h-4 w-4 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              Paiement securise
            </span>
            <span className="flex items-center gap-1.5">
              <svg
                className="h-4 w-4 text-orange-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Retours 30 jours
            </span>
            <span className="flex items-center gap-1.5">
              <svg
                className="h-4 w-4 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              Support expert
            </span>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div
            className={`mb-6 rounded-xl border p-4 shadow-sm ${
              actionError?.code === "EMAIL_CONFLICT"
                ? "border-orange-300 bg-orange-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <svg
                className={`h-5 w-5 flex-shrink-0 ${
                  actionError?.code === "EMAIL_CONFLICT"
                    ? "text-orange-600"
                    : "text-red-600"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                {actionError?.code === "EMAIL_CONFLICT" ? (
                  <>
                    <h3 className="font-semibold text-orange-900">
                      Email deja utilise
                    </h3>
                    <p className="text-sm text-orange-700 mt-1">{error}</p>
                    <Link
                      to={`/login?redirectTo=/checkout&email=${encodeURIComponent(
                        actionError.conflictEmail || "",
                      )}`}
                      className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-cta text-white text-sm font-medium rounded-lg hover:bg-cta-hover transition-colors"
                    >
                      Se connecter
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-red-700">{error}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: Accordion */}
          <div className="lg:col-span-2">
            {/* Vehicle context banner */}
            <CartVehicleBanner vehicle={vehicle || null} />

            <Accordion
              type="single"
              value={activeSection}
              onValueChange={handleAccordionChange}
              className="space-y-4"
            >
              {/* Section 1: Livraison */}
              <AccordionItem
                value="livraison"
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <AccordionTrigger className="px-6 py-5 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all duration-500 ${
                        addressValidated
                          ? "bg-emerald-500 text-white scale-110"
                          : "bg-blue-600 text-white"
                      }`}
                    >
                      {addressValidated ? (
                        <svg
                          className="w-4 h-4 animate-checkmark"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        "1"
                      )}
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-semibold text-slate-900">
                        Coordonnees et livraison
                      </h2>
                      {addressValidated && activeSection !== "livraison" ? (
                        <p className="text-sm text-slate-500 animate-fadeIn">
                          {shippingAddress.firstName} {shippingAddress.lastName}{" "}
                          &mdash; {shippingAddress.zipCode}{" "}
                          {shippingAddress.city}
                          <span className="ml-2 text-blue-600 text-xs font-medium">
                            Modifier
                          </span>
                        </p>
                      ) : user && activeSection !== "livraison" ? (
                        <p className="text-xs mt-0.5">
                          {hasCompleteAddress ? (
                            <span className="text-emerald-600 flex items-center gap-1">
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              Adresse enregistree
                            </span>
                          ) : (
                            <span className="text-amber-600 flex items-center gap-1">
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                                />
                              </svg>
                              Coordonnees a completer
                            </span>
                          )}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <CheckoutLivraisonSection
                    user={user || null}
                    userProfile={userProfile || null}
                    shippingAddress={shippingAddress}
                    onShippingAddressChange={setShippingAddress}
                    guestEmail={guestEmail}
                    onGuestEmailChange={setGuestEmail}
                    onValidated={handleLivraisonValidated}
                    fieldErrors={fieldErrors}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Section 2: Paiement */}
              <div ref={paiementRef}>
                <AccordionItem
                  value="paiement"
                  disabled={!addressValidated}
                  className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${
                    addressValidated
                      ? "border-slate-200"
                      : "border-slate-100 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <AccordionTrigger
                    className={`px-6 py-5 hover:no-underline ${!addressValidated ? "pointer-events-none" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all duration-300 ${
                          addressValidated
                            ? "bg-blue-600 text-white"
                            : "bg-slate-200 text-slate-400"
                        }`}
                      >
                        2
                      </div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        Paiement securise
                      </h2>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <CheckoutPaiementSection
                      paymentMethods={paymentMethods || []}
                      selectedPaymentMethod={selectedPaymentMethod}
                      onPaymentMethodChange={setSelectedPaymentMethod}
                      acceptedTerms={acceptedTerms}
                      onAcceptedTermsChange={setAcceptedTerms}
                      isProcessing={isLocked}
                      canSubmit={canSubmitOrder}
                      totalTTC={total}
                      itemCount={cart.items.length}
                      vehicleLabel={
                        vehicle
                          ? [
                              vehicle.marque_name,
                              vehicle.modele_name,
                              vehicle.type_name,
                            ]
                              .filter(Boolean)
                              .join(" ")
                          : null
                      }
                    />
                  </AccordionContent>
                </AccordionItem>
              </div>
            </Accordion>
          </div>

          {/* Right column: Order summary sidebar */}
          <div className="lg:col-span-1">
            <CheckoutOrderSummary cart={cart} total={total} vehicle={vehicle} />
          </div>
        </div>
      </Form>

      {/* Redirecting overlay (point 5) */}
      {isRedirecting && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <svg
              className="animate-spin h-10 w-10 text-cta"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-lg font-semibold text-slate-900">
              Redirection vers le paiement securise...
            </p>
            <p className="text-sm text-slate-500">Ne fermez pas cette page</p>
          </div>
        </div>
      )}

      {/* Mobile Bottom Bar (point 6 — progress indicator) */}
      <MobileBottomBarSpacer />
      <MobileBottomBar>
        <div className="flex-1">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                activeSection === "livraison"
                  ? "w-6 bg-blue-600"
                  : "w-1.5 bg-emerald-500"
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                activeSection === "paiement"
                  ? "w-6 bg-blue-600"
                  : addressValidated
                    ? "w-1.5 bg-slate-300"
                    : "w-1.5 bg-slate-200"
              }`}
            />
          </div>
          {activeSection === "paiement" && addressValidated ? (
            <button
              type="submit"
              form="checkout-form"
              disabled={!canSubmitOrder}
              className="w-full py-3 px-4 bg-cta hover:bg-cta-hover text-white rounded-xl font-bold flex items-center justify-center gap-2 touch-target disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLocked ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>
                    {isRedirecting ? "Redirection..." : "En cours..."}
                  </span>
                </>
              ) : (
                <span>Payer {formatPrice(total)}</span>
              )}
            </button>
          ) : (
            <div className="text-center text-sm text-slate-500 py-2">
              {!addressValidated
                ? "Completez vos coordonnees"
                : !acceptedTerms
                  ? "Acceptez les CGV pour continuer"
                  : `${formatPrice(total)} — ${cart.items.length} article${cart.items.length > 1 ? "s" : ""}`}
            </div>
          )}
        </div>
      </MobileBottomBar>

      {/* Mini footer */}
      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-500">
        <div className="mx-auto max-w-6xl px-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link to="/cgv" className="hover:text-gray-700 hover:underline">
            CGV
          </Link>
          <span>&middot;</span>
          <Link
            to="/confidentialite"
            className="hover:text-gray-700 hover:underline"
          >
            Confidentialite
          </Link>
          <span>&middot;</span>
          <Link
            to="/mentions-legales"
            className="hover:text-gray-700 hover:underline"
          >
            Mentions legales
          </Link>
          <span>&middot;</span>
          <Link to="/contact" className="hover:text-gray-700 hover:underline">
            Contact
          </Link>
        </div>
      </footer>
    </div>
  );
}

// -- Error Boundary ----------------------------------------------------------

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
