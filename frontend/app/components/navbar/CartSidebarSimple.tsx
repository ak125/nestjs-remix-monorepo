/**
 * 🛒 CartSidebarSimple - Version simplifiée avec résumé uniquement
 *
 * Affiche un résumé du panier + livraison gratuite
 * Utilise les données SSR du root loader (useRootCart)
 * Sans liste détaillée des articles (voir /cart pour ça)
 */

import { Badge } from "@fafa/ui";
import { Link } from "@remix-run/react";
import { X, ShoppingBag } from "lucide-react";

import { useRootCart } from "../../root";
import { cn } from "../../lib/utils";

interface CartSidebarSimpleProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper: formater le prix
function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

export function CartSidebarSimple({ isOpen, onClose }: CartSidebarSimpleProps) {
  // Données du root loader (SSR) - pas besoin de fetch supplémentaire
  const rootCart = useRootCart();

  // Extraire les données du panier
  const itemCount = rootCart?.summary?.total_items || 0;
  const subtotal = rootCart?.summary?.subtotal || 0;
  const consigneTotal = rootCart?.summary?.consigne_total || 0;
  const total = subtotal + consigneTotal;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-50",
          "transform transition-transform duration-300",
          "flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header compact & dynamique */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="font-bold text-sm">Panier</span>
            {itemCount > 0 && (
              <span className="bg-white text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                {itemCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Livraison gratuite - toujours visible */}
        <div
          className={cn(
            "px-4 py-4 border-b",
            subtotal >= 150
              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
              : "bg-gradient-to-r from-blue-50 to-indigo-50",
          )}
        >
          {subtotal >= 150 ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-bounce">🎉</span>
              <div>
                <p className="font-bold text-lg">Livraison OFFERTE !</p>
                <p className="text-xs opacity-90">Vous économisez 9,90€</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-800">
                  🚚 Livraison gratuite dès 150€
                </span>
                <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                  {Math.round((subtotal / 150) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((subtotal / 150) * 100, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-center bg-amber-50 border border-amber-200 rounded-lg py-1.5 px-2">
                <p className="text-xs text-gray-700">
                  💡 Plus que{" "}
                  <span className="font-bold text-blue-600">
                    {formatPrice(Math.max(150 - subtotal, 0))}
                  </span>{" "}
                  pour débloquer !
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Contenu principal - Résumé ou panier vide */}
        <div className="p-4">
          {itemCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <ShoppingBag className="h-16 w-16 mb-4 opacity-50" />
              <p className="font-medium text-lg">Votre panier est vide</p>
              <p className="text-sm mt-2">Découvrez nos pièces auto</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Résumé compact */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Articles</span>
                  <Badge variant="info" className="text-sm px-3 py-1">
                    {itemCount} pièce{itemCount > 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Sous-total</span>
                  <span className="font-semibold">{formatPrice(subtotal)}</span>
                </div>

                {consigneTotal > 0 && (
                  <div className="flex justify-between text-amber-700 bg-amber-50 -mx-4 px-4 py-2 rounded">
                    <span>♻️ Consignes</span>
                    <span className="font-medium">
                      +{formatPrice(consigneTotal)}
                    </span>
                  </div>
                )}

                {/* Livraison - Affichée uniquement si gratuite */}
                {subtotal >= 150 && (
                  <div className="flex justify-between items-center bg-green-50 -mx-4 px-4 py-2 rounded border border-green-200">
                    <span className="text-green-700">🚚 Livraison</span>
                    <span className="text-green-600 font-bold">✓ OFFERTE</span>
                  </div>
                )}

                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="font-bold text-lg">Total TTC</span>
                  <span className="font-bold text-2xl text-blue-600">
                    {formatPrice(total)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Boutons d'action */}
        <div className="border-t bg-white p-4 space-y-3 mt-auto">
          {itemCount > 0 && (
            <Link
              to="/cart"
              rel="nofollow"
              onClick={onClose}
              className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
            >
              <span className="text-white font-bold text-lg">
                📋 Voir mon panier
              </span>
            </Link>
          )}
          <Link
            to="/"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-center block transition-colors"
          >
            🛍️ Continuer mes achats
          </Link>
        </div>
      </div>
    </>
  );
}

export default CartSidebarSimple;
