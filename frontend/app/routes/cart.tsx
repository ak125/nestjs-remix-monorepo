/**
 * 🛒 CART PAGE - Route principale du panier
 * Version consolidée avec appel direct à l'API backend
 * 
 * ✅ Fonctionnalités:
 * - Affichage du panier avec produits
 * - Vidage du panier via API DELETE /api/cart
 * - Gestion des erreurs et états vides
 * - Compatible avec l'authentification NestJS/Remix
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useNavigation } from "@remix-run/react";
import React from 'react';
import { getCart } from "../services/cart.server";

export async function loader({ request }: LoaderFunctionArgs) {
  console.log("🛒 [CART LOADER] Chargement du panier depuis cart.tsx");
  try {
    const url = new URL(request.url);
    const cleared = url.searchParams.get('cleared');
    
    const cartData = await getCart(request);
    return json({ 
      cart: cartData, 
      success: true, 
      error: null,
      cleared: cleared === 'true' 
    });
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
      error: "Erreur lors du chargement du panier",
      cleared: false
    });
  }
}

/**
 * 🧹 Fonction utilitaire pour vider le panier
 * Utilise directement l'API backend car les actions Remix ne fonctionnent pas
 * dans ce setup monorepo NestJS + Remix
 */
async function clearCartAPI(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🧹 [CLEAR CART] Appel API DELETE /api/cart');
    
    const response = await fetch('/api/cart', {
      method: 'DELETE',
      credentials: 'include', // Important: transmet les cookies de session/auth
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ [CLEAR CART] Panier vidé avec succès:', result);
      return { success: true };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ [CLEAR CART] Erreur HTTP:', response.status, errorData);
      return { 
        success: false, 
        error: errorData.message || `Erreur HTTP ${response.status}` 
      };
    }
  } catch (error) {
    console.error('❌ [CLEAR CART] Erreur réseau:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur réseau' 
    };
  }
}

/**
 * 🔄 Fonction pour modifier la quantité d'un article
 */
