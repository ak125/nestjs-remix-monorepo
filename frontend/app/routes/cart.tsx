/**
 * 🛒 CART PAGE - Route principale du panier
 * Utilise le service cart.server.ts et les composants améliorés
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { CartItem } from "../components/cart/CartItem";
import { getCart, updateQuantity, removeFromCart, clearCart } from "../services/cart.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const cartData = await getCart(request);
    return json({ cart: cartData, success: true, error: null });
  } catch (error) {
    console.error("Erreur lors du chargement du panier:", error);
    return json({ 
      cart: { 
        items: [], 
        summary: { 
          total_items: 0, 
          total_price: 0, 
          subtotal: 0, 
          tax_amount: 0, 
          shipping_cost: 0, 
          currency: "EUR" 
        } 
      }, 
      success: false, 
      error: "Erreur lors du chargement du panier" 
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("_action") as string;

  try {
    switch (action) {
      case "update-quantity":
        const itemId = formData.get("itemId") as string;
        const quantity = parseInt(formData.get("quantity") as string);
        const result = await updateQuantity(request, itemId, quantity);
        return json(result);

      case "remove-item":
        const removeItemId = formData.get("itemId") as string;
        const removeResult = await removeFromCart(request, removeItemId);
        return json(removeResult);

      case "clear":
        const clearResult = await clearCart(request);
        return json(clearResult);

      default:
        return json({ success: false, error: "Action invalide" }, { status: 400 });
    }
  } catch (error) {
    console.error("Erreur dans l'action panier:", error);
    return json({ success: false, error: "Erreur lors de l'action" }, { status: 500 });
  }
}

// Composant CartSummary
function CartSummary({ summary, children }: { summary: any; children?: React.ReactNode }) {
  const total = summary.total_price || (summary.subtotal + summary.tax_amount + summary.shipping_cost - (summary.discount_amount || 0));
  
  return (
    <div className="bg-gray-50 p-6 rounded-lg">
      <h2 className="text-lg font-semibold mb-4">Résumé de la commande</h2>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Sous-total ({summary.total_items} articles)</span>
          <span>{summary.subtotal.toFixed(2)}€</span>
        </div>
        
        {summary.shipping_cost > 0 && (
          <div className="flex justify-between">
            <span>Livraison</span>
            <span>{summary.shipping_cost.toFixed(2)}€</span>
          </div>
        )}
        
        {summary.tax_amount > 0 && (
          <div className="flex justify-between">
            <span>TVA</span>
            <span>{summary.tax_amount.toFixed(2)}€</span>
          </div>
        )}
        
        {summary.discount_amount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Remise</span>
            <span>-{summary.discount_amount.toFixed(2)}€</span>
          </div>
        )}
        
        <hr className="my-2" />
        <div className="flex justify-between font-semibold text-lg">
          <span>Total</span>
          <span>{total.toFixed(2)}€</span>
        </div>
      </div>
      
      {children && (
        <div className="mt-6">
          {children}
        </div>
      )}
    </div>
  );
}

// Composant panier vide
function EmptyCart() {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">🛒</div>
      <h2 className="text-xl font-semibold mb-2">Votre panier est vide</h2>
      <p className="text-gray-600 mb-6">
        Découvrez nos produits et ajoutez-les à votre panier
      </p>
      <Link
        to="/products"
        className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Continuer mes achats
      </Link>
    </div>
  );
}

// Composant principal
export default function CartPage() {
  const { cart, success, error } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const handleQuantityChange = (itemId: string, quantity: number) => {
    fetcher.submit(
      { _action: "update-quantity", itemId, quantity: quantity.toString() },
      { method: "post" }
    );
  };

  const handleRemoveItem = (itemId: string) => {
    fetcher.submit(
      { _action: "remove-item", itemId },
      { method: "post" }
    );
  };

  const handleClearCart = () => {
    if (confirm("Êtes-vous sûr de vouloir vider votre panier ?")) {
      fetcher.submit(
        { _action: "clear" },
        { method: "post" }
      );
    }
  };

  if (!success || error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold mb-2">Erreur de chargement</h2>
            <p className="text-gray-600 mb-6">{error || "Une erreur est survenue"}</p>
            <Link
              to="/"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!cart.items || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyCart />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">
            Mon Panier ({cart.summary.total_items} article{cart.summary.total_items > 1 ? 's' : ''})
          </h1>
          
          <button
            onClick={handleClearCart}
            disabled={fetcher.state !== "idle"}
            className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
          >
            Vider le panier
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Liste des articles */}
          <div className="lg:col-span-2 space-y-4">
            {cart.items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onQuantityChange={(quantity) => handleQuantityChange(item.id, quantity)}
                onRemove={() => handleRemoveItem(item.id)}
              />
            ))}
          </div>

          {/* Résumé et actions */}
          <div className="lg:col-span-1">
            <CartSummary summary={cart.summary}>
              <div className="space-y-3">
                <Link
                  to="/checkout"
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-center block"
                >
                  Procéder au paiement
                </Link>
                
                <Link
                  to="/products"
                  className="w-full bg-white text-gray-700 py-3 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors font-medium text-center block"
                >
                  Continuer mes achats
                </Link>
              </div>
            </CartSummary>

            {/* Informations complémentaires */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">
                🚚 Livraison gratuite
              </h3>
              <p className="text-sm text-blue-700">
                Livraison gratuite pour toute commande supérieure à 50€
              </p>
            </div>

            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-900 mb-2">
                🔒 Paiement sécurisé
              </h3>
              <p className="text-sm text-green-700">
                Tous vos paiements sont sécurisés et protégés
              </p>
            </div>
          </div>
        </div>

        {/* État de chargement */}
        {fetcher.state !== "idle" && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span>Mise à jour en cours...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}