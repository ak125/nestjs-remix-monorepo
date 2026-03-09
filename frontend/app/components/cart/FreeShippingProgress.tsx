import { Truck } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { formatPrice, FREE_SHIPPING_THRESHOLD } from "./cart-utils";

export function FreeShippingProgress({ subtotal }: { subtotal: number }) {
  const progress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const remaining = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
  const isEligible = subtotal >= FREE_SHIPPING_THRESHOLD;

  if (isEligible) {
    return (
      <div className="rounded-xl p-3 sm:p-4 mb-4 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white shadow-md">
        <div className="flex items-center gap-3">
          <Truck className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
          <p className="font-bold text-sm sm:text-base flex-1">
            Livraison OFFERTE
          </p>
          <Badge
            variant="secondary"
            size="sm"
            className="bg-white/20 text-white border-0 text-xs"
          >
            0,00&nbsp;{"\u20ac"}
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-4 mb-4 bg-white border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-cta" />
          <p className="text-sm font-semibold text-slate-900">
            Livraison offerte d{"\u00e8"}s{" "}
            {formatPrice(FREE_SHIPPING_THRESHOLD)}
          </p>
        </div>
        {progress >= 70 && (
          <span className="text-xs text-cta font-medium">
            {progress >= 90 ? "Presque !" : "Encore un peu !"}
          </span>
        )}
      </div>

      <div className="w-full bg-slate-100 rounded-full h-2 mb-2.5">
        <div
          className="bg-gradient-to-r from-cta to-emerald-500 rounded-full h-2 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-sm text-slate-600">
        Ajoutez encore{" "}
        <span className="font-bold text-cta">{formatPrice(remaining)}</span>{" "}
        pour en profiter
      </p>
    </div>
  );
}
