import { Link } from "@remix-run/react";
import { Sparkles, Truck } from "lucide-react";
import { formatPrice, FREE_SHIPPING_THRESHOLD } from "./cart-utils";

export function FreeShippingProgress({
  subtotal,
  className = "",
  vehicleUrl,
}: {
  subtotal: number;
  className?: string;
  vehicleUrl?: string;
}) {
  const remaining = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
  const progress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const unlocked = subtotal >= FREE_SHIPPING_THRESHOLD;

  if (unlocked) {
    return (
      <section
        className={`overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 shadow-sm ${className}`}
        aria-label="Livraison offerte d\u00e9bloqu\u00e9e"
      >
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-sm">
              <Truck className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold tracking-tight text-emerald-800 sm:text-xl">
                Livraison offerte d{"\u00e9"}bloqu{"\u00e9"}e
              </p>
              <p className="mt-1 text-sm text-emerald-700 sm:text-base">
                Votre commande b{"\u00e9"}n{"\u00e9"}ficie maintenant de la
                livraison offerte.
              </p>
            </div>

            <div className="hidden rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white sm:block">
              Offerte
            </div>
          </div>

          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 to-green-500" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 via-yellow-50 to-orange-50 shadow-md ${className}`}
      aria-label="Progression vers la livraison offerte"
    >
      <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-300 px-6 py-4 text-center">
        <Sparkles className="h-5 w-5 text-orange-700" />
        <h2 className="text-xl font-black tracking-tight text-slate-900">
          Livraison offerte d{"\u00e8"}s {formatPrice(FREE_SHIPPING_THRESHOLD)}
        </h2>
      </div>

      <div className="px-6 py-6">
        <p className="text-center text-lg font-medium text-slate-800">
          Ajoutez encore{" "}
          <span className="font-black text-orange-600">
            {formatPrice(remaining)}
          </span>{" "}
          pour d{"\u00e9"}bloquer la{" "}
          <span className="font-black text-slate-900">livraison offerte</span>
        </p>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Progression</span>
            <span>{Math.round(progress)}%</span>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-white shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600">
          <Truck className="h-4 w-4 text-emerald-600" />
          <span>
            Plus votre panier augmente, plus vite vous d{"\u00e9"}bloquez la
            livraison offerte.
          </span>
        </div>

        {vehicleUrl && (
          <div className="mt-5 flex justify-center">
            <Link
              to={vehicleUrl}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Voir des pi{"\u00e8"}ces compatibles pour atteindre{" "}
              {formatPrice(FREE_SHIPPING_THRESHOLD)}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
