import { Badge } from '@fafa/ui';
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
    clearCart,
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

      {/* Sidebar compact */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[380px] bg-white shadow-2xl z-50",
          "transform transition-all duration-300 ease-in-out",
          "flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header compact */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-5 w-5" />
            <div>
              <h2 className="text-base font-bold">Mon Panier</h2>
              <p className="text-xs text-blue-100">
                {summary.total_items} article{summary.total_items > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 h-8 w-8 rounded-lg flex items-center justify-center transition-all"
            aria-label="Fermer le panier"
          >
            <X className="h-5 w-5" />
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

        {/* 🎯 Seuil Franco - Indicateur compact */}
        {items.length > 0 && summary.subtotal < 150 && (
          <div className="px-4 py-2 bg-green-50 border-b text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-green-700 font-medium">🚚 Livraison gratuite à 150€</span>
              <span className="text-green-800 font-bold">-{formatPrice(150 - summary.subtotal)}</span>
            </div>
            <div className="w-full bg-green-200 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min((summary.subtotal / 150) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* 🎁 Livraison gratuite atteinte */}
        {items.length > 0 && summary.subtotal >= 150 && (
          <div className="px-4 py-2 bg-green-500 text-white border-b text-xs font-medium">
            🎉 Livraison gratuite incluse !
          </div>
        )}

        {/* Liste des articles - compact */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center h-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
              <ShoppingBag className="h-12 w-12 mb-3" />
              <p className="font-medium">Votre panier est vide</p>
            </div>
          ) : (
            items.map((item) => (
              <CartSidebarItemCompact
                key={item.id}
                item={item}
                onRemove={() => removeItem(item.id)}
                onQuantityChange={(qty) => updateQuantity(item.id, qty)}
              />
            ))
          )}
        </div>

        {/* Footer compact avec totaux */}
        {items.length > 0 && (
          <div className="border-t bg-gray-50 p-4 space-y-3">
            {/* Totaux */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Sous-total ({summary.total_items})</span>
                <span className="font-medium">{formatPrice(summary.subtotal)}</span>
              </div>
              {summary.consigne_total > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>♻️ Consignes</span>
                  <span>+{formatPrice(summary.consigne_total)}</span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-bold text-lg">Total TTC</span>
              <span className="font-bold text-xl text-blue-600">{formatPrice(summary.total_price)}</span>
            </div>

            {/* Boutons */}
            <div className="space-y-2 pt-2">
              <Button
                asChild
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Link to="/checkout" onClick={onClose}>
                  ✅ Commander
                </Link>
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="flex-1"
                >
                  <Link to="/cart" onClick={onClose}>
                    Voir panier
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (confirm('Vider le panier ?')) {
                      await clearCart();
                    }
                  }}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  Vider
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * 🧱 CartSidebarItemCompact - Item très compact
 */
interface CartSidebarItemCompactProps {
  item: CartItem;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
}

function CartSidebarItemCompact({ item, onRemove, onQuantityChange }: CartSidebarItemCompactProps) {
  const imageUrl = getProductImageUrl(item);
  const unitPrice = item.unit_price || item.price || 0;
  const totalPrice = unitPrice * item.quantity;
  
  return (
    <div className="flex gap-3 p-2 bg-white border rounded-lg hover:shadow-sm transition-shadow group">
      {/* Image petite */}
      <div className="w-14 h-14 bg-gray-100 rounded overflow-hidden flex-shrink-0">
        <img
          src={imageUrl}
          alt={item.product_name || 'Produit'}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/images/no.png';
          }}
        />
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {item.product_brand && (
              <p className="text-[10px] text-gray-500 uppercase truncate">{item.product_brand}</p>
            )}
            <h3 className="text-xs font-medium text-gray-900 truncate leading-tight">
              {item.product_name || 'Produit'}
            </h3>
          </div>
          {/* Bouton supprimer discret */}
          <button
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 h-5 w-5 text-gray-400 hover:text-red-500 transition-opacity flex-shrink-0"
            aria-label="Supprimer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Prix et quantité sur une ligne */}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1 bg-gray-100 rounded px-1">
            <button
              onClick={() => onQuantityChange(item.quantity - 1)}
              disabled={item.quantity <= 1}
              className="h-5 w-5 text-xs flex items-center justify-center hover:bg-gray-200 rounded disabled:opacity-30"
            >
              −
            </button>
            <span className="text-xs font-medium w-5 text-center">{item.quantity}</span>
            <button
              onClick={() => onQuantityChange(item.quantity + 1)}
              className="h-5 w-5 text-xs flex items-center justify-center hover:bg-gray-200 rounded"
            >
              +
            </button>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">{formatPrice(totalPrice)}</p>
            {item.consigne_unit && item.consigne_unit > 0 && (
              <p className="text-[10px] text-amber-600">+{formatPrice(item.consigne_unit * item.quantity)} cons.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
