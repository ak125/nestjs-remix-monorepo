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
import { Link } from "@remix-run/react";
import { AlertCircle, ShoppingBag, X } from "lucide-react";

import { useCart, formatPrice, getProductImageUrl } from "../../hooks/useCart";
import { cn } from "../../lib/utils";
import { type CartItem } from "../../types/cart";
import { Button } from "../ui/button";
import { Badge } from "~/components/ui";

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
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header compact */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-5 w-5" />
            <div>
              <h2 className="text-base font-bold">Mon Panier</h2>
              <p className="text-xs text-blue-100">
                {summary.total_items} article
                {summary.total_items > 1 ? "s" : ""}
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

        {/* 🚚 LIVRAISON GRATUITE - Bannière toujours visible */}
        <div
          className={cn(
            "px-4 py-3 border-b-2",
            items.length > 0 && summary.subtotal >= 150
              ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-green-600"
              : "bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-blue-200",
          )}
        >
          {items.length > 0 && summary.subtotal >= 150 ? (
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-2 animate-bounce">
                <span className="text-2xl">🎉</span>
                <span className="text-2xl">🚚</span>
              </div>
              <div className="text-center">
                <p className="font-black text-base tracking-wide">
                  LIVRAISON GRATUITE !
                </p>
                <p className="text-xs opacity-90">
                  Vous économisez 9,90€ • Expédition 24-48h
                </p>
              </div>
              <span className="text-2xl">✅</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl animate-pulse">🚚</span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      Livraison GRATUITE
                    </p>
                    <p className="text-xs text-gray-500">
                      à partir de 150€ d'achat
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                    dès 150€
                  </span>
                </div>
              </div>
              {items.length > 0 && (
                <div className="relative mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-green-400 via-green-500 to-emerald-500 h-3 rounded-full transition-all duration-700 ease-out relative"
                      style={{
                        width: `${Math.min((summary.subtotal / 150) * 100, 100)}%`,
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 items-center">
                    <span className="text-sm font-bold text-gray-800">
                      {formatPrice(summary.subtotal)}
                    </span>
                    <span className="text-sm font-bold text-orange-600 flex items-center gap-1">
                      <span>⚡</span>
                      Plus que {formatPrice(150 - summary.subtotal)} !
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

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
            <div className="divide-y-0">
              {/* Titre liste */}
              <div className="px-4 py-2.5 bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                  <span>📦</span>
                  <span>
                    {items.length} article{items.length > 1 ? "s" : ""}
                  </span>
                </p>
              </div>

              {/* DEBUG VISUEL - Afficher les données brutes */}
              <div className="p-2 bg-yellow-100 text-xs">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(
                    items.map((i) => ({
                      id: i.id?.substring(0, 10),
                      name: i.product_name,
                      brand: i.product_brand,
                      sku: i.product_sku,
                      qty: i.quantity,
                      price: i.price,
                    })),
                    null,
                    2,
                  )}
                </pre>
              </div>

              {items.map((item, index) => (
                <CartSidebarItem
                  key={item.id || `item-${index}`}
                  item={item}
                  onRemove={() => removeItem(parseInt(item.product_id, 10))}
                  onQuantityChange={(qty) =>
                    updateQuantity(parseInt(item.product_id, 10), qty)
                  }
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
                <span>
                  Sous-total ({summary.total_items} pièce
                  {summary.total_items > 1 ? "s" : ""})
                </span>
                <span className="font-medium">
                  {formatPrice(summary.subtotal)}
                </span>
              </div>

              {summary.consigne_total > 0 && (
                <div className="flex justify-between text-amber-700 bg-amber-50 -mx-4 px-4 py-1.5">
                  <span className="flex items-center gap-1">
                    <span>♻️</span>
                    <span>Consignes (remboursables)</span>
                  </span>
                  <span className="font-medium">
                    +{formatPrice(summary.consigne_total)}
                  </span>
                </div>
              )}

              {/* Livraison */}
              <div className="flex justify-between">
                <span className="text-gray-600">Livraison</span>
                {summary.subtotal >= 150 ? (
                  <span className="text-green-600 font-semibold flex items-center gap-1">
                    <span className="line-through text-gray-400 text-xs">
                      9,90€
                    </span>
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
              <span className="font-bold text-2xl text-blue-600">
                {formatPrice(summary.total_price)}
              </span>
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
                <Button variant="outline" size="sm" asChild className="flex-1">
                  <Link to="/cart" rel="nofollow" onClick={onClose}>
                    📋 Voir détails
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (confirm("Vider le panier ?")) {
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

function CartSidebarItem({
  item,
  onRemove,
  onQuantityChange,
}: CartSidebarItemProps) {
  // Extraire les données avec fallbacks robustes
  const imageUrl = getProductImageUrl(item);
  const unitPrice = Number(item.unit_price) || Number(item.price) || 0;
  const totalPrice = unitPrice * (item.quantity || 1);
  const reference = item.product_ref || item.product_sku || item.product_id;
  const brand = item.product_brand;
  const name = item.product_name || item.name || `Produit #${item.product_id}`;
  const qty = item.quantity || 1;

  return (
    <div className="flex gap-3 p-4 hover:bg-blue-50/50 transition-colors group border-b border-gray-100 last:border-b-0">
      {/* Image avec badge quantité */}
      <div className="relative flex-shrink-0">
        <div className="w-20 h-20 bg-white rounded-xl overflow-hidden border-2 border-gray-100 shadow-sm">
          <img
            src={imageUrl}
            alt={name}
            width={80}
            height={80}
            className="w-full h-full object-contain p-1"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/images/no.png";
            }}
          />
        </div>
        {/* Badge quantité sur l'image */}
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
          {qty}
        </div>
      </div>

      {/* Détails produit */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Ligne marque + ref */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {brand &&
            brand !== "MARQUE INCONNUE" &&
            brand !== "Non spécifiée" && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 font-semibold"
              >
                {brand}
              </Badge>
            )}
          {reference && (
            <span className="text-[10px] text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
              {reference}
            </span>
          )}
        </div>

        {/* Nom produit */}
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-2">
          {name}
        </h3>

        {/* Ligne prix + quantité */}
        <div className="flex items-center justify-between mt-auto">
          {/* Sélecteur quantité */}
          <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
            <button
              onClick={() => onQuantityChange(qty - 1)}
              disabled={qty <= 1}
              className="h-7 w-7 flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
            >
              <span className="text-lg font-medium">−</span>
            </button>
            <span className="w-8 text-center text-sm font-bold text-gray-900">
              {qty}
            </span>
            <button
              onClick={() => onQuantityChange(qty + 1)}
              className="h-7 w-7 flex items-center justify-center hover:bg-gray-200 transition-colors text-gray-600"
            >
              <span className="text-lg font-medium">+</span>
            </button>
          </div>

          {/* Prix */}
          <div className="text-right">
            <p className="text-base font-bold text-blue-600">
              {formatPrice(totalPrice)}
            </p>
            {qty > 1 && (
              <p className="text-[10px] text-gray-500">
                {formatPrice(unitPrice)} × {qty}
              </p>
            )}
          </div>
        </div>

        {/* Consigne si applicable */}
        {item.consigne_unit && Number(item.consigne_unit) > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg w-fit">
            <span>♻️</span>
            <span>
              +{formatPrice(Number(item.consigne_unit) * qty)} consigne
            </span>
          </div>
        )}
      </div>

      {/* Bouton supprimer */}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0 flex items-center justify-center self-start"
        aria-label="Supprimer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
