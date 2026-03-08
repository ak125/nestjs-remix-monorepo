import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  json,
  redirect,
} from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { CheckoutStepper } from "~/components/checkout/CheckoutStepper";
import { Error404 } from "~/components/errors/Error404";
import { trackAddPaymentInfo } from "~/utils/analytics";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { getOptionalUser } from "../auth/unified.server";
import { getAvailablePaymentMethods } from "../services/payment.server";
import { type PaymentMethod, type OrderSummary } from "../types/payment";

export const handle = {
  hideGlobalFooter: true,
  pageRole: createPageRoleMeta(PageRole.RX_CHECKOUT, {
    clusterId: "checkout-payment",
    canonicalEntity: "paiement",
    funnelStage: "decision",
    conversionGoal: "purchase",
  }),
};

export const meta: MetaFunction = () => [
  { title: "Paiement | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/checkout-payment",
  },
];

// -- Types -------------------------------------------------------------------

interface OrderLineFromApi {
  orl_id: string;
  orl_pg_name: string | null;
  orl_pm_name: string | null;
  orl_art_ref: string | null;
  orl_art_quantity: string | null;
  orl_art_price_sell_unit_ttc: string | null;
  orl_art_price_sell_ttc: string | null;
}

interface LoaderData {
  order: OrderSummary;
  user: { id: string; email?: string } | null;
  paymentMethods: PaymentMethod[];
}

interface ActionData {
  error?: string;
  redirectUrl?: string;
}

// -- Loader ------------------------------------------------------------------

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await getOptionalUser({ context });
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");

  if (!orderId) {
    return redirect("/cart");
  }

  try {
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

    logger.log("[Payment] Order loaded:", {
      orderId: orderDetails.ord_id,
      itemCount: orderDetails.lines?.length ?? 0,
      totalTTC: orderDetails.ord_total_ttc,
    });

    const items = (orderDetails.lines || []).map((line: OrderLineFromApi) => ({
      id: line.orl_id,
      name: line.orl_pg_name || "Produit",
      quantity: parseInt(line.orl_art_quantity || "1"),
      price: parseFloat(line.orl_art_price_sell_unit_ttc || "0"),
      total: parseFloat(line.orl_art_price_sell_ttc || "0"),
      image: "/images/categories/default.svg",
      ref: line.orl_art_ref || undefined,
      brand: line.orl_pm_name || undefined,
    }));

    const customerName = orderDetails.customer
      ? `${orderDetails.customer.cst_fname || ""} ${orderDetails.customer.cst_name || ""}`.trim()
      : "";
    const customerEmail = orderDetails.customer?.cst_mail || "";

    const order: OrderSummary = {
      id: orderDetails.ord_id,
      orderNumber: orderDetails.ord_id,
      status: parseInt(orderDetails.ord_is_pay || "0"),
      items,
      subtotalHT: 0,
      tva: 0,
      shippingFee: parseFloat(orderDetails.ord_shipping_fee_ttc || "0"),
      totalTTC: parseFloat(orderDetails.ord_total_ttc || "0"),
      currency: "EUR",
      consigneTotal: parseFloat(orderDetails.ord_deposit_ttc || "0"),
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
    if (error instanceof Response) {
      throw error;
    }
    logger.error("[Payment] Loader error:", error);
    throw new Response("Erreur lors du chargement", { status: 500 });
  }
}

// -- Action ------------------------------------------------------------------

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const orderId = formData.get("orderId") as string;
  const acceptTerms = formData.get("acceptTerms");

  if (!orderId) {
    return json<ActionData>(
      { error: "Commande introuvable." },
      { status: 400 },
    );
  }

  if (acceptTerms !== "on") {
    return json<ActionData>(
      { error: "Vous devez accepter les conditions generales de vente." },
      { status: 400 },
    );
  }

  try {
    const backendUrl = getInternalApiUrl("");
    const orderResponse = await fetch(`${backendUrl}/api/orders/${orderId}`, {
      headers: {
        Cookie: request.headers.get("Cookie") || "",
        "Internal-Call": "true",
      },
    });

    if (!orderResponse.ok) {
      return json<ActionData>(
        { error: "Commande introuvable ou inaccessible." },
        { status: 400 },
      );
    }

    const orderData = await orderResponse.json();
    const orderDetails = orderData.data;

    if (parseInt(orderDetails.ord_is_pay || "0") !== 0) {
      return redirect(`/account/orders/${orderId}`);
    }

    const totalTTC = parseFloat(orderDetails.ord_total_ttc || "0");
    if (totalTTC <= 0) {
      return json<ActionData>(
        { error: "Montant de commande invalide." },
        { status: 400 },
      );
    }

    const customerEmail = orderDetails.customer?.cst_mail || "";
    if (!customerEmail) {
      return json<ActionData>(
        { error: "Email client manquant sur la commande." },
        { status: 400 },
      );
    }

    logger.log("[Payment] Init:", { orderId, totalTTC });

    const redirectUrl = `/api/paybox/redirect?orderId=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(totalTTC)}&email=${encodeURIComponent(customerEmail)}`;

    return json<ActionData>({ redirectUrl });
  } catch (error) {
    logger.error("[Payment] Action error:", error);
    return json<ActionData>(
      { error: "Erreur lors de l'initialisation du paiement." },
      { status: 500 },
    );
  }
}

