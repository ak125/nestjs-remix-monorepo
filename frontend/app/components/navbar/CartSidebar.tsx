/**
 * 🛒 CartSidebar Component - PHASE 1 POC
 * 
 * Sidebar coulissante pour le panier (remplace le dropdown CartIcon)
 * Inspiré du pattern PHP legacy mais modernisé avec React.
 * 
 * Features:
 * - ✅ Affichage image + marque + référence (pattern PHP)
 * - ✅ Support consignes séparées (legal requirement)
 * - ✅ Animation slide-in depuis la droite
 * - ✅ Overlay avec fermeture au clic extérieur
 * - ✅ Responsive mobile/desktop
 * 
 * @example
 * ```tsx
 * <CartSidebar isOpen={isOpen} onClose={onClose} />
 * ```
 */

import { Link } from '@remix-run/react';
import { X, ShoppingBag, AlertCircle } from 'lucide-react';
import { useCart, formatPrice, getProductImageUrl } from '../../hooks/useCart';
import { cn } from '../../lib/utils';
import  { type CartItem } from '../../types/cart';
import { Button } from '../ui/button';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartSidebar({ isOpen, onClose }: CartSidebarProps) {
  const {
    items,
    summary,
    isLoading,
    error,
    removeItem,
    updateQuantity,
  } = useCart();

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar avec design modernisé */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[500px] bg-gradient-to-br from-white to-gray-50 shadow-2xl z-50",
          "transform transition-all duration-300 ease-in-out",
          "flex flex-col border-l-4 border-blue-500",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header avec gradient amélioré */}
        <div className="flex items-center justify-between p-5 border-b-2 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Mon Panier</h2>
              <p className="text-sm text-blue-100 font-medium">
                <span className="bg-white/20 px-2 py-0.5 rounded-full">
                  {summary.total_items} article{summary.total_items > 1 ? 's' : ''}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 h-10 w-10 p-0 rounded-xl flex items-center justify-center transition-all hover:rotate-90 hover:scale-110 backdrop-blur-sm"
            aria-label="Fermer le panier"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Erreur avec style amélioré */}
        {error && (
          <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 border-b-2 border-red-300 shadow-sm">
            <div className="flex items-center gap-3 text-red-800">
              <AlertCircle className="h-6 w-6 flex-shrink-0 animate-pulse" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Liste des articles avec style amélioré */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-transparent to-gray-50/50">
          {isLoading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent shadow-lg" />
              <p className="text-sm font-medium text-gray-600">Chargement...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12 px-6">
              <div className="bg-gray-100 p-6 rounded-full mb-4 shadow-inner">
                <ShoppingBag className="h-20 w-20 text-gray-400" />
              </div>
              <p className="text-xl font-bold text-gray-700 mb-2">Votre panier est vide</p>
              <p className="text-sm text-center text-gray-500">
                Ajoutez des articles pour commencer vos achats
              </p>
            </div>
          ) : (
            items.map((item) => (
              <CartSidebarItem
                key={item.id}
                item={item}
                onRemove={async () => {
                  console.log('🗑️ CartSidebar - Clic supprimer:', item.id);
                  await removeItem(item.id);
                  console.log('✅ CartSidebar - Après removeItem');
                }}
                onQuantityChange={async (qty) => {
                  console.log('🔄 CartSidebar - Clic quantité:', { itemId: item.id, qty });
                  await updateQuantity(item.id, qty);
                  console.log('✅ CartSidebar - Après updateQuantity');
                }}
              />
            ))
          )}
        </div>

        {/* Footer avec totaux - Design amélioré */}
        {items.length > 0 && (
          <div className="border-t-2 bg-gradient-to-br from-gray-50 to-gray-100 p-5 space-y-3 shadow-inner">
            {/* Nombre de pièces - Badge style */}
            <div className="flex justify-between items-center text-sm p-3 bg-white rounded-xl shadow-sm border border-gray-200">
              <span className="text-gray-700 font-semibold flex items-center gap-2">
                <span className="text-lg">🔢</span>
                Nombre de pièces
              </span>
              <span className="font-bold text-xl text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                {summary.total_items}
              </span>
            </div>

            {/* Subtotal produits */}
            <div className="flex justify-between text-sm p-3 bg-white rounded-lg shadow-sm">
              <span className="text-gray-700 font-medium">Sous-total produits</span>
              <span className="font-semibold text-gray-900">{formatPrice(summary.subtotal)}</span>
            </div>

            {/* Total consignes avec style particulier */}
            {summary.consigne_total > 0 && (
              <div className="flex justify-between items-center text-sm p-3 bg-amber-50 rounded-lg shadow-sm border-2 border-amber-300">
                <span className="text-amber-800 font-medium flex items-center gap-2">
                  <span className="text-lg">♻️</span>
                  Consignes
                  <span className="text-xs bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                    remboursables
                  </span>
                </span>
                <span className="font-bold text-amber-700">
                  +{formatPrice(summary.consigne_total)}
                </span>
              </div>
            )}

            {/* Total TTC avec style imposant */}
            <div className="mt-4 pt-4 border-t-2 border-gray-300">
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg">
                <span className="font-bold text-lg text-white">Total TTC</span>
                <span className="font-bold text-3xl text-white">{formatPrice(summary.total_price)}</span>
              </div>
            </div>

            {/* Boutons d'action avec design moderne */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Button
                variant="outline"
                onClick={onClose}
                className="w-full border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 font-semibold"
              >
                Continuer
              </Button>
              <Button
                asChild
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 font-semibold shadow-md hover:shadow-lg"
              >
                <Link to="/cart">
                  🛒 Voir panier
                </Link>
              </Button>
            </div>

            <Button
              asChild
              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 mt-3 py-6 text-lg font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
            >
              <Link to="/checkout">
                ✅ Passer commande
              </Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * 🧩 CartSidebarItem - Item compact pour sidebar
 * Affiche: image, marque, référence, prix, consigne
 */
interface CartSidebarItemProps {
  item: CartItem;
  onRemove: () => void | Promise<void>;
  onQuantityChange: (quantity: number) => void | Promise<void>;
}

function CartSidebarItem({ item, onRemove, onQuantityChange }: CartSidebarItemProps) {
  const imageUrl = getProductImageUrl(item);
  const unitPrice = item.unit_price || item.price || 0;
  const totalPrice = unitPrice * item.quantity;
  
  return (
    <div className="flex gap-3 p-4 bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl hover:shadow-lg hover:border-blue-300 transition-all hover:scale-[1.02]">
      {/* Image avec overlay */}
      <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden flex-shrink-0 shadow-md relative group">
        <img
          src={imageUrl}
          alt={item.product_name || 'Produit'}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/images/no.png';
          }}
        />
        {item.has_consigne && item.consigne_unit && item.consigne_unit > 0 && (
          <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-bl-lg shadow-sm">
            ♻️
          </div>
        )}
      </div>

      {/* Informations */}
      <div className="flex-1 min-w-0">
        {/* Marque avec badge */}
        {item.product_brand && (
          <p className="text-xs text-gray-600 font-semibold uppercase bg-blue-50 inline-block px-2 py-0.5 rounded-full mb-1">
            {item.product_brand}
          </p>
        )}
        
        {/* Nom produit */}
        <h3 className="text-sm font-bold text-gray-900 truncate leading-tight">
          {item.product_name || 'Produit'}
        </h3>
        
        {/* Référence avec style */}
        {item.product_ref && (
          <p className="text-xs text-gray-500 mt-1 font-mono bg-gray-100 inline-block px-2 py-0.5 rounded">
            Réf: {item.product_ref}
          </p>
        )}

        {/* Prix et quantité avec design amélioré */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-200">
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => {
                console.log('➖ Bouton - cliqué, quantité actuelle:', item.quantity);
                onQuantityChange(item.quantity - 1);
              }}
              disabled={item.quantity <= 1}
              className="h-7 w-7 rounded-md bg-white border border-gray-300 flex items-center justify-center text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed font-bold hover:scale-110 transition-transform shadow-sm"
              aria-label="Diminuer la quantité"
            >
              −
            </button>
            <span className="text-sm font-bold w-8 text-center bg-white px-2 py-1 rounded">
              {item.quantity}
            </span>
            <button
              onClick={() => {
                console.log('➕ Bouton + cliqué, quantité actuelle:', item.quantity);
                onQuantityChange(item.quantity + 1);
              }}
              className="h-7 w-7 rounded-md bg-white border border-gray-300 flex items-center justify-center text-green-600 hover:bg-green-50 font-bold hover:scale-110 transition-transform shadow-sm"
              aria-label="Augmenter la quantité"
            >
              +
            </button>
          </div>

          <div className="text-right">
            <p className="text-base font-bold text-blue-600">
              {formatPrice(totalPrice)}
            </p>
            {/* Consigne avec badge */}
            {item.has_consigne && item.consigne_unit && item.consigne_unit > 0 && (
              <p className="text-xs text-amber-700 font-semibold bg-amber-50 inline-block px-2 py-0.5 rounded-full mt-0.5">
                +{formatPrice(item.consigne_unit * item.quantity)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bouton supprimer */}
      <button
        onClick={onRemove}
        className="h-6 w-6 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center flex-shrink-0"
        aria-label="Supprimer l'article"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
