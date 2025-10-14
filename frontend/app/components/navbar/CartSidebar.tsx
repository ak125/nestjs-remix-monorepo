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
import type { CartItem } from '../../types/cart';
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

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white shadow-2xl z-50",
          "transform transition-transform duration-300 ease-in-out",
          "flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-6 w-6" />
            <div>
              <h2 className="text-lg font-semibold">Mon Panier</h2>
              <p className="text-sm text-blue-100">
                {summary.total_items} article{summary.total_items > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 h-8 w-8 p-0 rounded flex items-center justify-center transition-colors"
            aria-label="Fermer le panier"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Erreur */}
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Liste des articles */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
              <ShoppingBag className="h-16 w-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium">Votre panier est vide</p>
              <p className="text-sm mt-2">Ajoutez des articles pour commencer</p>
            </div>
          ) : (
            items.map((item) => (
              <CartSidebarItem
                key={item.id}
                item={item}
                onRemove={() => removeItem(item.id)}
                onQuantityChange={(qty) => updateQuantity(item.id, qty)}
              />
            ))
          )}
        </div>

        {/* Footer avec totaux */}
        {items.length > 0 && (
          <div className="border-t bg-gray-50 p-4 space-y-3">
            {/* Subtotal produits */}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Sous-total produits</span>
              <span className="font-medium">{formatPrice(summary.subtotal)}</span>
            </div>

            {/* 🆕 Total consignes (si > 0) */}
            {summary.consigne_total > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 flex items-center gap-1">
                  Consignes
                  <span className="text-xs text-gray-500">(remboursables)</span>
                </span>
                <span className="font-medium text-orange-600">
                  {formatPrice(summary.consigne_total)}
                </span>
              </div>
            )}

            {/* Total TTC */}
            <div className="flex justify-between text-lg font-bold border-t pt-3">
              <span>Total TTC</span>
              <span className="text-blue-600">{formatPrice(summary.total_price)}</span>
            </div>

            {/* Boutons actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="w-full"
              >
                Continuer
              </Button>
              <Button
                asChild
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Link to="/cart">
                  Voir le panier
                </Link>
              </Button>
            </div>

            <Button
              asChild
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Link to="/checkout">
                Commander
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
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
}

function CartSidebarItem({ item, onRemove, onQuantityChange }: CartSidebarItemProps) {
  const imageUrl = getProductImageUrl(item);
  const unitPrice = item.unit_price || item.price || 0;
  const totalPrice = unitPrice * item.quantity;
  
  return (
    <div className="flex gap-3 p-3 bg-white border rounded-lg hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
        <img
          src={imageUrl}
          alt={item.product_name || 'Produit'}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/images/no.png';
          }}
        />
      </div>

      {/* Informations */}
      <div className="flex-1 min-w-0">
        {/* Marque (from PHP pattern) */}
        {item.product_brand && (
          <p className="text-xs text-gray-500 font-medium uppercase">
            {item.product_brand}
          </p>
        )}
        
        {/* Nom produit */}
        <h3 className="text-sm font-medium text-gray-900 truncate">
          {item.product_name || 'Produit'}
        </h3>
        
        {/* Référence (from PHP pattern) */}
        {item.product_ref && (
          <p className="text-xs text-gray-500 mt-0.5">
            Réf: {item.product_ref}
          </p>
        )}

        {/* Prix et quantité */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onQuantityChange(item.quantity - 1)}
              disabled={item.quantity <= 1}
              className="h-6 w-6 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Diminuer la quantité"
            >
              -
            </button>
            <span className="text-sm font-medium w-8 text-center">
              {item.quantity}
            </span>
            <button
              onClick={() => onQuantityChange(item.quantity + 1)}
              className="h-6 w-6 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
              aria-label="Augmenter la quantité"
            >
              +
            </button>
          </div>

          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">
              {formatPrice(totalPrice)}
            </p>
            {/* 🆕 Consigne si présente */}
            {item.has_consigne && item.consigne_total && (
              <p className="text-xs text-orange-600">
                + {formatPrice(item.consigne_total)} consigne
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
