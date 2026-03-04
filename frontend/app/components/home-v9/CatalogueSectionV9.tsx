import { Link } from "@remix-run/react";
import { ArrowRight, Search } from "lucide-react";
import { useState } from "react";
import {
  CATALOG_DOMAINS,
  type CatalogFamily,
} from "~/components/home/constants";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { getFamilyTheme } from "~/utils/family-theme";

// Check if a family belongs to a domain tab
function familyMatchesDomain(
  familyName: string,
  domainFamilies: string[] | null,
): boolean {
  if (!domainFamilies) return true; // "Tout" tab
  return domainFamilies.some(
    (df) => df.toLowerCase() === familyName.toLowerCase(),
  );
}

// Check if a family is popular
function isPopular(name: string): boolean {
  const pop = [
    "filtration",
    "freinage",
    "courroie",
    "distribution",
    "embrayage",
  ];
  return pop.some((p) => name.toLowerCase().includes(p));
}

export default function CatalogueSectionV9({
  families,
}: {
  families: CatalogFamily[];
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [catSearch, setCatSearch] = useState("");

  const activeDomain = CATALOG_DOMAINS[activeTab];
  const filtered = families
    .filter((f) => familyMatchesDomain(f.n, activeDomain?.families ?? null))
    .filter(
      (f) =>
        catSearch === "" || f.n.toLowerCase().includes(catSearch.toLowerCase()),
    );

  return (
    <section className="py-7 lg:py-10 bg-white">
      <div className="px-5 lg:px-8 max-w-[1280px] mx-auto">
        {/* Header */}
        <div className="mb-2">
          <h2 className="text-[20px] lg:text-[24px] font-bold text-slate-900 tracking-tight font-v9-heading">
            Catalogue pièces auto
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Pièces neuves pour toutes marques — {families.length} familles
            techniques
          </p>
        </div>

        {/* Search + Category tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 mb-4">
          <div className="relative lg:w-64">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10"
            />
            <Input
              value={catSearch}
              onChange={(e) => setCatSearch(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200 rounded-xl text-[13px] focus-visible:border-blue-400 focus-visible:ring-blue-400/10"
              placeholder="Filtrer les familles..."
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-3 lg:pb-0 hide-scroll">
            {CATALOG_DOMAINS.map((domain, idx) => {
              const count =
                domain.families === null
                  ? families.length
                  : families.filter((f) =>
                      familyMatchesDomain(f.n, domain.families),
                    ).length;
              const Icon = domain.icon;
              return (
                <button
                  key={domain.label}
                  type="button"
                  onClick={() => {
                    setActiveTab(idx);
                    setCatSearch("");
                  }}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === idx
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  <Icon size={13} />
                  {domain.label}
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                      activeTab === idx
                        ? "bg-white/20 text-white border-0"
                        : "bg-white text-slate-500 border-0"
                    }`}
                  >
                    {count}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid — enriched cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((fam) => {
            const theme = getFamilyTheme(fam.n);
            const pop = isPopular(fam.n);
            const maxGammes = 4;
            const visibleGammes = fam.gammes.slice(0, maxGammes);
            const extraCount = fam.gammes.length - maxGammes;

            return (
              <div
                key={fam.n}
                className="bg-slate-50 rounded-xl border border-slate-100 p-5 hover:bg-white hover:shadow-lg hover:border-blue-100 transition-all duration-200 group relative"
              >
                {pop && (
                  <span className="absolute top-3 right-3 text-[8px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                    TOP
                  </span>
                )}

                {/* Family header: icon + name */}
                <div className="flex items-start gap-3.5 mb-3">
                  <div
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-md group-hover:scale-105 group-hover:shadow-lg transition-all overflow-hidden flex-shrink-0`}
                  >
                    {fam.img ? (
                      <img
                        src={fam.img}
                        alt=""
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xl">{fam.i}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] lg:text-[16px] font-bold text-slate-800 leading-tight font-v9-heading">
                      {fam.n}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-slate-400">
                        {fam.gammes.length} gamme
                        {fam.gammes.length > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {fam.desc && (
                  <p className="text-[12px] lg:text-[13px] text-slate-500 leading-relaxed line-clamp-2 mb-3 font-v9-body">
                    {fam.desc}
                  </p>
                )}

                {/* Gammes list */}
                <div className="flex flex-wrap gap-1.5">
                  {visibleGammes.map((g) => (
                    <Link
                      key={g.link}
                      to={g.link}
                      className="text-[11px] lg:text-[12px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all"
                    >
                      {g.name}
                    </Link>
                  ))}
                  {extraCount > 0 && (
                    <Link
                      to={fam.gammes[0]?.link || "#"}
                      className="text-[11px] lg:text-[12px] font-semibold text-blue-500 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 hover:bg-blue-100 transition-all flex items-center gap-1"
                    >
                      +{extraCount} gammes
                      <ArrowRight size={10} />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="py-8 text-center animate-v9-fade-in">
            <Search size={24} className="text-slate-300 mx-auto mb-2" />
            <div className="text-[13px] text-slate-400">
              Aucune famille trouvée pour &ldquo;{catSearch}&rdquo;
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
