/**
 * 🛍️ CHECKOUT PAGE - Finalisation de commande
 * Route simple pour créer une commande depuis le panier
 */

import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Alert } from '~/components/ui/alert';
import { Form, useLoaderData, useNavigation, useActionData, Link } from "@remix-run/react";
import { getCart } from "../services/cart.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Vérifier si l'utilisateur est connecté en vérifiant le panier
  // (qui nécessite une session active)
  
  try {
    const cartData = await getCart(request);
    
    // Si panier vide, rediriger vers le panier
    if (!cartData.items || cartData.items.length === 0) {
      return redirect('/cart');
    }
    
    return json({ 
      cart: cartData,
      success: true 
    });
  } catch (error) {
    console.error("Erreur chargement checkout:", error);
    return json({ 
      cart: null, 
      success: false,
      error: "Erreur lors du chargement"
    }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    // 1. Récupérer le panier
    const cartResponse = await fetch('http://localhost:3000/api/cart', {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    });

    if (!cartResponse.ok) {
      throw new Error('Impossible de récupérer le panier');
    }

    const cartData = await cartResponse.json();
    
    if (!cartData.items || cartData.items.length === 0) {
      throw new Error('Le panier est vide');
    }

    // 2. Transformer les items du panier en lignes de commande
    // ✅ Phase 5: Inclure les consignes dans les lignes de commande
    const orderLines = cartData.items.map((item: any) => ({
      productId: String(item.product_id),
      productName: item.product_name || 'Produit',
      productReference: item.product_sku || String(item.product_id),
      quantity: item.quantity,
      unitPrice: item.price,
      vatRate: 20, // TVA par défaut
      discount: 0,
      consigne_unit: item.consigne_unit || 0, // ✅ Phase 5: Consigne unitaire
      has_consigne: item.has_consigne || false, // ✅ Phase 5: Produit avec consigne
    }));

    // 3. Créer la commande avec données structurées
    const orderPayload = {
      customerId: cartData.metadata?.user_id || 0, // sera récupéré côté backend
      orderLines,
      billingAddress: {
        civility: 'M.',
        firstName: 'Test',
        lastName: 'User',
        address: 'Adresse à compléter',
        zipCode: '75000',
        city: 'Paris',
        country: 'France'
      },
      shippingAddress: {
        civility: 'M.',
        firstName: 'Test',
        lastName: 'User',
        address: 'Adresse à compléter',
        zipCode: '75000',
        city: 'Paris',
        country: 'France'
      },
      customerNote: 'Commande créée depuis le checkout',
      shippingMethod: 'standard'
    };

    const response = await fetch('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('Cookie') || '',
      },
      body: JSON.stringify(orderPayload)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erreur serveur' }));
      throw new Error(error.message || 'Erreur lors de la création de la commande');
    }

    const order = await response.json();
    
    // ✅ Phase 7: Retourner l'orderId à l'action data pour redirection côté client
    // L'API retourne un objet avec ord_id (format BDD)
    console.log('📦 Réponse API création commande:', JSON.stringify(order, null, 2));
    
    const orderId = order.ord_id || order.order_id || order.id;
    console.log('🔍 orderId extrait:', orderId);
    
    if (!orderId || orderId === 'créé') {
      // Fallback si on n'a pas l'ID
      console.log('✅ Commande créée sans ID, redirection vers la liste des commandes');
      return json({ 
        success: true,
        redirectTo: '/account/orders?created=true'
      });
    }
    
    const redirectUrl = `/checkout-payment?orderId=${orderId}`;
    console.log(`✅ Commande ${orderId} créée, préparation redirection vers: ${redirectUrl}`);
    // ✅ Retourner l'orderId pour redirection côté client (workaround pour monorepo)
    return json({ 
      success: true,
      orderId,
      redirectTo: redirectUrl
    });
    
  } catch (error) {
    console.error("❌ Erreur création commande:", error);
    console.error("❌ Stack:", error instanceof Error ? error.stack : 'No stack');
    return json({ 
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue"
    }, { status: 500 });
  }
}

