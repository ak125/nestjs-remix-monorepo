/**
 * 🛍️ CHECKOUT PAGE - Finalisation de commande
 * Route simple pour créer une commande depuis le panier
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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getOptionalUser } from "../auth/unified.server";
import { getCart } from "../services/cart.server";
import { CheckoutStepper } from "~/components/checkout/CheckoutStepper";
import { Error404 } from "~/components/errors/Error404";

import {
  MobileBottomBar,
  MobileBottomBarSpacer,
} from "~/components/layout/MobileBottomBar";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { trackBeginCheckout } from "~/utils/analytics";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

// Phase 9: PageRole pour analytics
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R2_PRODUCT, {
    clusterId: "checkout",
    canonicalEntity: "finalisation",
    funnelStage: "decision",
    conversionGoal: "purchase",
  }),
};

// 🤖 SEO: Page transactionnelle non indexable
export const meta: MetaFunction = () => [
  { title: "Finalisation de commande | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/checkout",
  },
];

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  // ✅ Auth optionnelle - guest checkout autorisé
  const user = await getOptionalUser({ context });
  const userId = user?.id || null;

  logger.log("🔍 Checkout loader - User:", userId || "guest");

  try {
    const cart = await getCart(request, context);
    logger.log("🔍 Checkout loader - Cart data received:", {
      hasCart: !!cart,
      itemsLength: cart?.items?.length,
      itemsIsArray: Array.isArray(cart?.items),
      summaryItems: cart?.summary?.total_items,
      keys: cart ? Object.keys(cart) : [],
    });

    // ✅ Vérification plus robuste du panier
    if (!cart || !cart.items) {
      logger.warn("⚠️ Checkout loader - Structure panier invalide");
      return json({
        cart: null,
        error: "Erreur de structure du panier. Veuillez recharger.",
      });
    }

    // Vérifier que le panier contient des articles
    const itemsCount = Array.isArray(cart.items) ? cart.items.length : 0;
    const totalItems = cart?.summary?.total_items || 0;

    logger.log("🔍 Checkout loader - Items check:", {
      itemsCount,
      totalItems,
    });

    if (itemsCount === 0 && totalItems === 0) {
      logger.warn("⚠️ Checkout loader - Panier vide");
      return json({
        cart: null,
        error:
          "Votre panier est vide. Ajoutez des articles avant de passer commande.",
      });
    }

    logger.log(
      "✅ Checkout loader - Panier OK:",
      itemsCount,
      "lignes,",
      totalItems,
      "articles total",
    );

    // Si client connecté, récupérer le profil complet (adresse)
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
        logger.warn(
          "⚠️ Checkout loader - Impossible de charger le profil:",
          err,
        );
      }
    }

    return json({ cart, user, userProfile });
  } catch (error) {
    logger.error("❌ Erreur chargement panier checkout:", error);
    logger.error(
      "❌ Error type:",
      error instanceof Error ? error.constructor.name : typeof error,
    );
    logger.error(
      "❌ Message:",
      error instanceof Error ? error.message : String(error),
    );
    logger.error("❌ Stack:", error instanceof Error ? error.stack : "N/A");
    return json({
      cart: null,
      error: "Erreur lors du chargement du panier. Veuillez réessayer.",
    });
  }
};

export async function action({ request }: ActionFunctionArgs) {
  logger.log("🔵 [Checkout Action] Début de l'action");
  logger.log("🔵 [Checkout Action] Request URL:", request.url);
  logger.log("🔵 [Checkout Action] Request method:", request.method);

  try {
    // Lire les données depuis l'URL (query params) car formData() bloque avec NestJS middleware
    const url = new URL(request.url);
    const guestEmail = url.searchParams.get("guestEmail") || null;
    let addressFirstName = url.searchParams.get("firstName") || "";
    let addressLastName = url.searchParams.get("lastName") || "";
    let addressLine = url.searchParams.get("address") || "";
    let addressZipCode = url.searchParams.get("zipCode") || "";
    let addressCity = url.searchParams.get("city") || "";
    const addressCivility = url.searchParams.get("civility") || "M.";
    const addressCountry = url.searchParams.get("country") || "France";

    // Client connecté sans adresse dans les params → récupérer depuis le profil
    const isGuest = !!guestEmail;
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
          logger.log("📋 [Checkout Action] Adresse récupérée du profil:", {
            firstName: addressFirstName,
            city: addressCity,
          });
        }
      } catch (err) {
        logger.warn(
          "⚠️ [Checkout Action] Impossible de charger le profil:",
          err,
        );
      }
    }
    logger.log(
      "🔵 [Checkout Action] guestEmail:",
      guestEmail || "none (authenticated user)",
    );

    // 1. Récupérer le panier
    logger.log("🛒 [Checkout Action] Récupération du panier...");
    const cartResponse = await fetch(
      getInternalApiUrlFromRequest("/api/cart", request),
      {
        headers: {
          Cookie: request.headers.get("Cookie") || "",
        },
      },
    );

    logger.log("🛒 [Checkout Action] Statut panier:", cartResponse.status);

    if (!cartResponse.ok) {
      logger.error("❌ [Checkout Action] Erreur récupération panier");
      return json(
        {
          success: false,
          error: "Impossible de récupérer le panier. Veuillez réessayer.",
        },
        { status: 400 },
      );
    }

    const cartData = await cartResponse.json();
    logger.log(
      "🛒 [Checkout Action] Panier récupéré:",
      cartData.items?.length || 0,
      "articles",
    );

    if (!cartData.items || cartData.items.length === 0) {
      return json(
        {
          success: false,
          error:
            "Votre panier est vide. Veuillez ajouter des articles avant de passer commande.",
        },
        { status: 400 },
      );
    }

    // 2. Transformer les items du panier en lignes de commande
    // ✅ Phase 5: Inclure les consignes dans les lignes de commande
    const orderLines = cartData.items.map((item: any) => ({
      productId: String(item.product_id),
      productName: item.product_name || "Produit",
      productReference: item.product_sku || String(item.product_id),
      quantity: item.quantity,
      unitPrice: item.price,
      vatRate: 20, // TVA par défaut
      discount: 0,
      consigne_unit: item.consigne_unit || 0, // ✅ Phase 5: Consigne unitaire
      has_consigne: item.has_consigne || false, // ✅ Phase 5: Produit avec consigne
    }));

    // 3. Créer la commande avec données structurées
    const addressData = {
      civility: addressCivility,
      firstName: addressFirstName,
      lastName: addressLastName,
      address: addressLine,
      zipCode: addressZipCode,
      city: addressCity,
      country: addressCountry,
    };
    const orderPayload = {
      customerId: cartData.metadata?.user_id || 0, // sera récupéré côté backend
      orderLines,
      billingAddress: addressData,
      shippingAddress: addressData,
      customerNote: "",
      shippingMethod: "standard",
    };

    logger.log(
      "📦 [Checkout Action] Payload commande:",
      JSON.stringify(orderPayload, null, 2),
    );

    // Debug: Vérifier les cookies
    const cookieHeader = request.headers.get("Cookie") || "";
    logger.log(
      "🍪 [Checkout Action] Cookie header:",
      cookieHeader ? `${cookieHeader.substring(0, 50)}...` : "VIDE",
    );

    // Choisir l'endpoint selon le mode (guest ou authentifié)
    const orderUrl = isGuest
      ? getInternalApiUrlFromRequest("/api/orders/guest", request)
      : getInternalApiUrlFromRequest("/api/orders", request);

    const payload = isGuest ? { ...orderPayload, guestEmail } : orderPayload;

    logger.log(
      `🚀 [Checkout Action] Envoi requête ${isGuest ? "guest" : "auth"} création commande...`,
    );

    const response = await fetch(orderUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify(payload),
    });

    logger.log(
      "📦 [Checkout Action] Statut création commande:",
      response.status,
    );

    if (!response.ok) {
      logger.error(
        "❌ [Checkout Action] Erreur création commande, statut:",
        response.status,
      );

      // Guest checkout: email déjà enregistré → message inline (pas de redirect)
      if (response.status === 409 && isGuest) {
        return json(
          {
            success: false,
            error: `Un compte existe déjà avec l'email ${guestEmail}. Connectez-vous ou utilisez une autre adresse email.`,
            emailConflict: true,
            conflictEmail: guestEmail,
          },
          { status: 409 },
        );
      }

      // Détecter si l'erreur est due à un manque d'authentification
      if (response.status === 403 || response.status === 401) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set(
          "message",
          "Vous devez être connecté pour passer commande",
        );
        loginUrl.searchParams.set("redirectTo", "/checkout");
        return redirect(loginUrl.toString());
      }

      const error = await response
        .json()
        .catch(() => ({ message: "Erreur serveur" }));
      logger.error("❌ [Checkout Action] Détails erreur:", error);
      throw new Error(
        error.message || "Erreur lors de la création de la commande",
      );
    }

    const order = await response.json();
    logger.log("✅ [Checkout Action] Commande créée:", order);

    // ✅ Phase 7: Retourner l'orderId à l'action data pour redirection côté client
    // L'API retourne un objet avec ord_id (format BDD)
    logger.log(
      "📦 Réponse API création commande:",
      JSON.stringify(order, null, 2),
    );

    const orderId = order.ord_id || order.order_id || order.id;
    logger.log("🔍 orderId extrait:", orderId);

    if (!orderId || orderId === "créé") {
      // Fallback si on n'a pas l'ID
      logger.log(
        "✅ Commande créée sans ID, redirection vers la liste des commandes",
      );
      return redirect("/account/orders?created=true");
    }

    const redirectUrl = `/checkout-payment?orderId=${orderId}`;
    logger.log(
      `✅ [Checkout Action] Commande ${orderId} créée, redirection vers: ${redirectUrl}`,
    );

    // ✅ SOLUTION: Utiliser redirect() au lieu de json() pour une vraie redirection
    return redirect(redirectUrl);
  } catch (error) {
    logger.error("❌ [Checkout Action] Erreur création commande:", error);
    logger.error(
      "❌ [Checkout Action] Stack:",
      error instanceof Error ? error.stack : "No stack",
    );
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 },
    );
  }
}

export default function CheckoutPage() {
  const data = useLoaderData<typeof loader>();
  const { cart, user, userProfile } = data as any;
  const loaderError = "error" in data ? data.error : undefined;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const submit = useSubmit();
  const [guestEmail, setGuestEmail] = useState("");
  const [emailChecked, setEmailChecked] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Détection adresse complète du profil
  const hasCompleteAddress = !!(
    userProfile &&
    userProfile.address?.trim() &&
    userProfile.zipCode?.trim() &&
    userProfile.city?.trim()
  );

  // Mode édition : false si le client a déjà une adresse complète
  const [isEditingAddress, setIsEditingAddress] = useState(!hasCompleteAddress);

  // Vérifier si l'email existe (style Amazon)
  const handleEmailCheck = async () => {
    if (!guestEmail || !guestEmail.includes("@")) return;
    setIsCheckingEmail(true);
    try {
      const res = await fetch("/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: guestEmail }),
      });
      const data = await res.json();
      setEmailExists(data.exists);
      setEmailChecked(true);
    } catch {
      setEmailChecked(true);
      setEmailExists(false);
    }
    setIsCheckingEmail(false);
  };

  // Login inline depuis le checkout
  const handleInlineLogin = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: guestEmail, password: loginPassword }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({ success: true }));
        if (data.success !== false) {
          // Session établie + panier fusionné côté serveur → recharger
          window.location.href = "/checkout";
        } else {
          setLoginError(data.error || "Email ou mot de passe incorrect");
        }
      } else {
        // 401 ou autre erreur HTTP → lire le message d'erreur
        const data = await res.json().catch(() => ({}));
        setLoginError(
          data.message || data.error || "Email ou mot de passe incorrect",
        );
      }
    } catch {
      setLoginError("Erreur de connexion. Veuillez réessayer.");
    }
  };

  const [shippingAddress, setShippingAddress] = useState({
    civility: "M.",
    firstName: userProfile?.firstName || user?.firstName || "",
    lastName: userProfile?.lastName || user?.lastName || "",
    address: userProfile?.address || "",
    zipCode: userProfile?.zipCode || "",
    city: userProfile?.city || "",
    country: userProfile?.country || "France",
  });

  // Le guest ne peut soumettre que si email vérifié et nouveau
  const guestReady = !user ? emailChecked && !emailExists : true;
  const canSubmit = !isSubmitting && guestReady;

  const handleCheckoutSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Envoyer POST avec données en query params (formData() bloque avec NestJS middleware)
    const params = new URLSearchParams();
    if (guestEmail) params.set("guestEmail", guestEmail);
    // Toujours envoyer l'adresse saisie (guest et auth)
    if (shippingAddress.firstName)
      params.set("firstName", shippingAddress.firstName);
    if (shippingAddress.lastName)
      params.set("lastName", shippingAddress.lastName);
    if (shippingAddress.address) params.set("address", shippingAddress.address);
    if (shippingAddress.zipCode) params.set("zipCode", shippingAddress.zipCode);
    if (shippingAddress.city) params.set("city", shippingAddress.city);
    if (shippingAddress.civility)
      params.set("civility", shippingAddress.civility);
    params.set("country", shippingAddress.country);
    const queryString = params.toString();
    const action = queryString ? `/checkout?${queryString}` : "/checkout";
    submit(null, { method: "post", action });
  };

  logger.log(
    "🔍 CheckoutPage render, actionData:",
    actionData ? "present" : "null",
  );

  // Erreur peut venir du loader ou de l'action
  const error =
    loaderError ||
    (actionData && "error" in actionData ? actionData.error : undefined);

  // ✅ Afficher un toast d'erreur si présent
  useEffect(() => {
    if (error) {
      toast.error(error, {
        duration: 5000,
      });
    }
  }, [error]);

  // 📊 GA4: Tracker le debut du checkout (une seule fois au montage)
  useEffect(() => {
    if (cart?.items?.length) {
      trackBeginCheckout(cart.items, cart.summary?.total_price || 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cart || loaderError) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-destructive/15 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p>{loaderError || "Erreur lors du chargement"}</p>
          </div>
          <Link
            to="/cart"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            ← Retour au panier
          </Link>
        </div>
      </div>
    );
  }

  const total =
    cart.summary.total_price ||
    cart.summary.subtotal +
      cart.summary.tax_amount +
      cart.summary.shipping_cost;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <Form
        method="post"
        id="checkout-form"
        onSubmit={handleCheckoutSubmit}
        className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8"
      >
        {/* Header avec breadcrumb + stepper */}
        <div className="mb-8">
          <PublicBreadcrumb
            items={[{ label: "Panier", href: "/cart" }, { label: "Commande" }]}
          />
          <CheckoutStepper current="checkout" />

          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
            Finaliser ma commande
          </h1>
          <p className="text-slate-600 mt-2">
            Vérifiez votre commande avant de continuer
          </p>
        </div>

        {/* Affichage erreur si action a échoué */}
        {error && (
          <div
            className={`mb-6 rounded-xl border p-4 shadow-sm ${
              actionData &&
              "emailConflict" in actionData &&
              actionData.emailConflict
                ? "border-orange-300 bg-orange-50"
                : "border-destructive bg-destructive/10"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg
                  className={`h-5 w-5 ${actionData && "emailConflict" in actionData && actionData.emailConflict ? "text-orange-600" : "text-red-600"}`}
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
              </div>
              <div className="flex-1">
                {actionData &&
                "emailConflict" in actionData &&
                actionData.emailConflict ? (
                  <>
                    <h3 className="font-semibold text-orange-900">
                      Email déjà utilisé
                    </h3>
                    <p className="text-sm text-orange-700 mt-1">{error}</p>
                    <Link
                      to={`/login?redirectTo=/checkout&email=${encodeURIComponent(
                        ("conflictEmail" in actionData
                          ? String(actionData.conflictEmail)
                          : "") || "",
                      )}`}
                      className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Se connecter
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </Link>
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold text-red-900">
                      Erreur lors de la création de la commande
                    </h3>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Informations client */}
          <div className="lg:col-span-2 space-y-6">
            {/* Utilisateur connecté - Identité */}
            {user && (
              <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-emerald-600"
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
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-900">
                      Connecté en tant que{" "}
                      <strong>
                        {user.firstName} {user.lastName}
                      </strong>
                    </p>
                    <p className="text-xs text-emerald-700">{user.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Email invité - Flow Amazon : email d'abord, puis login ou formulaire */}
            {!user && (
              <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6 border-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      Votre email
                    </h2>
                    <p className="text-sm text-slate-500">
                      Pour recevoir la confirmation de commande
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Champ email + bouton Continuer */}
                  <div>
                    <label
                      htmlFor="guestEmail"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Adresse email *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        id="guestEmail"
                        name="guestEmail"
                        required
                        value={guestEmail}
                        onChange={(e) => {
                          setGuestEmail(e.target.value);
                          // Reset si l'email change
                          if (emailChecked) {
                            setEmailChecked(false);
                            setEmailExists(false);
                            setLoginError("");
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !emailChecked) {
                            e.preventDefault();
                            handleEmailCheck();
                          }
                        }}
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="votre.email@exemple.com"
                      />
                      {!emailChecked && (
                        <button
                          type="button"
                          onClick={handleEmailCheck}
                          disabled={
                            isCheckingEmail || !guestEmail.includes("@")
                          }
                          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {isCheckingEmail ? "..." : "Continuer"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Email existe : formulaire de connexion inline */}
                  {emailChecked && emailExists && (
                    <div className="bg-orange-50 rounded-xl p-5 border border-orange-200">
                      <h3 className="font-semibold text-orange-900 mb-1">
                        Un compte existe avec cet email
                      </h3>
                      <p className="text-sm text-orange-700 mb-4">
                        Connectez-vous pour retrouver vos informations et passer
                        commande directement.
                      </p>
                      <div className="space-y-3">
                        <input
                          type="password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleInlineLogin();
                            }
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-orange-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Mot de passe"
                        />
                        {loginError && (
                          <p className="text-sm text-red-600">{loginError}</p>
                        )}
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={handleInlineLogin}
                            className="px-6 py-3 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors"
                          >
                            Se connecter
                          </button>
                          <Link
                            to={`/login?redirectTo=/checkout&email=${encodeURIComponent(guestEmail)}`}
                            className="text-sm text-orange-700 hover:underline"
                          >
                            Mot de passe oublié ?
                          </Link>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEmailChecked(false);
                          setEmailExists(false);
                          setGuestEmail("");
                        }}
                        className="mt-3 text-sm text-slate-500 hover:underline"
                      >
                        Utiliser un autre email
                      </button>
                    </div>
                  )}

                  {/* Email nouveau : confirmer et continuer vers le formulaire */}
                  {emailChecked && !emailExists && (
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-5 h-5 text-emerald-600"
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
                        <p className="text-sm font-medium text-emerald-900">
                          {guestEmail}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setEmailChecked(false);
                            setGuestEmail("");
                          }}
                          className="ml-auto text-sm text-emerald-700 hover:underline"
                        >
                          Modifier
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Adresse de livraison : visible seulement pour les connectés OU guest avec email vérifié et nouveau */}
            {(user || (emailChecked && !emailExists)) && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      Adresse de livraison
                    </h2>
                  </div>
                  {/* Bouton Modifier visible seulement en mode récapitulatif */}
                  {user && hasCompleteAddress && !isEditingAddress && (
                    <button
                      type="button"
                      onClick={() => setIsEditingAddress(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
                    >
                      Modifier
                    </button>
                  )}
                </div>

                {/* Mode récapitulatif : client connecté avec adresse complète */}
                {user && hasCompleteAddress && !isEditingAddress ? (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <p className="font-medium text-slate-900">
                      {shippingAddress.firstName} {shippingAddress.lastName}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {shippingAddress.address}
                    </p>
                    <p className="text-sm text-slate-600">
                      {shippingAddress.zipCode} {shippingAddress.city},{" "}
                      {shippingAddress.country}
                    </p>
                  </div>
                ) : (
                  /* Mode formulaire : invité ou client sans adresse ou modification */
                  <div className="space-y-4">
                    {!user && (
                      <p className="text-sm text-slate-500 mb-2">
                        Requise pour l'expédition
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="firstName"
                          className="block text-sm font-medium text-slate-700 mb-1"
                        >
                          Prénom *
                        </label>
                        <input
                          type="text"
                          id="firstName"
                          required
                          value={shippingAddress.firstName}
                          onChange={(e) =>
                            setShippingAddress((prev) => ({
                              ...prev,
                              firstName: e.target.value,
                            }))
                          }
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="Prénom"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="lastName"
                          className="block text-sm font-medium text-slate-700 mb-1"
                        >
                          Nom *
                        </label>
                        <input
                          type="text"
                          id="lastName"
                          required
                          value={shippingAddress.lastName}
                          onChange={(e) =>
                            setShippingAddress((prev) => ({
                              ...prev,
                              lastName: e.target.value,
                            }))
                          }
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="Nom"
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="address"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Adresse *
                      </label>
                      <input
                        type="text"
                        id="address"
                        required
                        value={shippingAddress.address}
                        onChange={(e) =>
                          setShippingAddress((prev) => ({
                            ...prev,
                            address: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Numéro et nom de rue"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="zipCode"
                          className="block text-sm font-medium text-slate-700 mb-1"
                        >
                          Code postal *
                        </label>
                        <input
                          type="text"
                          id="zipCode"
                          required
                          pattern="[0-9]{5}"
                          maxLength={5}
                          value={shippingAddress.zipCode}
                          onChange={(e) =>
                            setShippingAddress((prev) => ({
                              ...prev,
                              zipCode: e.target.value,
                            }))
                          }
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="75000"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="city"
                          className="block text-sm font-medium text-slate-700 mb-1"
                        >
                          Ville *
                        </label>
                        <input
                          type="text"
                          id="city"
                          required
                          value={shippingAddress.city}
                          onChange={(e) =>
                            setShippingAddress((prev) => ({
                              ...prev,
                              city: e.target.value,
                            }))
                          }
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="Ville"
                        />
                      </div>
                    </div>
                    {/* Bouton annuler si on est en mode modification d'une adresse existante */}
                    {user && hasCompleteAddress && isEditingAddress && (
                      <button
                        type="button"
                        onClick={() => {
                          // Restaurer l'adresse du profil
                          setShippingAddress({
                            civility: "M.",
                            firstName:
                              userProfile?.firstName || user?.firstName || "",
                            lastName:
                              userProfile?.lastName || user?.lastName || "",
                            address: userProfile?.address || "",
                            zipCode: userProfile?.zipCode || "",
                            city: userProfile?.city || "",
                            country: userProfile?.country || "France",
                          });
                          setIsEditingAddress(false);
                        }}
                        className="text-sm text-slate-500 hover:text-slate-700 hover:underline"
                      >
                        Annuler et utiliser l'adresse enregistrée
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Résumé panier */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Récapitulatif de la commande
                  </h2>
                  <p className="text-sm text-slate-500">
                    {cart.items.length} article
                    {cart.items.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {cart.items.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 truncate">
                        {item.product_name}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        Quantité: {item.quantity}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="font-semibold text-slate-900">
                        {(item.price * item.quantity).toFixed(2)}€
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.price.toFixed(2)}€ / unité
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar résumé et totaux */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-8">
              <h3 className="font-semibold text-slate-900 mb-4">Résumé</h3>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Sous-total</span>
                  <span className="font-medium text-slate-900">
                    {cart.summary.subtotal.toFixed(2)}€
                  </span>
                </div>

                {cart.summary.shipping_cost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Livraison</span>
                    <span className="font-medium text-slate-900">
                      {cart.summary.shipping_cost.toFixed(2)}€
                    </span>
                  </div>
                )}

                {cart.summary.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">TVA (20%)</span>
                    <span className="font-medium text-slate-900">
                      {cart.summary.tax_amount.toFixed(2)}€
                    </span>
                  </div>
                )}

                {/* ✅ Afficher les consignes */}
                {(() => {
                  const consignesTotal = cart.items.reduce(
                    (sum: number, item: any) => {
                      if (item.has_consigne && item.consigne_unit) {
                        return sum + item.quantity * item.consigne_unit;
                      }
                      return sum;
                    },
                    0,
                  );

                  if (consignesTotal > 0) {
                    return (
                      <div className="flex justify-between text-sm bg-amber-50 -mx-6 px-6 py-3 border-y border-amber-100">
                        <span className="flex items-center gap-2 text-amber-700 font-medium">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                          Consignes
                        </span>
                        <span className="font-semibold text-amber-700">
                          {consignesTotal.toFixed(2)}€
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="pt-3 border-t border-slate-200">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-900 text-lg">
                      Total
                    </span>
                    <span className="font-bold text-blue-600 text-2xl">
                      {total.toFixed(2)}€
                    </span>
                  </div>
                </div>
              </div>

              {/* Info consignes */}
              {cart.items.some((item: any) => item.has_consigne) && (
                <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-xs text-amber-800">
                    <svg
                      className="w-4 h-4 inline mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Les consignes seront remboursées lors du retour des pièces
                    usagées
                  </p>
                </div>
              )}

              <div className="mt-6 space-y-4">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 px-6 rounded-xl font-semibold shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
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
                      <span>Création en cours...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirmer la commande</span>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                    </>
                  )}
                </button>

                <Link
                  to="/cart"
                  className="w-full inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-6 rounded-xl font-medium transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  <span>Retour au panier</span>
                </Link>
              </div>

              {/* Livraison info */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2-1 2 1 2-1 2 1zm6-6h-2l-2 5h4l2-5h-2zm-2 7a1 1 0 11-2 0 1 1 0 012 0zm-8 0a1 1 0 11-2 0 1 1 0 012 0z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Expédition sous 24-48h ouvrées
                    </p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Le délai de livraison dépend du transporteur et de votre
                      localisation.
                    </p>
                  </div>
                </div>
              </div>

              {/* Trust badges sécurité */}
              <div className="mt-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="h-5 w-5 text-emerald-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">
                      Paiement 100% sécurisé
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        SSL/TLS
                      </span>
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        PCI DSS
                      </span>
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        3D Secure
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-center text-slate-500">
                En confirmant, vous serez redirigé vers le paiement sécurisé.
              </p>
            </div>
          </div>
        </div>
      </Form>

      {/* Mobile Bottom Bar - Sticky CTA */}
      <MobileBottomBarSpacer />
      <MobileBottomBar>
        <div className="flex-1">
          <button
            type="submit"
            form="checkout-form"
            disabled={!canSubmit}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 touch-target disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
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
                <span>En cours...</span>
              </>
            ) : (
              <>
                <span>Confirmer ({total.toFixed(2)}€)</span>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </>
            )}
          </button>
        </div>
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