// -- Component ---------------------------------------------------------------

export default function PaymentPage() {
  const { order, paymentMethods } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isProcessing = navigation.state === "submitting";

  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(
    order.items.length <= 3,
  );
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    trackAddPaymentInfo(order.totalTTC || 0, "card");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (actionData?.redirectUrl) {
      window.location.href = actionData.redirectUrl;
    }
    if (actionData?.error) {
      toast.error(actionData.error);
    }
  }, [actionData]);

  const articleSubtotal =
    order.totalTTC - order.shippingFee - (order.consigneTotal || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="mx-auto w-full max-w-7xl px-page py-8">
        {/* Header */}
        <div className="mb-8">
          <CheckoutStepper current="payment" />

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
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Paiement securise
              </h1>
              <p className="text-slate-600 mt-1">
                Commande #{order.orderNumber}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: Order summary + Security */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order summary (collapsible) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
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
                          {(item.ref || item.brand) && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {[item.ref, item.brand]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
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

            {/* Security block */}
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
                    Paiement 100% securise
                  </h3>
                  <p className="text-sm text-emerald-700">
                    Vos informations de paiement sont chiffrees selon les normes
                    bancaires. Nous ne stockons jamais vos donnees bancaires.
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

          {/* Right column: Totals + Payment form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-8 space-y-6">
              {/* Totals */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-4">
                  Montant a payer
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Sous-total</span>
                    <span className="font-medium text-slate-900">
                      {formatPrice(
                        articleSubtotal > 0 ? articleSubtotal : order.totalTTC,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Frais de port</span>
                    {order.shippingFee > 0 ? (
                      <span className="font-medium text-slate-900">
                        {formatPrice(order.shippingFee)}
                      </span>
                    ) : (
                      <span className="font-medium text-emerald-600">
                        Offerte
                      </span>
                    )}
                  </div>

                  {/* Consignes */}
                  {(order.consigneTotal ?? 0) > 0 ? (
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
                        {formatPrice(order.consigneTotal ?? 0)}
                      </span>
                    </div>
                  ) : null}

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
                <Form method="post" className="space-y-6">
                  <input type="hidden" name="orderId" value={order.id} />

                  <div>
                    <h3 className="font-semibold text-slate-900 mb-4">
                      Methode de paiement
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

                  {/* CGV */}
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
                        J&apos;accepte les{" "}
                        <a
                          href="/legal/cgv"
                          target="_blank"
                          className="text-blue-600 hover:underline font-medium"
                        >
                          conditions generales de vente
                        </a>{" "}
                        et la{" "}
                        <a
                          href="/legal/privacy"
                          target="_blank"
                          className="text-blue-600 hover:underline font-medium"
                        >
                          politique de confidentialite
                        </a>
                      </span>
                    </label>
                  </div>

                  <p className="text-xs text-center text-slate-500">
                    Commande #{order.orderNumber} &middot; {order.items.length}{" "}
                    article
                    {order.items.length > 1 ? "s" : ""} &middot;{" "}
                    {formatPrice(order.totalTTC)}
                  </p>

                  <button
                    type="submit"
                    disabled={isProcessing || !acceptedTerms}
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
                        <span>Proceder au paiement securise</span>
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
                </Form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mini footer transactionnel */}
      <footer className="mt-12 border-t border-slate-200 bg-white py-4">
        <div className="mx-auto max-w-7xl px-page flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>&copy; {new Date().getFullYear()} AutoMecanik</span>
          <div className="flex gap-4">
            <a href="/legal/cgv" className="hover:text-slate-700">
              CGV
            </a>
            <a href="/legal/privacy" className="hover:text-slate-700">
              Confidentialite
            </a>
            <a href="/contact" className="hover:text-slate-700">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

// -- Error Boundary ----------------------------------------------------------

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
