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
import { type PaymentMethod } from "~/types/payment";
import { trackBeginCheckout, trackAddPaymentInfo } from "~/utils/analytics";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
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
    let userProfile: Record<string, any> | null = null;
    if (user) {
      try {
        const profileRes = await fetch(
          getInternalApiUrlFromRequest("/api/users/profile", request),
          { headers: { Cookie: request.headers.get("Cookie") || "" } },
        );
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          userProfile = profileData.data || profileData;
        }
      } catch (err) {
        logger.warn("[Checkout] Impossible de charger le profil:", err);
      }
    }

    // Payment methods (merged from checkout-payment)
    const paymentMethods = await getAvailablePaymentMethods();

    return json({ cart, user, userProfile, paymentMethods });
  } catch (error) {
    logger.error("[Checkout] Erreur chargement:", error);
    return json({
      cart: null,
      error: "Erreur lors du chargement du panier. Veuillez reessayer.",
    });
  }
};

// -- Action ------------------------------------------------------------------

export async function action({ request }: ActionFunctionArgs) {
  logger.log("[Checkout] Action Start");

  try {
    const formData = await request.formData();
    const guestEmail = (formData.get("guestEmail") as string) || null;
    let addressFirstName = (formData.get("firstName") as string) || "";
    let addressLastName = (formData.get("lastName") as string) || "";
    let addressLine = (formData.get("address") as string) || "";
    let addressZipCode = (formData.get("zipCode") as string) || "";
    let addressCity = (formData.get("city") as string) || "";
    const addressCivility = (formData.get("civility") as string) || "M.";
    const addressCountry = (formData.get("country") as string) || "France";
    const addressPhone = (formData.get("phone") as string) || "";
    const acceptTerms = formData.get("acceptTerms");

    // Validate CGV acceptance
    if (acceptTerms !== "on") {
      return json(
        { error: "Vous devez accepter les conditions generales de vente." },
        { status: 400 },
      );
    }

    const isGuest = !!guestEmail;

    // Client connecte sans adresse → recuperer du profil
    if (!isGuest && !addressLine) {
      try {
        const profileRes = await fetch(
          getInternalApiUrlFromRequest("/api/users/profile", request),
          { headers: { Cookie: request.headers.get("Cookie") || "" } },
        );
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          const profile = profileData.data || profileData;
          addressFirstName = addressFirstName || profile.firstName || "";
          addressLastName = addressLastName || profile.lastName || "";
          addressLine = profile.address || "";
          addressZipCode = addressZipCode || profile.zipCode || "";
          addressCity = addressCity || profile.city || "";
        }
      } catch (err) {
        logger.warn("[Checkout] Impossible de charger le profil:", err);
      }
    }

    // 1. Recuperer le panier
    const cartResponse = await fetch(
      getInternalApiUrlFromRequest("/api/cart", request),
      { headers: { Cookie: request.headers.get("Cookie") || "" } },
    );

    if (!cartResponse.ok) {
      return json(
        { error: "Impossible de recuperer le panier. Veuillez reessayer." },
        { status: 400 },
      );
    }

    const cartData = await cartResponse.json();

    if (!cartData.items || cartData.items.length === 0) {
      return json({ error: "Votre panier est vide." }, { status: 400 });
    }

    // 2. Transformer les items en lignes de commande
    const orderLines = cartData.items.map((item: CartItemType) => ({
      productId: String(item.product_id),
      productName: item.product_name || "Produit",
      productReference: item.product_sku || String(item.product_id),
      quantity: item.quantity,
      unitPrice: item.price,
      vatRate: 20,
      discount: 0,
      consigne_unit: item.consigne_unit || 0,
      has_consigne: item.has_consigne || false,
    }));

    // 3. Creer la commande
    const addressData = {
      civility: addressCivility,
      firstName: addressFirstName,
      lastName: addressLastName,
      address: addressLine,
      phone: addressPhone,
      zipCode: addressZipCode,
      city: addressCity,
      country: addressCountry,
    };

    const orderPayload = {
      customerId: cartData.metadata?.user_id ?? undefined,
      orderLines,
      billingAddress: addressData,
      shippingAddress: addressData,
      customerNote: "",
      shippingMethod: "standard",
    };

    const cookieHeader = request.headers.get("Cookie") || "";
    const orderUrl = isGuest
      ? getInternalApiUrlFromRequest("/api/orders/guest", request)
      : getInternalApiUrlFromRequest("/api/orders", request);

    const payload = isGuest ? { ...orderPayload, guestEmail } : orderPayload;

    logger.log("[Checkout] Creating order...", {
      itemCount: orderLines.length,
      isGuest,
    });

    const response = await fetch(orderUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Guest: email conflict
      if (response.status === 409 && isGuest) {
        return json(
          {
            error: `Un compte existe deja avec l'email ${guestEmail}. Connectez-vous ou utilisez une autre adresse email.`,
            emailConflict: true,
            conflictEmail: guestEmail,
          },
          { status: 409 },
        );
      }

      if (response.status === 403 || response.status === 401) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set(
          "message",
          "Vous devez etre connecte pour passer commande",
        );
        loginUrl.searchParams.set("redirectTo", "/checkout");
        return redirect(loginUrl.toString());
      }

      const error = await response
        .json()
        .catch(() => ({ message: "Erreur serveur" }));
      throw new Error(
        error.message || "Erreur lors de la creation de la commande",
      );
    }

    const order = await response.json();
    const orderId = order.ord_id || order.order_id || order.id;

    if (!orderId || orderId === "cree") {
      return redirect("/account/orders?created=true");
    }

    // 4. Fetch order details pour construire l'URL Paybox
    const orderResponse = await fetch(
      getInternalApiUrlFromRequest(`/api/orders/${orderId}`, request),
      {
        headers: {
          Cookie: cookieHeader,
          "Internal-Call": "true",
        },
      },
    );

    if (!orderResponse.ok) {
      return json(
        {
          error: "Commande creee mais impossible de recuperer les details.",
        },
        { status: 500 },
      );
    }

    const orderData = await orderResponse.json();
    const orderDetails = orderData.data;

    if (parseInt(orderDetails.ord_is_pay || "0") !== 0) {
      return redirect(`/account/orders/${orderId}`);
    }

    const totalTTC = parseFloat(orderDetails.ord_total_ttc || "0");
    if (totalTTC <= 0) {
      return json({ error: "Montant de commande invalide." }, { status: 400 });
    }

    const customerEmail = orderDetails.customer?.cst_mail || guestEmail || "";
    if (!customerEmail) {
      return json(
        { error: "Email client manquant sur la commande." },
        { status: 400 },
      );
    }

    logger.log("[Checkout] Order created, building Paybox redirect:", {
      orderId,
      totalTTC,
    });

    // 5. Build Paybox redirect URL — client will use window.location.href
    const redirectUrl = `/api/paybox/redirect?orderId=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(totalTTC)}&email=${encodeURIComponent(customerEmail)}`;

    return json({ redirectUrl });
  } catch (error) {
    logger.error("[Checkout] Action error:", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Erreur inconnue",
      },
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
  const { cart, user, userProfile, paymentMethods } = data as {
    cart: { items: CartItemType[]; summary: CartSummaryType } | null;
    user?: {
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
    };
    userProfile?: Record<string, string>;
    paymentMethods?: PaymentMethod[];
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

  // (point 1) Auto-detect if connected user has complete address → skip livraison
  const hasCompleteAddress = !!(
    userProfile &&
    userProfile.address?.trim() &&
    userProfile.zipCode?.trim() &&
    userProfile.city?.trim()
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

  // (point 7) Persist guest state to localStorage on change
  useEffect(() => {
    if (!user) {
      saveCheckoutState(guestEmail, shippingAddress);
    }
  }, [user, guestEmail, shippingAddress]);

  // Redirect to Paybox when action returns redirectUrl (point 5 — double-submit lock)
  useEffect(() => {
    if (actionData && "redirectUrl" in actionData && actionData.redirectUrl) {
      setIsRedirecting(true);
      // Clear localStorage on successful order
      clearCheckoutState();
      window.location.href = actionData.redirectUrl as string;
    }
    if (actionData && "error" in actionData && actionData.error) {
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

  // Form submit (point 5 — guard against double submit)
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
    if (shippingAddress.phone) fd.set("phone", shippingAddress.phone);
    if (acceptedTerms) fd.set("acceptTerms", "on");
    submit(fd, { method: "post" });
  };

  // Error states
  const error =
    loaderError ||
    (actionData && "error" in actionData ? actionData.error : undefined);

  const total = cart
    ? (cart.summary.total_price ??
      cart.summary.subtotal +
        (cart.summary.tax_amount || 0) +
        (cart.summary.shipping_cost || 0) +
        (cart.summary.consigne_total || 0) -
        (cart.summary.discount_amount || 0))
    : 0;

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
          <p className="text-slate-600 mt-2">
            Remplissez les informations ci-dessous pour proceder au paiement
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div
            className={`mb-6 rounded-xl border p-4 shadow-sm ${
              actionData &&
              "emailConflict" in actionData &&
              actionData.emailConflict
                ? "border-orange-300 bg-orange-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <svg
                className={`h-5 w-5 flex-shrink-0 ${
                  actionData &&
                  "emailConflict" in actionData &&
                  actionData.emailConflict
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
                {actionData &&
                "emailConflict" in actionData &&
                actionData.emailConflict ? (
                  <>
                    <h3 className="font-semibold text-orange-900">
                      Email deja utilise
                    </h3>
                    <p className="text-sm text-orange-700 mt-1">
                      {error as string}
                    </p>
                    <Link
                      to={`/login?redirectTo=/checkout&email=${encodeURIComponent(
                        ("conflictEmail" in actionData
                          ? String(actionData.conflictEmail)
                          : "") || "",
                      )}`}
                      className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-cta text-white text-sm font-medium rounded-lg hover:bg-cta-hover transition-colors"
                    >
                      Se connecter
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-red-700">{error as string}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: Accordion */}
          <div className="lg:col-span-2">
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
                        Livraison
                      </h2>
                      {addressValidated && activeSection !== "livraison" && (
                        <p className="text-sm text-slate-500 animate-fadeIn">
                          {shippingAddress.firstName} {shippingAddress.lastName}{" "}
                          &mdash; {shippingAddress.zipCode}{" "}
                          {shippingAddress.city}
                          <span className="ml-2 text-blue-600 text-xs font-medium">
                            Modifier
                          </span>
                        </p>
                      )}
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
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Section 2: Paiement */}
              <AccordionItem
                value="paiement"
                ref={paiementRef}
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
                      Paiement
                    </h2>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <CheckoutPaiementSection
                    paymentMethods={paymentMethods || []}
                    acceptedTerms={acceptedTerms}
                    onAcceptedTermsChange={setAcceptedTerms}
                    isProcessing={isLocked}
                    totalTTC={total}
                    itemCount={cart.items.length}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Right column: Order summary sidebar */}
          <div className="lg:col-span-1">
            <CheckoutOrderSummary cart={cart} total={total} />
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
              disabled={isLocked || !acceptedTerms}
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
              Etape 1/2 &middot; {formatPrice(total)} &middot;{" "}
              {cart.items.length} article
              {cart.items.length > 1 ? "s" : ""}
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
