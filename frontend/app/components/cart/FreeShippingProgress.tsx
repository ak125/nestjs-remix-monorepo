import { Sparkles, Truck } from "lucide-react";
import { formatPrice, FREE_SHIPPING_THRESHOLD } from "./cart-utils";

export function FreeShippingProgress({
  subtotal,
  className = "",
}: {
  subtotal: number;
  className?: string;
}) {
  const remaining = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
  const progress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const unlocked = subtotal >= FREE_SHIPPING_THRESHOLD;

  if (unlocked) {
    return (
      <section
        className={`overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 shadow-sm ${className}`}
        aria-label="Livraison offerte d\u00e9bloqu\u00e9e"
      >
        <div className="px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Truck className="h-4 w-4" />
            </div>

            <p className="min-w-0 flex-1 text-sm font-bold text-emerald-800">
              Livraison offerte d{"\u00e9"}bloqu{"\u00e9"}e
            </p>

            <div className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              Offerte
            </div>
          </div>

          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 to-green-500" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50 via-yellow-50 to-orange-50 shadow-sm ${className}`}
      aria-label="Progression vers la livraison offerte"
    >
      <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-300 px-4 py-1.5 text-center">
        <Sparkles className="h-4 w-4 text-orange-700" />
        <h2 className="text-sm font-bold tracking-tight text-slate-900">
          Livraison offerte d{"\u00e8"}s {formatPrice(FREE_SHIPPING_THRESHOLD)}
        </h2>
      </div>

      <div className="px-4 py-2.5">
        <p className="text-center text-sm font-medium text-slate-800">
          Plus que{" "}
          <span className="font-bold text-orange-600">
            {formatPrice(remaining)}
          </span>{" "}
          pour en profiter
        </p>

        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Progression</span>
            <span>{Math.round(progress)}%</span>
          </div>

          <div className="h-4 w-full overflow-hidden rounded-full bg-white/90 ring-1 ring-black/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
