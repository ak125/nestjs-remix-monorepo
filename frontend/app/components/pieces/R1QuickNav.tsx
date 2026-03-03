/**
 * R1 Quick Nav — barre horizontale de chips ancres pour navigation rapide.
 * Pur client-side, pas de data fetching.
 */
import { Car, HelpCircle, Package, ShieldCheck, Wrench } from "lucide-react";
import { memo } from "react";

const NAV_ITEMS = [
  { id: "compatibilities", label: "Motorisations", Icon: Car },
  { id: "compatibility-check", label: "Vérifications", Icon: ShieldCheck },
  { id: "brands", label: "Équipementiers", Icon: Wrench },
  { id: "family", label: "Autres pièces", Icon: Package },
  { id: "faq", label: "FAQ", Icon: HelpCircle },
] as const;

export const R1QuickNav = memo(function R1QuickNav() {
  return (
    <nav
      aria-label="Navigation rapide"
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
    >
      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() =>
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
          }
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </nav>
  );
});
