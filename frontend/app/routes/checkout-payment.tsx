import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  json,
  redirect,
} from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  Link,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";

import { CheckoutStepper } from "~/components/checkout/CheckoutStepper";
import { Error404 } from "~/components/errors/Error404";
import { trackAddPaymentInfo } from "~/utils/analytics";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { getOptionalUser } from "../auth/unified.server";
import {
  initializePayment,
  getAvailablePaymentMethods,
} from "../services/payment.server";
import { type PaymentMethod, type OrderSummary } from "../types/payment";

// Phase 9: PageRole pour analytics
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R2_PRODUCT, {
    clusterId: "checkout-payment",
    canonicalEntity: "paiement",
    funnelStage: "decision",
    conversionGoal: "purchase",
  }),
};

// 🤖 SEO: Page transactionnelle non indexable
export const meta: MetaFunction = () => [
  { title: "Paiement | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/checkout-payment",
  },
];

interface LoaderData {
  order: OrderSummary;
  user: any;
  paymentMethods: PaymentMethod[];
}

interface ActionData {
  error?: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Guest checkout: auth optionnelle (le compte silencieux est deja cree par /api/orders/guest)
  const user = await getOptionalUser({ context });
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");

  if (!orderId) {
    return redirect("/cart");
  }

  try {
    // ✅ Phase 7: Récupérer la vraie commande depuis l'API
    const backendUrl = getInternalApiUrl("");
    const orderResponse = await fetch(`${backendUrl}/api/orders/${orderId}`, {
      headers: {
        Cookie: request.headers.get("Cookie") || "",
        "Internal-Call": "true",
      },
    });

    if (!orderResponse.ok) {
      if (orderResponse.status === 404) {
        throw new Response("Commande introuvable", { status: 404 });
      }
      throw new Error(`Failed to fetch order: ${orderResponse.statusText}`);
    }

    const orderData = await orderResponse.json();
    const orderDetails = orderData.data;

    logger.log(
      "📦 Order details from API:",
      JSON.stringify(orderDetails, null, 2),
    );

    // Mapper les lignes de commande (lines) vers items
    const items = (orderDetails.lines || []).map((line: any) => ({
      id: line.orl_id,
      name: line.orl_pg_name || "Produit",
      quantity: parseInt(line.orl_art_quantity || "1"),
      price: parseFloat(line.orl_art_price_sell_unit_ttc || "0"),
      total: parseFloat(line.orl_art_price_sell_ttc || "0"),
      image: "/images/categories/default.svg", // Placeholder par défaut
    }));

    // ✅ Récupérer les informations du client depuis la commande
    const customerName = orderDetails.customer
      ? `${orderDetails.customer.cst_fname || ""} ${orderDetails.customer.cst_name || ""}`.trim()
      : "";

    const customerEmail = orderDetails.customer?.cst_mail || "";

    logger.log("🔍 DEBUG customerName:", customerName);
    logger.log("🔍 DEBUG customerEmail:", customerEmail);
    logger.log("🔍 DEBUG customer object:", orderDetails.customer);

    // Transformer les données de la commande pour l'interface OrderSummary
    const order: OrderSummary = {
      id: orderDetails.ord_id,
      orderNumber: orderDetails.ord_id,
      status: parseInt(orderDetails.ord_is_pay || "0"),
      items,
      subtotalHT: parseFloat(orderDetails.ord_amount_ttc || "0") / 1.2, // Approximation
      tva: (parseFloat(orderDetails.ord_amount_ttc || "0") * 0.2) / 1.2, // 20% de la base HT
      shippingFee: parseFloat(orderDetails.ord_shipping_fee_ttc || "0"),
      totalTTC: parseFloat(orderDetails.ord_total_ttc || "0"),
      currency: "EUR",
      // ✅ Phase 7: Récupérer le montant des consignes
      consigneTotal: parseFloat(orderDetails.ord_deposit_ttc || "0"),
      // ✅ Informations client
      customerName,
      customerEmail,
      shippingAddress: orderDetails.customer
        ? {
            street: orderDetails.customer.cst_address || "",
            postalCode: orderDetails.customer.cst_zip_code || "",
            city: orderDetails.customer.cst_city || "",
            country: orderDetails.customer.cst_country || "FR",
          }
        : undefined,
    };

    logger.log("✅ Order transformed:", order);

    // Si la commande est déjà payée, rediriger vers la page de commande
    if (order.status !== 0) {
      return redirect(`/account/orders/${orderId}`);
    }

    const paymentMethods = await getAvailablePaymentMethods();

    return json<LoaderData>({
      order,
      user,
      paymentMethods,
    });
  } catch (error) {
    // Propager les Response HTTP (404, etc.) telles quelles
    if (error instanceof Response) {
      throw error;
    }
    logger.error("❌ Error loading payment page:", error);
    throw new Response("Erreur lors du chargement", { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  logger.log("🔥 ACTION CHECKOUT-PAYMENT APPELÉE 🔥");
  logger.log("🔍 Request URL:", request.url);
  logger.log("🔍 Request method:", request.method);
  logger.log("🔍 Content-Type:", request.headers.get("content-type"));

  let orderId: string | undefined;
  let paymentMethod: string | undefined;
  let acceptTerms: boolean;

  // ✅ Lire depuis le header X-Fetch-Body (workaround HMR Codespaces)
  const fetchBody = request.headers.get("X-Fetch-Body");

  if (!fetchBody) {
    logger.error("❌ Header X-Fetch-Body manquant");
    return json<ActionData>(
      { error: "Données de formulaire manquantes" },
      { status: 400 },
    );
  }

  logger.log(
    "✅ Body reçu depuis header X-Fetch-Body (length:",
    fetchBody.length,
    ")",
  );

  const params = new URLSearchParams(fetchBody);
  orderId = params.get("orderId") || undefined;
  paymentMethod = params.get("paymentMethod") || undefined;
  acceptTerms = params.get("acceptTerms") === "on";

  logger.log("✅ Données extraites:", { orderId, paymentMethod, acceptTerms });

  // Maintenant vérifier l'authentification
  if (false) {
    // Code mort - à supprimer
    const params = new URLSearchParams("");
    const keys = Array.from(params.keys());
    logger.log("� Paramètres:", keys.join(", "));

    orderId = params.get("orderId") || undefined;
    paymentMethod = params.get("paymentMethod") || undefined;
    acceptTerms = params.get("acceptTerms") === "on";

    logger.log("✅ Données extraites:", {
      orderId,
      paymentMethod,
      acceptTerms,
    });
  } // Fin du if(false) - code mort supprimé

  // Vérification authentification suit immédiatement
  if (false) {
    logger.log("mort");
  }
  if (false) {
    try {
      logger.log("mort");

      // Créer une promesse avec timeout pour éviter de bloquer indéfiniment
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                "⏱️ Timeout: la lecture du body a pris plus de 3 secondes",
              ),
            ),
          3000,
        );
      });

