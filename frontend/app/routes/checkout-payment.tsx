import { type ActionFunctionArgs, type LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation, useActionData, Link } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { requireAuth } from "../auth/unified.server";
import { initializePayment, getAvailablePaymentMethods } from "../services/payment.server";
import { type PaymentMethod, type OrderSummary } from "../types/payment";

interface LoaderData {
  order: OrderSummary;
  user: any;
  paymentMethods: PaymentMethod[];
}

interface ActionData {
  error?: string;
  cyberplus?: boolean;
  formData?: Record<string, string>;
  gatewayUrl?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");

  if (!orderId) {
    return redirect("/cart");
  }

  try {
    // ✅ Phase 7: Récupérer la vraie commande depuis l'API
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const orderResponse = await fetch(`${backendUrl}/api/orders/${orderId}`, {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
        'Internal-Call': 'true',
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

    console.log('📦 Order details from API:', JSON.stringify(orderDetails, null, 2));

    // Mapper les lignes de commande (lines) vers items
    const items = (orderDetails.lines || []).map((line: any) => ({
      id: line.orl_id,
      name: line.orl_pg_name || 'Produit',
      quantity: parseInt(line.orl_art_quantity || '1'),
      price: parseFloat(line.orl_art_price_sell_unit_ttc || '0'),
      total: parseFloat(line.orl_art_price_sell_ttc || '0'),
      image: '/placeholder-product.png', // TODO: ajouter l'image
    }));

    // Transformer les données de la commande pour l'interface OrderSummary
    const order: OrderSummary = {
      id: orderDetails.ord_id,
      orderNumber: orderDetails.ord_id,
      status: parseInt(orderDetails.ord_is_pay || '0'),
      items,
      subtotalHT: parseFloat(orderDetails.ord_amount_ttc || '0') / 1.2, // Approximation
      tva: parseFloat(orderDetails.ord_amount_ttc || '0') * 0.2 / 1.2, // 20% de la base HT
      shippingFee: parseFloat(orderDetails.ord_shipping_fee_ttc || '0'),
      totalTTC: parseFloat(orderDetails.ord_total_ttc || '0'),
      currency: 'EUR',
      // ✅ Phase 7: Récupérer le montant des consignes
      consigneTotal: parseFloat(orderDetails.ord_deposit_ttc || '0'),
    };

    console.log('✅ Order transformed:', order);

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
    console.error("❌ Error loading payment page:", error);
    throw new Response("Erreur lors du chargement", { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  const formData = await request.formData();
  const orderId = formData.get("orderId") as string;
  const paymentMethod = formData.get("paymentMethod") as string;
  const acceptTerms = formData.get("acceptTerms") as string;

  if (!orderId || !paymentMethod) {
    return json<ActionData>(
      { error: "Données manquantes" },
      { status: 400 }
    );
  }

  if (!acceptTerms) {
    return json<ActionData>(
      { error: "Vous devez accepter les conditions générales" },
      { status: 400 }
    );
  }

  try {
    // ✅ Phase 7: Récupérer les infos de la commande pour obtenir le montant total avec consignes
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const orderResponse = await fetch(`${backendUrl}/api/orders/${orderId}`, {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
        'Internal-Call': 'true',
      },
    });

    if (!orderResponse.ok) {
      throw new Error('Impossible de récupérer la commande');
    }

    const orderData = await orderResponse.json();
    const orderDetails = orderData.data;
    
    const totalAmount = parseFloat(orderDetails.ord_total_ttc || '0');
    const consigneTotal = parseFloat(orderDetails.ord_deposit_ttc || '0');

    // Initialiser le paiement côté serveur
    const paymentData = await initializePayment({
      orderId,
      userId: user.id,
      paymentMethod,
      amount: totalAmount, // ✅ Phase 7: Montant total incluant consignes
      consigneTotal, // ✅ Phase 7: Montant des consignes
      returnUrl: `${process.env.BASE_URL}/checkout-payment-return`,
      ipAddress: request.headers.get("X-Forwarded-For") || 
                 request.headers.get("X-Real-IP") || 
                 "unknown",
    });

    if (paymentMethod === "CYBERPLUS" && paymentData.formData && paymentData.gatewayUrl) {
      // Retourner les données pour le formulaire Cyberplus
      return json<ActionData>({
        cyberplus: true,
        formData: paymentData.formData,
        gatewayUrl: paymentData.gatewayUrl,
      });
    }

    // Autres méthodes de paiement - redirection directe
    if (paymentData.redirectUrl) {
      return redirect(paymentData.redirectUrl);
    }

    return redirect(`/checkout-payment-process/${paymentData.transactionId}`);
  } catch (error) {
    console.error("❌ Payment initialization failed:", error);
    return json<ActionData>(
      { 
        error: error instanceof Error ? error.message : "Erreur lors de l'initialisation du paiement"
      },
      { status: 500 }
    );
  }
}

export default function PaymentPage() {
  const { order, paymentMethods } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const formRef = useRef<HTMLFormElement>(null);
  const cyberplusFormRef = useRef<HTMLFormElement>(null);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);

  console.log('💳 PaymentPage render, order:', order.id, 'items:', order.items.length);

  const isProcessing = navigation.state === "submitting";

  // Auto-submit du formulaire Cyberplus si on a les données
  useEffect(() => {
    if (actionData?.cyberplus && actionData.formData && cyberplusFormRef.current) {
      cyberplusFormRef.current.submit();
    }
  }, [actionData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Header avec breadcrumb */}
        <div className="mb-8">
          <nav className="flex items-center gap-2 text-sm text-slate-600 mb-4">
            <Link to="/cart" className="hover:text-blue-600 transition-colors">Panier</Link>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <Link to="/checkout" className="hover:text-blue-600 transition-colors">Finalisation</Link>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-slate-900 font-medium">Paiement</span>
          </nav>
          
          <div className="flex items-center gap-4 mb-2">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
                Paiement sécurisé
              </h1>
              <p className="text-slate-600 mt-1">Commande #{order.orderNumber}</p>
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
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-semibold text-slate-900">
                        Commande #{order.orderNumber}
                      </h2>
                      <p className="text-sm text-slate-500">{order.items.length} article{order.items.length > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-blue-600 text-xl">
                      {formatPrice(order.totalTTC)}
                    </span>
                    <svg 
                      className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOrderDetailsOpen ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Contenu collapsible */}
                <div 
                  className={`transition-all duration-300 ease-in-out ${
                    isOrderDetailsOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                  } overflow-hidden`}
                >
                  <div className="px-6 pb-6 pt-2 border-t border-slate-100">
                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                          <div className="flex-shrink-0 w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-slate-900 text-sm">{item.name}</h3>
                            <p className="text-xs text-slate-500 mt-1">
                              {item.quantity} × {formatPrice(item.price)}
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="font-semibold text-slate-900 text-sm">{formatPrice(item.total)}</p>
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
                    <svg className="h-6 w-6 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-emerald-900 mb-2">
                      Paiement 100% sécurisé
                    </h3>
                    <p className="text-sm text-emerald-700">
                      Vos informations de paiement sont chiffrées selon les normes bancaires.
                      Nous ne stockons jamais vos données bancaires.
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">SSL/TLS</span>
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">PCI DSS</span>
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">3D Secure</span>
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
                  <h3 className="font-semibold text-slate-900 mb-4">Montant à payer</h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Sous-total HT</span>
                      <span className="font-medium text-slate-900">{formatPrice(order.subtotalHT)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">TVA (20%)</span>
                      <span className="font-medium text-slate-900">{formatPrice(order.tva)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Frais de port</span>
                      <span className="font-medium text-slate-900">{formatPrice(order.shippingFee)}</span>
                    </div>
                    
                    {/* Consignes */}
                    {order.consigneTotal && order.consigneTotal > 0 && (
                      <div className="flex justify-between text-sm bg-amber-50 -mx-6 px-6 py-3 border-y border-amber-100">
                        <span className="flex items-center gap-2 text-amber-700 font-medium">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          Consignes
                        </span>
                        <span className="font-semibold text-amber-700">{formatPrice(order.consigneTotal)}</span>
                      </div>
                    )}
                    
                    <div className="pt-3 border-t border-slate-200">
                      <div className="flex justify-between items-baseline">
                        <span className="font-bold text-slate-900">Total TTC</span>
                        <span className="font-bold text-blue-600 text-2xl">{formatPrice(order.totalTTC)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6">
              
                                {/* Affichage des erreurs */}
                  {actionData?.error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <h3 className="font-semibold text-red-900">Erreur</h3>
                          <p className="text-sm text-red-700 mt-1">{actionData.error}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <Form ref={formRef} method="post" className="space-y-6">
                    <input type="hidden" name="orderId" value={order.id} />
                    
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-4">Méthode de paiement</h3>
                      
                      <div className="space-y-3">
                        {paymentMethods
                          .filter(method => method.enabled)
                          .map((method) => (
                          <label 
                            key={method.id} 
                            className="relative flex items-center p-4 border-2 border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all"
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
                          </a>
                          {" "}et la{" "}
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
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white py-4 px-6 rounded-xl font-semibold shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-3"
                    >
                      {isProcessing ? (
                        <>
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Traitement en cours...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span>Procéder au paiement sécurisé</span>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
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

      {/* Formulaire Cyberplus auto-submit (caché) */}
      {actionData && actionData.cyberplus && actionData.formData && actionData.gatewayUrl && (
        <form
          ref={cyberplusFormRef}
          method="POST"
          action={actionData.gatewayUrl}
          style={{ display: 'none' }}
        >
          {Object.entries(actionData.formData).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        </form>
      )}
    </div>
  );
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}
