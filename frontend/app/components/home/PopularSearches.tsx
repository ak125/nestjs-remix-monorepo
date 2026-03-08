import { Link } from "@remix-run/react";
import { TrendingUp } from "lucide-react";

const POPULAR = [
  {
    label: "Trouver des disques de frein par véhicule",
    href: "/pieces/freinage",
  },
  { label: "Vérifier une référence alternateur", href: "/pieces/electrique" },
  { label: "Choisir une batterie compatible", href: "/pieces/electrique" },
  { label: "Identifier une vanne EGR", href: "/pieces/alimentation" },
  { label: "Trouver un kit d'embrayage", href: "/pieces/embrayage" },
  { label: "Comparer des plaquettes de frein", href: "/pieces/freinage" },
];

export default function PopularSearches() {
  return (
    <section className="bg-slate-50 border-t border-slate-100">
      <div className="mx-auto max-w-[1280px] px-5 py-6 lg:px-8 lg:py-8">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-slate-400" />
          <h2 className="text-[15px] lg:text-[17px] font-semibold text-slate-700 tracking-[-0.02em]">
            Recherches fréquentes
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {POPULAR.map((p) => (
            <Link
              key={p.label}
              to={p.href}
              className="inline-flex items-center min-h-[44px] rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-600 hover:border-cta/30 hover:bg-orange-50 hover:text-cta transition-colors"
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
