/**
 * 🛍️ CHECKOUT PAGE - Finalisation de commande
 * Route simple pour créer une commande depuis le panier
 */

import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
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
    
    // ✅ Phase 7: Rediriger vers la page de paiement avec l'orderId
    // L'API retourne un objet avec ord_id (format BDD)
    console.log('📦 Réponse API création commande:', JSON.stringify(order, null, 2));
    
    const orderId = order.ord_id || order.order_id || order.id;
    console.log('🔍 orderId extrait:', orderId);
    
    if (!orderId || orderId === 'créé') {
      // Fallback si on n'a pas l'ID
      console.log('✅ Commande créée sans ID, redirection vers la liste des commandes');
      return redirect('/account/orders?created=true');
    }
    
    console.log(`✅ Commande ${orderId} créée, redirection vers paiement`);
    return redirect(`/checkout/payment?orderId=${orderId}`);
    
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
  
  // Erreur peut venir du loader ou de l'action
  const error = loaderError || (actionData && 'error' in actionData ? actionData.error : undefined);
  
  // Debug
  console.log('Checkout - navigation.state:', navigation.state);
  console.log('Checkout - isSubmitting:', isSubmitting);
  console.log('Checkout - actionData:', actionData);

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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">Finaliser ma commande</h1>

        {/* Affichage erreur si action a échoué */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-bold">Erreur lors de la création de la commande</p>
            <p>{error}</p>
          </div>
        )}

        {/* Informations client */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Informations de livraison</h2>
          <p className="text-gray-600">Vos informations seront récupérées automatiquement lors de la commande.</p>
        </div>

        {/* Résumé panier */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Récapitulatif</h2>
          
          <div className="space-y-3 mb-4">
            {cart.items.map((item: any) => (
              <div key={item.id} className="flex justify-between items-center py-2 border-b">
                <div className="flex-1">
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-sm text-gray-600">Quantité: {item.quantity}</p>
                </div>
                <p className="font-semibold">{(item.price * item.quantity).toFixed(2)}€</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-4 border-t">
            <div className="flex justify-between">
              <span>Sous-total</span>
              <span>{cart.summary.subtotal.toFixed(2)}€</span>
            </div>
            {cart.summary.shipping_cost > 0 && (
              <div className="flex justify-between">
                <span>Livraison</span>
                <span>{cart.summary.shipping_cost.toFixed(2)}€</span>
              </div>
            )}
            {cart.summary.tax_amount > 0 && (
              <div className="flex justify-between">
                <span>TVA</span>
                <span>{cart.summary.tax_amount.toFixed(2)}€</span>
              </div>
            )}
            {/* ✅ Phase 7: Afficher les consignes si présentes dans le panier */}
            {(() => {
              const consignesTotal = cart.items.reduce((sum: number, item: any) => {
                if (item.has_consigne && item.consigne_unit) {
                  return sum + (item.quantity * item.consigne_unit);
                }
                return sum;
              }, 0);
              
              if (consignesTotal > 0) {
                return (
                  <div className="flex justify-between text-amber-600 font-medium">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Consignes (remboursables)
                    </span>
                    <span>{consignesTotal.toFixed(2)}€</span>
                  </div>
                );
              }
              return null;
            })()}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span>{total.toFixed(2)}€</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <Form method="post" className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                ℹ️ En cliquant sur "Confirmer la commande", votre commande sera créée.
                Vous pourrez ensuite procéder au paiement depuis votre espace client.
              </p>
            </div>

            <div className="flex gap-4">
              <Link
                to="/cart"
                className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors font-medium text-center"
              >
                ← Retour au panier
              </Link>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <span className="animate-spin mr-2">⏳</span>
                    Création en cours...
                  </span>
                ) : (
                  'Confirmer la commande'
                )}
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