      const bodyPromise = request.text();

      const bodyText = await Promise.race([bodyPromise, timeoutPromise]);
      logger.log("✅ Body text reçu (length:", bodyText.length, "):", bodyText);

      // Parser manuellement les données URL-encoded
      const params = new URLSearchParams(bodyText);
      const keys = Array.from(params.keys());
      logger.log("📋 Nombre de paramètres:", keys.length);
      logger.log("📋 Clés:", keys);

      orderId = params.get("orderId") || undefined;
      logger.log("✅ orderId extrait:", orderId);

      paymentMethod = params.get("paymentMethod") || undefined;
      logger.log("✅ paymentMethod extrait:", paymentMethod);

      acceptTerms = params.get("acceptTerms") === "on";
      logger.log("✅ acceptTerms extrait:", acceptTerms);
    } catch (err: unknown) {
      logger.error("❌ Erreur lecture body:", err);

      let errorMessage: string;
      let errorType: string;
      let errorStack: string;

      const error = err as Error;
      if (error instanceof Error) {
        errorMessage = error.message;
        errorType = error.constructor.name;
        errorStack = error.stack || "no stack";

        logger.error("❌ Type erreur:", errorType);
        logger.error("❌ Message:", errorMessage);
        logger.error("❌ Stack:", errorStack);

        // Si c'est un timeout, message spécifique
        if (error.message.includes("Timeout")) {
          return json<ActionData>(
            {
              error:
                "Le serveur met trop de temps à répondre. Veuillez recharger la page et réessayer, ou redémarrer le serveur de développement.",
            },
            { status: 504 },
          );
        }
      } else {
        errorMessage = String(err);
        errorType = typeof err;
        errorStack = "no stack";

        logger.error("❌ Type erreur:", errorType);
        logger.error("❌ Message:", errorMessage);
      }

      return json<ActionData>(
        {
          error:
            "Erreur lors de la lecture des données du formulaire: " +
            errorMessage,
        },
        { status: 400 },
      );
    }
  }

  logger.log("📝 Données complètes reçues:", {
    orderId,
    paymentMethod,
    acceptTerms,
  });

  // Guest checkout: auth optionnelle (l'email est sur la commande)
  logger.log("🔐 Vérification authentification (optionnelle)...");
  let user: any = null;
  try {
    const cookieHeader = request.headers.get("Cookie") || "";
    const sessionRes = await fetch("http://127.0.0.1:3000/api/auth/me", {
      headers: { Cookie: cookieHeader },
    });
    if (sessionRes.ok) {
      const sessionData = await sessionRes.json();
      user = sessionData.user || sessionData.data || null;
    }
    logger.log("🔐 Utilisateur:", user?.id || "guest (sans session)");
  } catch (authError) {
    logger.log("🔐 Auth check echoue, continue en mode guest");
  }

  if (!orderId || !paymentMethod) {
    logger.error("❌ Données manquantes:", { orderId, paymentMethod });
    return json<ActionData>(
      { error: "Données de paiement manquantes" },
      { status: 400 },
    );
  }

  if (!acceptTerms) {
    return json<ActionData>(
      { error: "Vous devez accepter les conditions générales" },
      { status: 400 },
    );
  }

  try {
    // ✅ Phase 7: Récupérer les infos de la commande pour obtenir le montant total avec consignes
    const backendUrl = getInternalApiUrl("");
    logger.log(
      "🔍 Fetching order details from:",
      `${backendUrl}/api/orders/${orderId}`,
    );

    const orderResponse = await fetch(`${backendUrl}/api/orders/${orderId}`, {
      headers: {
        Cookie: request.headers.get("Cookie") || "",
        "Internal-Call": "true",
      },
    });

    logger.log("📦 Order response status:", orderResponse.status);

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      logger.error("❌ Order fetch failed:", errorText);
      throw new Error("Impossible de récupérer la commande");
    }

    const orderData = await orderResponse.json();
    const orderDetails = orderData.data;
    logger.log("✅ Order details fetched successfully");

    const totalAmount = parseFloat(orderDetails.ord_total_ttc || "0");
    const consigneTotal = parseFloat(orderDetails.ord_deposit_ttc || "0");

    // ✅ Récupérer les infos client depuis la commande
    const customerName = orderDetails.customer
      ? `${orderDetails.customer.cst_fname || ""} ${orderDetails.customer.cst_name || ""}`.trim()
      : `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Client";

    const customerEmail = orderDetails.customer?.cst_mail || user?.email || "";

    logger.log("💰 Payment amounts:", {
      totalAmount,
      consigneTotal,
      customerName,
      customerEmail,
    });

    logger.log("💳 Calling initializePayment with:", {
      orderId,
      userId: user?.id || "guest",
      paymentMethod,
      amount: totalAmount,
      consigneTotal,
      customerName,
      customerEmail,
    });

    // Construire l'URL de base depuis la requête
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    logger.log("🔗 Base URL détectée:", baseUrl);

    // Initialiser le paiement côté serveur
    const paymentData = await initializePayment({
      orderId,
      userId: user?.id || "guest",
      paymentMethod,
      amount: totalAmount, // ✅ Phase 7: Montant total incluant consignes
      consigneTotal, // ✅ Phase 7: Montant des consignes
      customerName, // ✅ Nom complet du client
      customerEmail, // ✅ Email du client
      returnUrl: `${baseUrl}/checkout-payment-return`,
      baseUrl, // ✅ Passer le baseUrl pour les callbacks
      ipAddress:
        request.headers.get("X-Forwarded-For") ||
        request.headers.get("X-Real-IP") ||
        "unknown",
    });

    logger.log("✅ Payment initialized:", paymentData);

    // Redirection vers la page de traitement du paiement
    if (paymentData.redirectUrl) {
      return redirect(paymentData.redirectUrl);
    }

    return redirect(`/checkout-payment-process/${paymentData.transactionId}`);
  } catch (error) {
    // Propager les Response HTTP (404, etc.) telles quelles
    if (error instanceof Response) {
      throw error;
    }
    logger.error("❌ Payment initialization failed:", error);
    return json<ActionData>(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de l'initialisation du paiement",
      },
      { status: 500 },
    );
  }
}

export default function PaymentPage() {
  const { order, user, paymentMethods } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const formRef = useRef<HTMLFormElement>(null);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 📊 GA4: Tracker l'info paiement (une seule fois au montage)
  useEffect(() => {
    trackAddPaymentInfo(order.totalTTC || 0, "card");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handler pour soumettre avec fetch + header X-Fetch-Body
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    logger.log("🚀 handleSubmit called");

    if (!acceptedTerms) {
      logger.log("❌ Terms not accepted");
      toast.error("Conditions générales requises", {
        description: "Vous devez accepter les CGV pour continuer",
        duration: 4000,
      });
      return;
    }

    logger.log("✅ Terms accepted, preparing payment...");
    setIsProcessing(true);

    try {
      logger.log("🔵 Redirecting directly to Paybox...");

      // ✅ OPTIMISATION: Redirection directe vers Paybox (pas de création de paiement préalable)
      // Le paiement sera créé au retour du callback Paybox

      // ✅ Utiliser l'email du client ou celui de l'utilisateur connecté en fallback
      const customerEmail = order.customerEmail || user?.email || "";

      if (!customerEmail) {
        logger.error("❌ No customer email available");
        toast.error("Email requis", {
          description: "Aucun email client disponible",
          duration: 4000,
        });
        setIsProcessing(false);
        return;
      }

      const redirectUrl = `/api/paybox/redirect?orderId=${encodeURIComponent(order.id)}&amount=${encodeURIComponent(order.totalTTC)}&email=${encodeURIComponent(customerEmail)}`;

      logger.log("🚀 Redirect URL:", redirectUrl);
      logger.log("📧 Customer email:", customerEmail);

      toast.loading("Redirection vers le paiement...", { duration: 2000 });
      window.location.href = redirectUrl;
    } catch (error) {
      // Propager les Response HTTP (404, etc.) telles quelles
      if (error instanceof Response) {
        throw error;
      }
      logger.error("❌ ERROR:", error);
      toast.error("Erreur de paiement", {
        description: String(error),
        duration: 5000,
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="mx-auto w-full max-w-7xl px-page py-8">
        {/* Header avec stepper + breadcrumb */}
        <div className="mb-8">
          <CheckoutStepper current="payment" />
          <nav className="flex items-center gap-2 text-sm text-slate-600 mb-4">
            <Link to="/cart" className="hover:text-blue-600 transition-colors">
              Panier
            </Link>
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
                d="M9 5l7 7-7 7"
              />
            </svg>
            <Link
              to="/checkout"
              className="hover:text-blue-600 transition-colors"
            >
              Finalisation
            </Link>
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
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span className="text-slate-900 font-medium">Paiement</span>
          </nav>

          <div className="flex items-center gap-4 mb-2">
            <div className="flex-shrink-0 w-12 h-12 bg-navy rounded-2xl flex items-center justify-center shadow-lg">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
                Paiement sécurisé
              </h1>
              <p className="text-slate-600 mt-1">
                Commande #{order.orderNumber}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Récapitulatif commande - Version collapsible */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Header collapsible */}
              <button
                type="button"
                onClick={() => setIsOrderDetailsOpen(!isOrderDetailsOpen)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
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
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-semibold text-slate-900">
                      Commande #{order.orderNumber}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {order.items.length} article
                      {order.items.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-bold text-cta text-xl">
                    {formatPrice(order.totalTTC)}
                  </span>
                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOrderDetailsOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Contenu collapsible */}
              <div
                className={`transition-all duration-300 ease-in-out ${
                  isOrderDetailsOpen
                    ? "max-h-[2000px] opacity-100"
                    : "max-h-0 opacity-0"
                } overflow-hidden`}
              >
                <div className="px-6 pb-6 pt-2 border-t border-slate-100">
                  <div className="space-y-3">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex-shrink-0 w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-slate-400"
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
                          <h3 className="font-medium text-slate-900 text-sm">
                            {item.name}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            {item.quantity} × {formatPrice(item.price)}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="font-semibold text-slate-900 text-sm">
                            {formatPrice(item.total)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sécurité */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-emerald-600"
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
                  <h3 className="font-semibold text-emerald-900 mb-2">
                    Paiement 100% sécurisé
                  </h3>
                  <p className="text-sm text-emerald-700">
                    Vos informations de paiement sont chiffrées selon les normes
                    bancaires. Nous ne stockons jamais vos données bancaires.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                      SSL/TLS
                    </span>
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                      PCI DSS
                    </span>
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                      3D Secure
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Totaux et Formulaire de paiement */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-8 space-y-6">
              {/* Totaux */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-4">
                  Montant à payer
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Sous-total HT</span>
                    <span className="font-medium text-slate-900">
                      {formatPrice(order.subtotalHT)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">TVA (20%)</span>
                    <span className="font-medium text-slate-900">
                      {formatPrice(order.tva)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Frais de port</span>
                    <span className="font-medium text-slate-900">
                      {formatPrice(order.shippingFee)}
                    </span>
                  </div>

                  {/* Consignes */}
                  {order.consigneTotal && order.consigneTotal > 0 && (
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
                        {formatPrice(order.consigneTotal)}
                      </span>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-200">
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-slate-900">
                        Total TTC
                      </span>
                      <span className="font-bold text-cta text-2xl">
                        {formatPrice(order.totalTTC)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6">
                {/* Affichage des erreurs */}
                {actionData?.error && (
                  <div className="rounded-xl p-4 mb-4 bg-red-50 border border-red-200">
                    <div className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
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
                        <h3 className="font-semibold text-red-900">Erreur</h3>
                        <p className="text-sm text-red-700 mt-1">
                          {actionData.error}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <form
                  ref={formRef}
                  onSubmit={handleSubmit}
                  className="space-y-6"
                >
                  <input type="hidden" name="orderId" value={order.id} />

                  <div>
                    <h3 className="font-semibold text-slate-900 mb-4">
                      Méthode de paiement
                    </h3>

                    <div className="space-y-3">
                      {paymentMethods
                        .filter((method) => method.enabled)
                        .map((method) => (
                          <label
                            key={method.id}
                            className="relative flex items-center p-4 border-2 border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-info/20/50 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all"
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value={method.id}
                              required
                              defaultChecked={method.isDefault}
                              className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-slate-300"
                            />
                            <div className="ml-4 flex items-center gap-3">
                              <div className="w-12 h-8 bg-white rounded flex items-center justify-center border border-slate-200">
                                <img
                                  src={method.logo}
                                  alt={method.name}
                                  className="h-6 w-auto object-contain"
                                />
                              </div>
                              <div>
                                <div className="font-medium text-slate-900">
                                  {method.name}
                                </div>
                                <div className="text-sm text-slate-500">
                                  {method.description}
                                </div>
                              </div>
                            </div>
                          </label>
                        ))}
                    </div>
                  </div>

                  {/* Conditions générales */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="acceptTerms"
                        required
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded mt-0.5"
                      />
                      <span className="text-sm text-slate-700">
                        J'accepte les{" "}
                        <a
                          href="/support/cgv"
                          target="_blank"
                          className="text-blue-600 hover:underline font-medium"
                        >
                          conditions générales de vente
                        </a>{" "}
                        et la{" "}
                        <a
                          href="/support/privacy"
                          target="_blank"
                          className="text-blue-600 hover:underline font-medium"
                        >
                          politique de confidentialité
                        </a>
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full bg-cta hover:bg-cta-hover text-white py-4 px-6 rounded-xl font-semibold shadow-lg shadow-cta/30 hover:shadow-xl hover:shadow-cta/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-3"
                  >
                    {isProcessing ? (
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
                        <span>Traitement en cours...</span>
                      </>
                    ) : (
                      <>
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
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                        <span>Procéder au paiement sécurisé</span>
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
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
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
