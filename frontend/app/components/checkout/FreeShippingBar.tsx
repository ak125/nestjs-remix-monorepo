import { Truck } from "lucide-react";

const FREE_SHIPPING_THRESHOLD = 150;

function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

interface Props {
  subtotal: number;
  threshold?: number;
}

export function FreeShippingBar({
  subtotal,
  threshold = FREE_SHIPPING_THRESHOLD,
}: Props) {
  const progress = Math.min((subtotal / threshold) * 100, 100);
  const remaining = Math.max(threshold - subtotal, 0);
  const isEligible = subtotal >= threshold;

  if (isEligible) {
    return (
      <div className="rounded-xl p-3 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 flex-shrink-0" />
          <p className="font-bold text-sm flex-1">Livraison OFFERTE</p>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
            0,00&nbsp;&euro;
          </span>
        </div>
      </div>
    );
  }

  const getMessage = () => {
    if (progress >= 90) return "Presque !";
    if (progress >= 70) return "Encore un effort !";
    return "";
  };

  return (
    <div className="rounded-xl p-3 bg-white border border-slate-200">
      <div className="flex items-center gap-2 mb-2">
        <Truck className="h-4 w-4 text-cta flex-shrink-0" />
        <p className="text-xs text-slate-700 flex-1">
          Plus que{" "}
          <strong className="text-cta">{formatPrice(remaining)}</strong> pour la
          livraison gratuite
        </p>
        {getMessage() && (
          <span className="text-xs text-slate-500">{getMessage()}</span>
        )}
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5">
        <div
          className="bg-gradient-to-r from-cta to-emerald-500 rounded-full h-1.5 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
