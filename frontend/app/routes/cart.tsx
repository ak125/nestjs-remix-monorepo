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

import { Alert, Badge } from "@fafa/ui";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Button } from '~/components/ui/button';
import { useLoaderData, Link, useNavigation } from "@remix-run/react";
import React from 'react';
import { getCart } from "../services/cart.server";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  // console.log("🛒 [CART LOADER] Chargement du panier depuis cart.tsx");
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
          consigne_total: 0, // ✅ PHASE 4
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
    
    // ✅ Utiliser un chemin relatif pour fonctionner dans le monorepo
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
    // ✅ Utiliser un chemin relatif pour fonctionner dans le monorepo
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

// Composant CartSummary avec design amélioré
function CartSummary({ summary, children, isUpdating }: { 
  summary: any; 
  children?: React.ReactNode;
  isUpdating?: boolean;
}) {
  const total = summary.total_price || (summary.subtotal + summary.tax_amount + summary.shipping_cost - (summary.discount_amount || 0));
  
  return (
    <div className={`bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 p-6 rounded-xl shadow-lg transition-all ${
      isUpdating ? 'opacity-50 scale-[0.98]' : 'hover:shadow-xl'
    }`}>
      <h2 className="text-xl font-bold mb-5 flex items-center text-gray-800 border-b-2 border-blue-500 pb-3">
        <span className="mr-2">📋</span>
        Résumé de la commande
        {isUpdating && (
          <Badge variant="info" size="sm" className="ml-auto">
            <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full mr-2 inline-block"></div>
            Mise à jour...
          </Badge>
        )}
      </h2>
      
      <div className="space-y-3 text-sm">
        {/* Nombre de pièces - Badge style */}
        <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm border border-gray-200">
          <span className="font-semibold text-gray-700 flex items-center">
            <span className="mr-2">🔢</span>
            Nombre de pièces
          </span>
          <Badge variant="info" size="lg">
            {summary.total_items}
          </Badge>
        </div>

        {/* Sous-total */}
        <div className="flex justify-between p-3 bg-white rounded-lg shadow-sm">
          <span className="text-gray-700 font-medium">Sous-total produits</span>
          <span className="font-semibold text-gray-900">{summary.subtotal.toFixed(2)}€</span>
        </div>
        
        {/* Consignes avec style particulier */}
        {summary.consigne_total > 0 && (
          <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg shadow-sm border-2 border-amber-300">
            <span className="text-amber-800 font-medium flex items-center">
              <span className="mr-2">♻️</span>
              Consignes
              <span className="text-xs ml-2 bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                remboursables
              </span>
            </span>
            <span className="font-bold text-amber-700">+{summary.consigne_total.toFixed(2)}€</span>
          </div>
        )}
        
        {summary.shipping_cost > 0 && (
          <div className="flex justify-between p-3 bg-white rounded-lg shadow-sm">
            <span className="text-gray-700 flex items-center">
              <span className="mr-2">🚚</span>
              Livraison
            </span>
            <span className="font-semibold">{summary.shipping_cost.toFixed(2)}€</span>
          </div>
        )}
        
        {summary.tax_amount > 0 && (
          <div className="flex justify-between p-3 bg-white rounded-lg shadow-sm">
            <span className="text-gray-700">TVA</span>
            <span className="font-semibold">{summary.tax_amount.toFixed(2)}€</span>
          </div>
        )}
        
        {summary.discount_amount > 0 && (
<Alert className="flex justify-between p-3  rounded-lg shadow-sm border-2" variant="success">
            <span className="text-green-700 font-medium flex items-center">
              <span className="mr-2">🎁</span>
              Remise
            </span>
            <span className="font-bold text-green-700">-{summary.discount_amount.toFixed(2)}€</span>
          </Alert>
        )}
        
        {/* Total avec style imposant */}
        <div className="mt-4 pt-4 border-t-2 border-gray-300">
          <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg">
            <span className="font-bold text-lg text-white">Total TTC</span>
            <span className="font-bold text-3xl text-white">{total.toFixed(2)}€</span>
          </div>
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
    <div className={`bg-white rounded-xl border-2 shadow-md transition-all duration-300 p-6 ${
      isUpdating || isRemoving 
        ? 'opacity-50 pointer-events-none scale-[0.98]' 
        : 'hover:shadow-xl hover:border-blue-300 hover:scale-[1.01]'
    }`}>
      {/* En-tête produit avec badge consigne */}
      <div className="flex items-start justify-between mb-5 pb-4 border-b-2 border-gray-100">
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <h3 className="font-bold text-xl text-gray-900 mb-2 flex-1">
              {item.product_name || item.name || 'Produit sans nom'}
            </h3>
            {item.has_consigne && item.consigne_unit > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                <span className="mr-1">♻️</span>
                +{item.consigne_unit.toFixed(2)}€ consigne
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600 space-y-2 mt-2">
            <div className="flex items-center">
              <span className="font-semibold text-gray-500 min-w-[80px]">Référence</span>
              <span className="text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded">
                {item.product_sku || item.product_id}
              </span>
            </div>
            {item.product_brand && item.product_brand !== 'MARQUE INCONNUE' && item.product_brand !== 'Non spécifiée' && (
              <div className="flex items-center">
                <span className="font-semibold text-gray-500 min-w-[80px]">Marque</span>
                <Badge variant="info">
                  {item.product_brand}
                </Badge>
              </div>
            )}
            {(item.product_brand === 'MARQUE INCONNUE' || item.product_brand === 'Non spécifiée') && (
              <div className="flex items-center">
                <span className="font-semibold text-gray-500 min-w-[80px]">Marque</span>
                <span className="text-gray-400 italic px-2 py-1">Non spécifiée</span>
              </div>
            )}
            {!item.product_brand && (
              <div className="flex items-center">
                <span className="font-semibold text-gray-500 min-w-[80px]">Marque</span>
                <span className="text-gray-300 italic px-2 py-1">Données manquantes</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Badge de statut animé */}
        {(isUpdating || isRemoving) && (
          <div className="flex items-center space-x-2 text-blue-600 text-sm bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-2 rounded-full border-2 border-blue-200 shadow-sm">
            <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span className="font-semibold">{isUpdating ? 'Mise à jour...' : 'Suppression...'}</span>
          </div>
        )}
      </div>
      
      {/* Contrôles avec design modernisé */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        {/* Quantité avec style amélioré */}
        <div className="flex flex-col space-y-2">
          <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Quantité</span>
          <div className="flex items-center border-2 border-gray-300 rounded-xl bg-gradient-to-r from-gray-50 to-white shadow-md hover:shadow-lg transition-shadow">
            <button
              onClick={() => handleQuantityChange(currentQuantity - 1)}
              disabled={isUpdating || isRemoving || currentQuantity <= 1}
              className="px-5 py-3 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-l-xl font-bold text-xl text-red-600 hover:scale-110"
            >
              −
            </button>
            <div className="px-6 py-3 min-w-[70px] text-center font-bold text-2xl bg-white border-x-2 border-gray-300 text-gray-900">
              {currentQuantity}
            </div>
            <button
              onClick={() => handleQuantityChange(currentQuantity + 1)}
              disabled={isUpdating || isRemoving}
              className="px-5 py-3 hover:bg-gradient-to-r hover:from-green-50 hover:to-green-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-r-xl font-bold text-xl text-green-600 hover:scale-110"
            >
              +
            </button>
          </div>
        </div>
        
        {/* Prix avec carte détaillée */}
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Prix total</span>
          <div className="bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-50 p-5 rounded-xl shadow-md border-2 border-blue-200">
            <div className="text-sm text-gray-700 mb-2 flex justify-between">
              <span className="font-medium">Prix unitaire</span>
              <span className="font-bold text-gray-900">{unitPrice.toFixed(2)}€</span>
            </div>
            {item.has_consigne && item.consigne_unit > 0 && (
              <div className="text-xs text-amber-700 mb-2 flex justify-between bg-amber-50 px-2 py-1 rounded border border-amber-200">
                <span className="font-medium">+ Consigne</span>
                <span className="font-semibold">{item.consigne_unit.toFixed(2)}€</span>
              </div>
            )}
            <div className="text-3xl font-extrabold text-blue-700 text-center mt-2 mb-1">
              {totalPrice.toFixed(2)}€
            </div>
            <div className="text-xs text-gray-600 text-center bg-white/50 py-1 px-2 rounded-full">
              {item.quantity} × {unitPrice.toFixed(2)}€
              {item.has_consigne && ` + ${item.consigne_unit.toFixed(2)}€`}
            </div>
          </div>
        </div>
        
        {/* Actions avec bouton amélioré */}
        <div className="flex flex-col space-y-2">
          <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Actions</span>
          {!showConfirmDelete ? (
            <button
              onClick={confirmRemoval}
              disabled={isUpdating || isRemoving}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-semibold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
            >
              <span className="text-lg">🗑️</span>
              <span>Supprimer</span>
            </button>
          ) : (
<Alert className="flex flex-col space-y-2  p-3 rounded-xl border-2" variant="error">
              <p className="text-sm font-semibold text-red-800 mb-1">⚠️ Confirmer la suppression ?</p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={isRemoving}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition-all font-medium shadow-sm hover:shadow-md"
                >
                  Annuler
                </button>
                <button
                  onClick={handleRemove}
                  disabled={isRemoving}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-2 rounded-lg transition-all disabled:opacity-50 font-semibold shadow-md hover:shadow-lg"
                >
                  {isRemoving ? '⏳ Suppression...' : '✓ Confirmer'}
                </button>
              </div>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}// Composant panier vide avec design amélioré
function EmptyCart() {
  return (
    <div className="text-center py-16 px-6">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-12 max-w-2xl mx-auto shadow-lg border-2 border-gray-200">
        <div className="text-8xl mb-6 animate-pulse">🛒</div>
        <h2 className="text-3xl font-bold mb-4 text-gray-800">Votre panier est vide</h2>
        <p className="text-lg text-gray-600 mb-8">
          Découvrez nos produits et ajoutez-les à votre panier pour commencer vos achats
        </p>

        <Link
          to="/products"
          className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl font-semibold text-lg hover:scale-105 active:scale-95"
        >
          <span>🛍️</span>
          <span>Continuer mes achats</span>
        </Link>
      </div>
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
            <Button className="inline-block  px-6 py-3 rounded-lg" variant="blue" asChild><Link to="/">Retour à l'accueil</Link></Button>
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
          <Alert intent="success" variant="solid" icon={<span className="text-lg">✅</span>}>
            Panier vidé avec succès !
          </Alert>
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
              <Alert 
                intent={notification.type === 'success' ? 'success' : 'error'} 
                variant="solid"
                icon={<span className="text-lg">{notification.type === 'success' ? '✅' : '❌'}</span>}
              >
                {notification.message}
              </Alert>
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
                <Button className="w-full  py-3 px-4 rounded-lg   text-center block" variant="blue" asChild><Link to="/checkout">Finaliser ma commande →</Link></Button>
                
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