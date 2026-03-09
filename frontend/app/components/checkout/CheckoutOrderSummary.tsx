import { Link } from "@remix-run/react";
import { CreditCard, Shield, Truck } from "lucide-react";

import {
  type CartItem as CartItemType,
  type CartSummary as CartSummaryType,
} from "~/schemas/cart.schemas";
import { FreeShippingBar } from "./FreeShippingBar";
import { PromoCodeInput } from "./PromoCodeInput";

interface Props {
  cart: {
    items: CartItemType[];
    summary: CartSummaryType;
  };
  total: number;
  onCartUpdated?: () => void;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

export function CheckoutOrderSummary({ cart, total, onCartUpdated }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-8 space-y-4">
      {/* Free shipping progress bar */}
      <FreeShippingBar subtotal={cart.summary.subtotal} />

      <h3 className="font-semibold text-slate-900">Resume</h3>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Sous-total</span>
          <span className="font-medium text-slate-900">
            {formatPrice(cart.summary.subtotal)}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Livraison</span>
          {cart.summary.shipping_cost > 0 ? (
            <span className="font-medium text-slate-900">
              {formatPrice(cart.summary.shipping_cost)}
            </span>
          ) : (
            <span className="font-medium text-green-600">Offerte</span>
          )}
        </div>

        {cart.summary.tax_amount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">TVA (20%)</span>
            <span className="font-medium text-slate-900">
              {formatPrice(cart.summary.tax_amount)}
            </span>
          </div>
        )}

        {(cart.summary.consigne_total ?? 0) > 0 && (
          <div className="flex justify-between text-sm bg-amber-50 -mx-6 px-6 py-3 border-y border-amber-100">
            <span className="flex items-center gap-2 text-amber-700 font-medium">
              &#9851; Consignes
            </span>
            <span className="font-semibold text-amber-700">
              {formatPrice(cart.summary.consigne_total)}
            </span>
          </div>
        )}

        <div className="pt-3 border-t border-slate-200">
          <div className="flex justify-between">
            <span className="font-bold text-slate-900 text-lg">Total</span>
            <span className="font-bold text-cta text-2xl">
              {formatPrice(total)}
            </span>
          </div>
        </div>
      </div>

      {/* Promo code input */}
      <PromoCodeInput onPromoApplied={onCartUpdated} />

      {/* Consigne info */}
      {cart.items.some((item: CartItemType) => item.has_consigne) && (
        <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
          <p className="text-xs text-amber-800">
            Les consignes seront remboursees lors du retour des pieces usagees
          </p>
        </div>
      )}

      {/* Cart items recap */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-500 mb-3">
          {cart.items.length} article{cart.items.length > 1 ? "s" : ""}
        </p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {cart.items.map((item: CartItemType) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="text-slate-700 truncate">{item.product_name}</p>
                <p className="text-xs text-slate-400">
                  Qte {item.quantity} &middot; {formatPrice(item.price)}
                </p>
              </div>
              <span className="font-medium text-slate-900 flex-shrink-0">
                {formatPrice(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Back to cart */}
      <div className="mt-4">
        <Link
          to="/cart"
          className="w-full inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Retour au panier
        </Link>
      </div>

      {/* Trust badges */}
      <div className="mt-4 rounded-xl border p-3 flex items-center justify-around text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <Truck className="h-4 w-4 text-blue-600" />
          24-48h
        </span>
        <span className="text-gray-300">|</span>
        <span className="flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-green-600" />
          <span className="hidden sm:inline">Paiement </span>securise
        </span>
        <span className="text-gray-300">|</span>
        <span className="flex items-center gap-1.5">
          <CreditCard className="h-4 w-4 text-purple-600" />
          3D Secure
        </span>
      </div>
    </div>
  );
}
