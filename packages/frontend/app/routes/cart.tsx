import { json, LoaderFunctionArgs, ActionFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useFetcher } from "@remix-run/remix";
import { useState } from "react";
import { authService } from "~/services/auth.service";

interface CartItem {
  pieceId: number;
  pieceName: string;
  reference: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  brandName: string;
  brandLogo: string;
  availability: string;
}

interface CartSummary {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  shipping: number;
  total: number;
  currency: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const response = await fetch('http://localhost:3001/cart', {
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur chargement panier');
    }

    const cart: CartSummary = await response.json();
    return json({ cart });
  } catch (error) {
    console.error('Erreur chargement cart:', error);
    return json({ 
      cart: { 
        items: [], 
        totalItems: 0, 
        subtotal: 0, 
        shipping: 0, 
        total: 0, 
        currency: 'EUR' 
      } 
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  try {
    switch (intent) {
      case 'update':
        const itemId = formData.get('itemId') as string;
        const quantity = parseInt(formData.get('quantity') as string);
        
        await fetch(`http://localhost:3001/cart/item/${itemId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authService.getToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ quantity })
        });
        break;

      case 'remove':
        const removeItemId = formData.get('itemId') as string;
        
        await fetch(`http://localhost:3001/cart/item/${removeItemId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authService.getToken()}`
          }
        });
        break;

      case 'clear':
        await fetch('http://localhost:3001/cart/clear', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authService.getToken()}`
          }
        });
        break;

      case 'validate':
        const customerEmail = formData.get('customerEmail') as string;
        const customerName = formData.get('customerName') as string;
        const deliveryAddress = formData.get('deliveryAddress') as string;
        const notes = formData.get('notes') as string;

        const validateResponse = await fetch('http://localhost:3001/cart/validate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authService.getToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerEmail,
            customerName,
            deliveryAddress,
            notes
          })
        });

        if (validateResponse.ok) {
          return redirect('/orders/success');
        }
        break;
    }

    return redirect('/cart');
  } catch (error) {
    console.error('Erreur action cart:', error);
    return json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
}

export default function Cart() {
  const { cart } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const [showCheckout, setShowCheckout] = useState(false);

  const isSubmitting = navigation.state === "submitting" || fetcher.state === "submitting";

  // Si le panier est vide
  if (cart.totalItems === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">My Cart</h1>
          
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <div className="max-w-md mx-auto">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                VOTRE PANIER EST VIDE
              </h2>
              <p className="text-gray-600 mb-6">
                Pour commencer vos achats, c'est par ici...
              </p>
              <a 
                href="/welcome" 
                className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <span className="text-red-500 mr-2">&lt;</span>
                commencer mes achats
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Cart</h1>
            <h2 className="text-lg text-gray-600 mt-1">Search, Select and Buy...</h2>
          </div>
          <div className="text-sm text-gray-600">
            {cart.totalItems} article{cart.totalItems > 1 ? 's' : ''}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    My Cart<br />
                    <strong>list</strong>
                  </h3>
                  <Form method="post">
                    <input type="hidden" name="intent" value="clear" />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Vider le panier
                    </button>
                  </Form>
                </div>
              </div>

              {/* Table Header */}
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="col-span-1 text-center">Brand</div>
                  <div className="col-span-4">Description</div>
                  <div className="col-span-2">Ref.</div>
                  <div className="col-span-1 text-center">UP</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-1 text-center">TP</div>
                  <div className="col-span-1 text-center">Del.</div>
                </div>
              </div>

              {/* Cart Items */}
              <div className="divide-y divide-gray-200">
                {cart.items.map((item, index) => (
                  <div key={`${item.pieceId}-${index}`} className="px-6 py-4">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Brand Logo */}
                      <div className="col-span-1 text-center">
                        {item.brandLogo ? (
                          <img 
                            src={`/upload/equipementiers-automobiles/${item.brandLogo}`}
                            alt={item.brandName}
                            className="max-h-12 mx-auto"
                          />
                        ) : (
                          <div className="text-xs text-gray-500">{item.brandName}</div>
                        )}
                      </div>

                      {/* Description */}
                      <div className="col-span-4">
                        <div className="font-medium text-gray-900">{item.pieceName}</div>
                        <div className="text-sm text-gray-500">{item.availability}</div>
                      </div>

                      {/* Reference */}
                      <div className="col-span-2">
                        <div className="text-sm font-mono text-gray-900">{item.reference}</div>
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-1 text-center">
                        <div className="text-sm font-medium text-gray-900">
                          €{item.unitPrice.toFixed(2)}
                        </div>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-2 text-center">
                        <fetcher.Form method="post" className="flex items-center justify-center space-x-2">
                          <input type="hidden" name="intent" value="update" />
                          <input type="hidden" name="itemId" value={item.pieceId} />
                          <input
                            type="number"
                            name="quantity"
                            min="1"
                            defaultValue={item.quantity}
                            className="w-16 px-2 py-1 text-center border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onChange={(e) => {
                              if (e.target.form) {
                                fetcher.submit(e.target.form);
                              }
                            }}
                          />
                        </fetcher.Form>
                      </div>

                      {/* Total Price */}
                      <div className="col-span-1 text-center">
                        <div className="text-sm font-medium text-gray-900">
                          €{item.totalPrice.toFixed(2)}
                        </div>
                      </div>

                      {/* Delete */}
                      <div className="col-span-1 text-center">
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="remove" />
                          <input type="hidden" name="itemId" value={item.pieceId} />
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="text-red-600 hover:text-red-800 p-1 transition-colors disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </fetcher.Form>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cart Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Résumé de commande</h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span>Sous-total ({cart.totalItems} articles)</span>
                  <span>€{cart.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Frais de port</span>
                  <span>{cart.shipping === 0 ? 'Gratuit' : `€${cart.shipping.toFixed(2)}`}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>€{cart.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowCheckout(true)}
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                Valider la commande
              </button>

              {cart.shipping > 0 && (
                <p className="text-xs text-gray-500 mt-3 text-center">
                  Livraison gratuite à partir de €100
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Checkout Modal */}
        {showCheckout && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Finaliser la commande</h3>
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="intent" value="validate" />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      name="customerEmail"
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nom complet</label>
                    <input
                      type="text"
                      name="customerName"
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Adresse de livraison</label>
                    <textarea
                      name="deliveryAddress"
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Notes (optionnel)</label>
                    <textarea
                      name="notes"
                      rows={2}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCheckout(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-gray-300 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Validation...' : `Payer €${cart.total.toFixed(2)}`}
                    </button>
                  </div>
                </Form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
