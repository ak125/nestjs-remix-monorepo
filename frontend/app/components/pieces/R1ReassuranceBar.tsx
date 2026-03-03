/**
 * Barre de rassurance R1 — 3 cartes compactes sous le Hero.
 * Compatibilité vérifiée / Livraison rapide / Retours 30 jours.
 */
import { RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { memo } from "react";

const ITEMS = [
  {
    icon: ShieldCheck,
    title: "Compatibilité vérifiée",
    subtitle: "Par code moteur et Type Mine",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    icon: Truck,
    title: "Livraison 24–48h",
    subtitle: "Expédition le jour même avant 15h",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: RotateCcw,
    title: "Retours 30 jours",
    subtitle: "Satisfait ou remboursé",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
] as const;

export const R1ReassuranceBar = memo(function R1ReassuranceBar() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {ITEMS.map((item) => (
        <div
          key={item.title}
          className={`flex items-center gap-3 rounded-xl border border-gray-100 ${item.bg} p-3 sm:p-4`}
        >
          <div className="flex-shrink-0">
            <item.icon className={`w-6 h-6 ${item.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">
              {item.title}
            </p>
            <p className="text-xs text-gray-500 leading-tight mt-0.5">
              {item.subtitle}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
});
