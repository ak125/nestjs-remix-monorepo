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
          <div className="p-3 bg-red-50 border-b border-red-200">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p className="text-xs font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* 🚚 LIVRAISON GRATUITE - Bannière mise en avant */}
        {items.length > 0 && (
          <div className={cn(
            "px-4 py-3 border-b",
            summary.subtotal >= 150 
              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white" 
              : "bg-gradient-to-r from-amber-50 to-orange-50"
          )}>
            {summary.subtotal >= 150 ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎉</span>
                <div>
                  <p className="font-bold text-sm">Livraison GRATUITE !</p>
                  <p className="text-xs opacity-90">Expédition sous 24-48h</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🚚</span>
                    <span className="text-sm font-semibold text-gray-800">Livraison gratuite</span>
                  </div>
                  <span className="text-sm font-bold text-green-600">dès 150€</span>
                </div>
                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-green-400 to-green-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((summary.subtotal / 150) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs">
                    <span className="text-gray-600">{formatPrice(summary.subtotal)}</span>
                    <span className="text-green-700 font-semibold">
                      Plus que {formatPrice(150 - summary.subtotal)} !
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 📦 Liste des articles */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
              <ShoppingBag className="h-16 w-16 mb-4 opacity-50" />
              <p className="font-medium text-lg">Votre panier est vide</p>
              <p className="text-sm mt-1">Ajoutez des pièces pour commencer</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Titre liste */}
              <div className="px-4 py-2 bg-gray-50 sticky top-0 z-10">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  📋 {items.length} pièce{items.length > 1 ? 's' : ''} dans le panier
                </p>
              </div>
              {items.map((item) => (
                <CartSidebarItem
                  key={item.id}
                  item={item}
                  onRemove={() => removeItem(item.id)}
                  onQuantityChange={(qty) => updateQuantity(item.id, qty)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer avec totaux */}
        {items.length > 0 && (
          <div className="border-t-2 border-gray-200 bg-white p-4 space-y-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {/* Détail des totaux */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Sous-total ({summary.total_items} pièce{summary.total_items > 1 ? 's' : ''})</span>
                <span className="font-medium">{formatPrice(summary.subtotal)}</span>
              </div>
              
              {summary.consigne_total > 0 && (
                <div className="flex justify-between text-amber-700 bg-amber-50 -mx-4 px-4 py-1.5">
                  <span className="flex items-center gap-1">
                    <span>♻️</span>
                    <span>Consignes (remboursables)</span>
                  </span>
                  <span className="font-medium">+{formatPrice(summary.consigne_total)}</span>
                </div>
              )}

              {/* Livraison */}
              <div className="flex justify-between">
                <span className="text-gray-600">Livraison</span>
                {summary.subtotal >= 150 ? (
                  <span className="text-green-600 font-semibold flex items-center gap-1">
                    <span className="line-through text-gray-400 text-xs">9,90€</span>
                    GRATUITE
                  </span>
                ) : (
                  <span className="text-gray-600">Calculée au checkout</span>
                )}
              </div>
            </div>

            {/* Total TTC */}
            <div className="flex justify-between items-center pt-3 border-t-2 border-dashed border-gray-200">
              <div>
                <span className="font-bold text-lg">Total TTC</span>
                <p className="text-[10px] text-gray-500">TVA incluse</p>
              </div>
              <span className="font-bold text-2xl text-blue-600">{formatPrice(summary.total_price)}</span>
            </div>

            {/* Boutons */}
            <div className="space-y-2 pt-2">
              <Button
                asChild
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-base py-5 shadow-lg"
              >
                <Link to="/checkout" onClick={onClose}>
                  ✅ Valider ma commande
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
                    📋 Voir détails
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
                  🗑️ Vider
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
 * 🧩 CartSidebarItem - Item lisible avec toutes les infos
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
    <div className="flex gap-3 p-3 hover:bg-gray-50 transition-colors group">
      {/* Image */}
      <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border">
        <img
          src={imageUrl}
          alt={item.product_name || 'Produit'}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/images/no.png';
          }}
        />
      </div>

      {/* Détails produit */}
      <div className="flex-1 min-w-0">
        {/* Marque */}
        {item.product_brand && (
          <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">
            {item.product_brand}
          </p>
        )}
        
        {/* Nom produit */}
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
          {item.product_name || 'Produit'}
        </h3>
        
        {/* Référence */}
        {item.product_ref && (
          <p className="text-[10px] text-gray-500 mt-0.5">
            Réf: {item.product_ref}
          </p>
        )}

        {/* Prix unitaire + Quantité + Total */}
        <div className="flex items-center justify-between mt-2">
          {/* Sélecteur quantité */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-1 py-0.5">
            <button
              onClick={() => onQuantityChange(item.quantity - 1)}
              disabled={item.quantity <= 1}
              className="h-6 w-6 text-sm flex items-center justify-center hover:bg-white rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-bold"
            >
              −
            </button>
            <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
            <button
              onClick={() => onQuantityChange(item.quantity + 1)}
              className="h-6 w-6 text-sm flex items-center justify-center hover:bg-white rounded transition-colors font-bold"
            >
              +
            </button>
          </div>

          {/* Prix */}
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">{formatPrice(totalPrice)}</p>
            {item.quantity > 1 && (
              <p className="text-[10px] text-gray-500">{formatPrice(unitPrice)}/pièce</p>
            )}
          </div>
        </div>

        {/* Consigne si applicable */}
        {item.consigne_unit && item.consigne_unit > 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full w-fit">
            <span>♻️</span>
            <span>+{formatPrice(item.consigne_unit * item.quantity)} consigne</span>
          </div>
        )}
      </div>

      {/* Bouton supprimer */}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all flex-shrink-0 flex items-center justify-center"
        aria-label="Supprimer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