// Fonction pour mettre à jour la quantité d'un article
// Utilise le product_id numérique au lieu de l'ID UUID inexistant
async function updateItemQuantityAPI(productId: number, quantity: number) {
  try {
    if (quantity < 1) {
      throw new Error('La quantité doit être d\'au moins 1');
    }
    
    const response = await fetch('/api/cart/items', {
      method: 'POST', // Réutiliser l'endpoint d'ajout qui gère la mise à jour
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ 
        product_id: productId, 
        quantity: quantity,
        replace: true // Flag pour indiquer qu'on remplace la quantité
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Erreur mise à jour quantité:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    };
  }
}

// Fonction pour supprimer un article du panier
// Utilise le product_id numérique qui correspond aux données du backend
async function removeItemAPI(productId: number) {
  try {
    const response = await fetch(`/api/cart/items/${productId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Erreur suppression article:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    };
  }
}

// Composant CartSummary
function CartSummary({ summary, children, isUpdating }: { 
  summary: any; 
  children?: React.ReactNode;
  isUpdating?: boolean;
}) {
  const total = summary.total_price || (summary.subtotal + summary.tax_amount + summary.shipping_cost - (summary.discount_amount || 0));
  
  return (
    <div className={`bg-gray-50 p-6 rounded-lg transition-opacity ${
      isUpdating ? 'opacity-50' : ''
    }`}>
      <h2 className="text-lg font-semibold mb-4 flex items-center">
        Résumé de la commande
        {isUpdating && (
          <span className="ml-2 text-sm text-blue-600">🔄 Mise à jour...</span>
        )}
      </h2>
      
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

// Composant CartItem simplifié avec vraies données
function CartItem({ item, onUpdate, onRemove }: { 
  item: any; 
  onUpdate: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
}) {
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [currentQuantity, setCurrentQuantity] = React.useState(item.quantity);
  const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);
  
  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 1 || newQuantity === currentQuantity || isUpdating) return;
    
    const oldQuantity = currentQuantity;
    setIsUpdating(true);
    setCurrentQuantity(newQuantity);
    
    try {
      await onUpdate(item.product_id, newQuantity);
    } catch (error) {
      setCurrentQuantity(oldQuantity);
      console.error('Erreur mise à jour quantité:', error);
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onRemove(item.product_id);
    } catch (error) {
      console.error('Erreur suppression:', error);
    } finally {
      setIsRemoving(false);
      setShowConfirmDelete(false);
    }
  };
  
  const confirmRemoval = () => {
    setShowConfirmDelete(true);
  };
  
  // Calcul du prix
  const isTotal = Math.abs(item.price - (item.price * item.quantity)) < 0.01;
  const unitPrice = isTotal ? item.price / item.quantity : item.price;
  const totalPrice = isTotal ? item.price : item.price * item.quantity;

  return (
    <div className={`bg-white rounded-lg border shadow-sm transition-all duration-200 p-6 ${
      isUpdating || isRemoving ? 'opacity-50 pointer-events-none' : 'hover:shadow-md'
    }`}>
      {/* En-tête produit */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-xl text-gray-900 mb-2">
            {item.product_name || item.name || 'Produit sans nom'}
          </h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div>
              <span className="font-medium">Référence:</span> 
              <span className="text-gray-900 font-mono ml-1">{item.product_sku || item.product_id}</span>
            </div>
            {item.product_brand && item.product_brand !== 'MARQUE INCONNUE' && item.product_brand !== 'Non spécifiée' && (
              <div>
                <span className="font-medium">Marque:</span> 
                <span className="text-gray-900 ml-1">{item.product_brand}</span>
              </div>
            )}
            {(item.product_brand === 'MARQUE INCONNUE' || item.product_brand === 'Non spécifiée') && (
              <div>
                <span className="font-medium">Marque:</span> 
                <span className="text-gray-500 italic ml-1">Non spécifiée</span>
              </div>
            )}
            {!item.product_brand && (
              <div>
                <span className="font-medium">Marque:</span> 
                <span className="text-gray-400 italic ml-1">Données manquantes</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Badge de statut */}
        {(isUpdating || isRemoving) && (
          <div className="flex items-center space-x-2 text-blue-600 text-sm bg-blue-50 px-3 py-1 rounded-full">
            <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span className="font-medium">{isUpdating ? 'Mise à jour...' : 'Suppression...'}</span>
          </div>
        )}
      </div>
      
      {/* Contrôles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        {/* Quantité */}
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-700">Quantité:</span>
          <div className="flex items-center border-2 border-gray-200 rounded-lg bg-white shadow-sm">
            <button
              onClick={() => handleQuantityChange(currentQuantity - 1)}
              disabled={isUpdating || isRemoving || currentQuantity <= 1}
              className="px-4 py-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-l-lg font-bold text-lg"
            >
              −
            </button>
            <div className="px-4 py-2 min-w-[60px] text-center font-bold text-lg bg-gray-50 border-x-2 border-gray-200">
              {currentQuantity}
            </div>
            <button
              onClick={() => handleQuantityChange(currentQuantity + 1)}
              disabled={isUpdating || isRemoving}
              className="px-4 py-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-r-lg font-bold text-lg"
            >
              +
            </button>
          </div>
        </div>
        
        {/* Prix */}
        <div className="text-center">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">
              Prix unitaire: <span className="font-semibold">{unitPrice.toFixed(2)}€</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {totalPrice.toFixed(2)}€
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {item.quantity} × {unitPrice.toFixed(2)}€
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex justify-end">
          {!showConfirmDelete ? (
            <button
              onClick={confirmRemoval}
              disabled={isUpdating || isRemoving}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2 font-medium shadow-sm"
            >
              <span>🗑️</span>
              <span>Supprimer</span>
            </button>
          ) : (
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowConfirmDelete(false)}
                disabled={isRemoving}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleRemove}
                disabled={isRemoving}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50 font-medium"
              >
                {isRemoving ? '⏳ Suppression...' : '✓ Confirmer'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}// Composant panier vide
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
  const { cart, success, error, cleared } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [notification, setNotification] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  
  // Afficher une notification temporaire
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };
  
  // Gérer la mise à jour de quantité
  const handleUpdateQuantity = async (productId: number, quantity: number) => {
    const result = await updateItemQuantityAPI(productId, quantity);
    
    if (result.success) {
      showNotification('success', 'Quantité mise à jour avec succès');
      // Attendre un peu avant de recharger pour que l'utilisateur voie la notification
      setTimeout(() => window.location.reload(), 500);
    } else {
      showNotification('error', result.error || 'Erreur lors de la mise à jour');
    }
  };
  
  // Gérer la suppression d'article
  const handleRemoveItem = async (productId: number) => {
    const result = await removeItemAPI(productId);
    
    if (result.success) {
      showNotification('success', 'Article supprimé avec succès');
      // Attendre un peu avant de recharger pour que l'utilisateur voie la notification
      setTimeout(() => window.location.reload(), 500);
    } else {
      showNotification('error', result.error || 'Erreur lors de la suppression');
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
        {/* Notification de succès après vidage */}
        {cleared && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            <div className="flex items-center">
              <span className="text-lg mr-2">✅</span>
              <span>Panier vidé avec succès !</span>
            </div>
          </div>
        )}
        {/* En-tête */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">
            Mon Panier ({cart.summary.total_items} article{cart.summary.total_items > 1 ? 's' : ''})
          </h1>
          
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Êtes-vous sûr de vouloir vider le panier ?')) {
                return;
              }
              
              const result = await clearCartAPI();
              
              if (result.success) {
                // Recharger la page avec le paramètre cleared pour afficher le message de succès
                window.location.href = '/cart?cleared=true';
              } else {
                alert(result.error || 'Erreur lors du vidage du panier');
              }
            }}
            className="text-red-600 hover:text-red-800 text-sm font-medium px-4 py-2 border border-red-600 rounded hover:bg-red-50 transition-colors"
            title="Supprimer tous les articles du panier"
          >
            Vider le panier
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Liste des articles */}
          <div className="lg:col-span-2 space-y-4">
            {notification && (
              <div className={`p-4 rounded-lg border ${
                notification.type === 'success' 
                  ? 'bg-green-100 border-green-400 text-green-700'
                  : 'bg-red-100 border-red-400 text-red-700'
              }`}>
                <div className="flex items-center">
                  <span className="text-lg mr-2">
                    {notification.type === 'success' ? '✅' : '❌'}
                  </span>
                  <span>{notification.message}</span>
                </div>
              </div>
            )}
            
            {cart.items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onUpdate={handleUpdateQuantity}
                onRemove={handleRemoveItem}
              />
            ))}
          </div>

          {/* Résumé et actions */}
          <div className="lg:col-span-1">
            <CartSummary summary={cart.summary} isUpdating={navigation.state === 'loading'}>                  
              <div className="space-y-3">
                <Link
                  to="/checkout"
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-center block"
                >
                  Procéder au paiement
                </Link>
                
                {/*
                  CONSOLIDATION NOTES:
                  
                  Solution finale pour le panier - Approche API directe
                  =======================================================
                  
                  Problème initial: Le bouton "Vider le panier" ne fonctionnait pas
                  Cause racine: Les actions Remix ne fonctionnent pas dans cette configuration monorepo NestJS+Remix
                  
                  Solution implémentée:
                  1. Fonction clearCartAPI() qui fait un appel direct à l'API backend
                  2. Gestion d'erreurs appropriée avec try/catch
                  3. Authentification par cookies (credentials: 'include')
                  4. Rechargement de la page après succès
                  
                  Architecture technique:
                  - Backend NestJS: /api/cart (DELETE) → CartController.clearCart()
                  - Frontend Remix: fetch() direct au lieu des actions Remix
                  - Redis pour stockage des données du panier
                  - Sessions Passport pour l'authentification
                  
                  Cette approche peut être réutilisée pour d'autres opérations du panier
                  (modification quantité, suppression d'articles) dans ce setup monorepo.
                */}
                
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
      </div>
    </div>
  );
}