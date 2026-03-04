import { Link } from "@remix-run/react";
import { ArrowRight, CheckCircle, ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { type GammePageMotorisationItem } from "~/types/gamme-page-contract.types";

interface GammeMotorisationsV9Props {
  items: GammePageMotorisationItem[];
  totalCount?: number;
}

export default function GammeMotorisationsV9({
  items,
  totalCount,
}: GammeMotorisationsV9Props) {
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search
    ? items.filter(
        (m) =>
          m.marque_name.toLowerCase().includes(search.toLowerCase()) ||
          m.modele_name.toLowerCase().includes(search.toLowerCase()) ||
          m.type_name.toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  const visible = showAll ? filtered : filtered.slice(0, 4);
  const count = totalCount || items.length;

  return (
    <section id="compat" className="py-7 lg:py-10 bg-slate-50 scroll-mt-16">
      <div className="px-5 lg:px-8 max-w-[1280px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] lg:text-[24px] font-bold text-slate-900 tracking-tight font-v9-heading">
            Compatibilités
          </h2>
          <Badge
            variant="outline"
            className="text-[12px] font-bold text-blue-600 bg-blue-50 border-blue-100"
          >
            {count}
          </Badge>
        </div>

        {/* Search on desktop */}
        {items.length > 6 && (
          <div className="relative mb-4 lg:max-w-sm">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10"
            />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowAll(true);
              }}
              className="pl-9 bg-white border-slate-200 rounded-xl text-[13px] focus-visible:border-blue-400 focus-visible:ring-blue-400/10"
              placeholder="Rechercher marque, modèle..."
            />
          </div>
        )}

        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3">
          {visible.map((m, i) => (
            <Link
              key={`${m.marque_name}-${m.modele_name}-${m.type_name}-${i}`}
              to={m.link || "#"}
              className="bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:border-blue-100 hover:-translate-y-0.5 transition-all duration-200 group block"
            >
              <div className="flex items-start justify-between mb-2.5">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {m.marque_name}
                  </div>
                  <div className="text-[14px] font-semibold text-slate-800 mt-0.5 font-v9-heading group-hover:text-blue-700 transition-colors">
                    {m.modele_name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-bold text-slate-800 font-v9-heading">
                    {m.type_name}
                  </div>
                  {m.puissance && (
                    <div className="text-[10px] text-slate-500 font-normal">
                      {m.puissance}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
                    <CheckCircle size={7} /> Compatible
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1 group-hover:gap-1.5 transition-all">
                  Voir les pièces <ArrowRight size={11} />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && search && (
          <div className="py-8 text-center animate-v9-fade-in">
            <Search size={24} className="text-slate-300 mx-auto mb-2" />
            <div className="text-[13px] text-slate-400">
              Aucune motorisation trouvée pour &ldquo;{search}&rdquo;
            </div>
          </div>
        )}

        {!showAll && filtered.length > 4 && (
          <Button
            variant="outline"
            onClick={() => setShowAll(true)}
            className="w-full mt-3.5 py-3 h-auto rounded-xl text-[13px] font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200"
          >
            Voir les {filtered.length - 4} autres compatibilités{" "}
            <ChevronDown size={14} className="ml-1" />
          </Button>
        )}
      </div>
    </section>
  );
}