export default function CheckoutPage() {
  const data = useLoaderData<typeof loader>();
  const { cart, success } = data;
  const loaderError = 'error' in data ? data.error : undefined;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  
  console.log('🔍 CheckoutPage render, actionData:', actionData ? 'present' : 'null');
  
  // Erreur peut venir du loader ou de l'action
  const error = loaderError || (actionData && 'error' in actionData ? actionData.error : undefined);
  
  // ✅ Redirection immédiate après succès - AVANT tout rendu
  if (actionData && 'redirectTo' in actionData && actionData.redirectTo) {
    const redirectUrl = actionData.redirectTo;
    const orderId = 'orderId' in actionData ? String(actionData.orderId) : null;
    
    // Afficher un loader avec redirection automatique via meta refresh
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <head>
          <meta httpEquiv="refresh" content={`0;url=${redirectUrl}`} />
        </head>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-gray-700">Redirection vers le paiement...</p>
          {orderId && (
            <p className="text-sm text-gray-500 mt-2">Commande #{orderId} créée</p>
          )}
          <p className="text-xs text-gray-400 mt-4">
            Si vous n'êtes pas redirigé automatiquement,{' '}
            <a href={redirectUrl} className="text-blue-600 hover:underline">
              cliquez ici
            </a>
          </p>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.location.replace('${redirectUrl}');`,
          }}
        />
      </div>
    );
  }

  if (!success || !cart) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p>{error || "Erreur lors du chargement"}</p>
          </div>
          <Link to="/cart" className="mt-4 inline-block text-blue-600 hover:underline">
            ← Retour au panier
          </Link>
        </div>
      </div>
    );
  }

  const total = cart.summary.total_price || 
    (cart.summary.subtotal + cart.summary.tax_amount + cart.summary.shipping_cost);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Header avec breadcrumb */}
        <div className="mb-8">
          <nav className="flex items-center gap-2 text-sm text-slate-600 mb-4">
            <Link to="/cart" className="hover:text-blue-600 transition-colors">Panier</Link>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-slate-900 font-medium">Finalisation</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-slate-400">Paiement</span>
          </nav>
          
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
            Finaliser ma commande
          </h1>
          <p className="text-slate-600 mt-2">Vérifiez votre commande avant de continuer</p>
        </div>

        {/* Affichage erreur si action a échoué */}
        {error && (
          <div className="mb-6 rounded-xl border border-destructive bg-destructive/10 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Erreur lors de la création de la commande</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">{/* Informations client */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Informations de livraison</h2>
                  <p className="text-sm text-slate-500">Récupérées automatiquement</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-slate-600 text-sm">
                  ✓ Vos informations de livraison et de facturation seront récupérées automatiquement depuis votre profil lors de la validation de la commande.
                </p>
              </div>
            </div>

            {/* Résumé panier */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Récapitulatif de la commande</h2>
                  <p className="text-sm text-slate-500">{cart.items.length} article{cart.items.length > 1 ? 's' : ''}</p>
                </div>
              </div>
              
              <div className="space-y-4 mb-6">
                {cart.items.map((item: any) => (
                  <div key={item.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex-shrink-0 w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                      <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 truncate">{item.product_name}</h3>
                      <p className="text-sm text-slate-500 mt-1">Quantité: {item.quantity}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="font-semibold text-slate-900">{(item.price * item.quantity).toFixed(2)}€</p>
                      <p className="text-xs text-slate-500 mt-1">{item.price.toFixed(2)}€ / unité</p>
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
                  <span className="font-medium text-slate-900">{cart.summary.subtotal.toFixed(2)}€</span>
                </div>
                
                {cart.summary.shipping_cost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Livraison</span>
                    <span className="font-medium text-slate-900">{cart.summary.shipping_cost.toFixed(2)}€</span>
                  </div>
                )}
                
                {cart.summary.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">TVA (20%)</span>
                    <span className="font-medium text-slate-900">{cart.summary.tax_amount.toFixed(2)}€</span>
                  </div>
                )}
                
                {/* ✅ Afficher les consignes */}
                {(() => {
                  const consignesTotal = cart.items.reduce((sum: number, item: any) => {
                    if (item.has_consigne && item.consigne_unit) {
                      return sum + (item.quantity * item.consigne_unit);
                    }
                    return sum;
                  }, 0);
                  
                  if (consignesTotal > 0) {
                    return (
                      <div className="flex justify-between text-sm bg-amber-50 -mx-6 px-6 py-3 border-y border-amber-100">
                        <span className="flex items-center gap-2 text-amber-700 font-medium">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          Consignes
                        </span>
                        <span className="font-semibold text-amber-700">{consignesTotal.toFixed(2)}€</span>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                <div className="pt-3 border-t border-slate-200">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-900 text-lg">Total</span>
                    <span className="font-bold text-blue-600 text-2xl">{total.toFixed(2)}€</span>
                  </div>
                </div>
              </div>

              {/* Info consignes */}
              {cart.items.some((item: any) => item.has_consigne) && (
                <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-xs text-amber-800">
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Les consignes seront remboursées lors du retour des pièces usagées
                  </p>
                </div>
              )}

              <Form method="post" className="mt-6 space-y-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 px-6 rounded-xl font-semibold shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Création en cours...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirmer la commande</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>

                <Link
                  to="/cart"
                  className="w-full inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-6 rounded-xl font-medium transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Retour au panier</span>
                </Link>
              </Form>

<Alert className="mt-6 p-4  rounded-xl" variant="info">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-blue-800">
                    En confirmant votre commande, vous serez redirigé vers la page de paiement sécurisé. Aucun paiement ne sera effectué à cette étape.
                  </p>
                </div>
              </Alert>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
