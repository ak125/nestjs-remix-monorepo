import { Link } from "@remix-run/react";
import {
  Car,
  CheckCircle,
  CreditCard,
  Package,
  RotateCcw,
  Shield,
  Truck,
} from "lucide-react";

import {
  type CartItem as CartItemType,
  type CartSummary as CartSummaryType,
} from "~/schemas/cart.schemas";
import { calculateDeliveryETA, type StockStatus } from "~/utils/delivery-eta";
import { type VehicleCookie } from "~/utils/vehicle-cookie";
import { FreeShippingBar } from "./FreeShippingBar";
import { PromoCodeInput } from "./PromoCodeInput";

interface Props {
  cart: {
    items: CartItemType[];
    summary: CartSummaryType;
  };
  total: number;
  vehicle?: VehicleCookie | null;
  onCartUpdated?: () => void;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

export function CheckoutOrderSummary({
  cart,
  total,
  vehicle,
  onCartUpdated,
}: Props) {
  const vehicleLabel = vehicle
    ? [vehicle.marque_name, vehicle.modele_name, vehicle.type_name]
        .filter(Boolean)
        .join(" ")
    : null;

  // Delivery ETA — map stock_available to StockStatus
  const stockStatuses: StockStatus[] = cart.items.map((item) => {
    if (item.stock_available == null || item.stock_available > 5)
      return "in-stock";
    if (item.stock_available > 0) return "low-stock";
    return "out-of-stock";
  });
  const deliveryETA = calculateDeliveryETA(stockStatuses, "standard");

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-8 space-y-4">
      {/* Vehicle context */}
      {vehicleLabel && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <Car className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">
              {vehicleLabel}
            </p>
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
              <CheckCircle className="h-3 w-3" />
              Compatibilite verifiee
            </span>
          </div>
        </div>
      )}

      <h3 className="font-semibold text-slate-900">Votre commande</h3>

      {/* Delivery ETA */}
      <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <Truck className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-slate-800">
            Livraison estimee {deliveryETA.formattedRange}
          </p>
          {deliveryETA.estimatedDays <= 3 && (
            <p className="text-xs text-blue-600 mt-0.5">Expedition sous 24h</p>
          )}
        </div>
      </div>

      {/* Free shipping progress bar */}
      <FreeShippingBar subtotal={cart.summary.subtotal} />

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
          {/* Contextual reassurance messages */}
          <div className="mt-2 space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-emerald-600">
              <Package className="h-3 w-3 flex-shrink-0" />
              {cart.items.length} article{cart.items.length > 1 ? "s" : ""} pret
              {cart.items.length > 1 ? "s" : ""} a etre expedie
              {cart.items.length > 1 ? "s" : ""}
            </p>
            {vehicleLabel && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle className="h-3 w-3 flex-shrink-0" />
                Pieces compatibles avec votre vehicule
              </p>
            )}
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

      {/* Cart items recap — enriched with images + brand + ref */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-500 mb-3">
          {cart.items.length} article{cart.items.length > 1 ? "s" : ""}
        </p>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {cart.items.map((item: CartItemType) => (
            <div key={item.id} className="flex items-start gap-3">
              {/* Product thumbnail */}
              <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex-shrink-0 overflow-hidden">
                {item.product_image ? (
                  <img
                    src={item.product_image}
                    alt=""
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 truncate leading-tight">
                  {item.product_name}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {item.product_brand && (
                    <span className="font-medium text-slate-500">
                      {item.product_brand}
                    </span>
                  )}
                  {item.product_brand && item.product_sku && (
                    <span> &middot; </span>
                  )}
                  {item.product_sku && <span>Ref {item.product_sku}</span>}
                  {(item.product_brand || item.product_sku) && (
                    <span> &middot; </span>
                  )}
                  Qte {item.quantity}
                </p>
              </div>
              <span className="text-sm font-medium text-slate-900 flex-shrink-0">
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

      {/* Trust badges — 4 columns */}
      <div className="mt-4 rounded-xl border p-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <Truck className="h-4 w-4 text-blue-600 flex-shrink-0" />
          Expedition 24-48h
        </span>
        <span className="flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-green-600 flex-shrink-0" />
          Paiement securise
        </span>
        <span className="flex items-center gap-1.5">
          <CreditCard className="h-4 w-4 text-purple-600 flex-shrink-0" />
          3D Secure
        </span>
        <span className="flex items-center gap-1.5">
          <RotateCcw className="h-4 w-4 text-orange-500 flex-shrink-0" />
          Retours 30 jours
        </span>
      </div>
    </div>
  );
}
