import { type ActionFunctionArgs, type LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation, useActionData } from "@remix-run/react";
import { useEffect, useRef } from "react";
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
      returnUrl: `${process.env.BASE_URL}/checkout/payment/return`,
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

    return redirect(`/checkout/payment/process/${paymentData.transactionId}`);
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

  console.log('💳 PaymentPage render, order:', order.id, 'items:', order.items.length);

  const isProcessing = navigation.state === "submitting";

  // Auto-submit du formulaire Cyberplus si on a les données
  useEffect(() => {
    if (actionData?.cyberplus && actionData.formData && cyberplusFormRef.current) {
      cyberplusFormRef.current.submit();
    }
  }, [actionData]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4">
            <h1 className="text-2xl font-bold text-white">
              Paiement de votre commande
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
            
            {/* Récapitulatif commande */}
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Commande #{order.orderNumber}
                </h2>
                
                <div className="space-y-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-4">
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{item.name}</h3>
                        <p className="text-sm text-gray-500">
                          {item.quantity} x {formatPrice(item.price)}
                        </p>
                      </div>
                      <div className="font-medium text-gray-900">
                        {formatPrice(item.total)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 mt-6 pt-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sous-total HT</span>
                    <span>{formatPrice(order.subtotalHT)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>TVA (20%)</span>
                    <span>{formatPrice(order.tva)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Frais de port</span>
                    <span>{formatPrice(order.shippingFee)}</span>
                  </div>
                  {/* ✅ Phase 7: Afficher les consignes si présentes */}
                  {order.consigneTotal && order.consigneTotal > 0 && (
                    <div className="flex justify-between text-sm text-amber-600 font-medium">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Consignes (remboursables)
                      </span>
                      <span>{formatPrice(order.consigneTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-lg border-t border-gray-200 pt-2">
                    <span>Total TTC</span>
                    <span>{formatPrice(order.totalTTC)}</span>
                  </div>
                </div>
              </div>

              {/* Sécurité */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-green-800">
                      Paiement sécurisé
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-green-700">
                  Vos informations de paiement sont sécurisées et cryptées.
                  Nous ne stockons jamais vos données bancaires.
                </p>
              </div>
            </div>

            {/* Formulaire de paiement */}
            <div className="space-y-6">
              
              {/* Affichage des erreurs */}
              {actionData?.error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Erreur
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        {actionData.error}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Form ref={formRef} method="post" className="space-y-6">
                <input type="hidden" name="orderId" value={order.id} />
                
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Choisissez votre méthode de paiement
                  </h2>
                  
                  <div className="space-y-3">
                    {paymentMethods
                      .filter(method => method.enabled)
                      .map((method) => (
                      <label 
                        key={method.id} 
                        className="relative flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500"
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.id}
                          required
                          defaultChecked={method.isDefault}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <div className="ml-4 flex items-center space-x-3">
                          <img 
                            src={method.logo} 
                            alt={method.name}
                            className="h-8 w-auto"
                          />
                          <div>
                            <div className="font-medium text-gray-900">
                              {method.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {method.description}
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Conditions générales */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      name="acceptTerms"
                      required
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                    />
                    <span className="text-sm text-gray-700">
                      J'accepte les{" "}
                      <a 
                        href="/support/cgv" 
                        target="_blank"
                        className="text-blue-600 hover:underline"
                      >
                        conditions générales de vente
                      </a>
                      {" "}et la{" "}
                      <a 
                        href="/support/privacy" 
                        target="_blank"
                        className="text-blue-600 hover:underline"
                      >
                        politique de confidentialité
                      </a>
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Traitement en cours...
                    </span>
                  ) : (
                    "Procéder au paiement"
                  )}
                </button>
              </Form>
            </div>
          </div>
        </div>
      </div>

      {/* Formulaire Cyberplus auto-submit (caché) */}
      {actionData?.cyberplus && actionData.formData && actionData.gatewayUrl && (
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
