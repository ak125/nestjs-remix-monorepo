import { Link } from "@remix-run/react";
import { Search } from "lucide-react";
import { memo, useCallback, useState } from "react";
import {
  CATALOG_DOMAINS,
  type CatalogFamily,
} from "~/components/home/constants";
import { Reveal, Section, SectionHeader } from "~/components/layout";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

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

interface CatalogCardProps {
  cat: CatalogFamily;
  index: number;
  isOpen: boolean;
  onToggle: (name: string) => void;
  className?: string;
}

const CatalogFamilyCard = memo(function CatalogFamilyCard({
  cat,
  index,
  isOpen,
  onToggle,
  className,
}: CatalogCardProps) {
  const displayedGammes = isOpen ? cat.gammes : cat.gammes.slice(0, 3);
  const pop = isPopular(cat.n);
  return (
    <Reveal key={cat.n} delay={Math.min(index * 40, 400)} className={className}>
      <Card className="group transition-all duration-200 rounded-[26px] lg:rounded-2xl shadow-[0_14px_34px_rgba(15,23,42,0.08)] lg:shadow-none overflow-hidden hover:shadow-xl hover:-translate-y-1">
        <div
          className={`relative aspect-[4/3] lg:h-40 lg:aspect-auto xl:h-48 overflow-hidden bg-gradient-to-br ${cat.color}`}
        >
          {cat.img ? (
            <img
              src={cat.img}
              alt={cat.n}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              width="400"
              height="300"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-7xl opacity-60">
              {cat.i}
            </span>
          )}
          {pop && (
            <span className="absolute top-3 right-3 text-[9px] font-bold text-white bg-cta/90 px-2 py-0.5 rounded-md shadow-sm z-10">
              TOP
            </span>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent group-hover:from-black/80 transition-colors duration-300">
            <h3 className="text-white font-bold text-[15px] sm:text-lg leading-tight tracking-[-0.03em] lg:tracking-normal line-clamp-2 font-v9-heading">
              {cat.n}
            </h3>
          </div>
        </div>
        <CardContent className="pt-4 pb-4">
          {cat.desc && (
            <p className="text-sm text-slate-500 mb-3 line-clamp-3 font-v9-body">
              {cat.desc}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {displayedGammes.map((g) => (
              <Link key={g.name} to={g.link}>
                <Badge
                  variant="secondary"
                  className="px-2.5 py-1 bg-white rounded-lg text-[11px] text-slate-600 font-medium hover:bg-orange-50 hover:text-cta transition-colors border border-slate-100 hover:border-cta/20 cursor-pointer"
                >
                  {g.name}
                </Badge>
              </Link>
            ))}
            {cat.gammes.length > 3 && (
              <button
                type="button"
                onClick={() => onToggle(cat.n)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-cta hover:bg-orange-50 transition-colors border border-cta/20 cursor-pointer"
              >
                {isOpen ? "Voir moins" : `+${cat.gammes.length - 3} gammes`}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </Reveal>
  );
});

export default function CatalogueSection({
  families,
}: {
  families: CatalogFamily[];
}) {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [catSearch, setCatSearch] = useState("");
  const [showAllFamilies, setShowAllFamilies] = useState(false);
  const toggleCat = useCallback((name: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  return (
    <Section variant="white" spacing="md" id="catalogue">
      <SectionHeader
        title="Catalogue pièces auto"
        sub={`Pièces neuves pour toutes marques — ${families.length} familles techniques`}
      />

      {/* Recherche */}
      <div className="relative max-w-sm mb-4">
        <Search
          size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10"
        />
        <Input
          value={catSearch}
          onChange={(e) => setCatSearch(e.target.value)}
          className="pl-9 bg-slate-50 border-slate-200 rounded-xl text-[13px] focus-visible:border-cta/40 focus-visible:ring-cta/10"
          placeholder="Filtrer les familles..."
        />
      </div>

      <Tabs
        defaultValue="Tout"
        className="w-full"
        aria-label="Catalogue par domaine technique"
        onValueChange={() => setShowAllFamilies(false)}
      >
        <TabsList className="w-full justify-start overflow-x-auto hide-scroll bg-[#081a4b] lg:bg-navy rounded-2xl p-1.5 mb-5 sm:mb-6 flex-nowrap h-auto shadow-lg">
          {CATALOG_DOMAINS.map((domain) => {
            const count = domain.families
              ? families.filter((c) => domain.families!.some((d) => d === c.n))
                  .length
              : families.length;
            const DomainIcon = domain.icon;
            return (
              <TabsTrigger
                key={domain.label}
                value={domain.label}
                className="group tab-pill text-xs sm:text-sm px-3 sm:px-5 py-2.5 sm:py-3 rounded-full whitespace-nowrap font-semibold flex items-center gap-1.5 sm:gap-2 text-white/50 hover:text-white/80 hover:bg-white/[0.06] data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(232,89,12,0.3)]"
              >
                <DomainIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{domain.label}</span>
                <span className="sm:hidden">{domain.label.split(" ")[0]}</span>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-white/10 font-medium leading-none group-data-[state=active]:bg-white/20">
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {CATALOG_DOMAINS.map((domain) => {
          const domainFiltered =
            domain.families === null
              ? families
              : families.filter((cat) =>
                  domain.families!.some((d) => d === cat.n),
                );
          const filtered =
            catSearch === ""
              ? domainFiltered
              : domainFiltered.filter((cat) =>
                  cat.n.toLowerCase().includes(catSearch.toLowerCase()),
                );
          return (
            <TabsContent
              key={domain.label}
              value={domain.label}
              className="mt-0"
            >
              {filtered.length === 0 ? (
                <div className="py-8 text-center">
                  <Search size={24} className="text-slate-300 mx-auto mb-2" />
                  <div className="text-[13px] text-slate-400">
                    Aucune famille trouvée
                    {catSearch && <> pour &ldquo;{catSearch}&rdquo;</>}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                    {filtered.map((cat, i) => (
                      <CatalogFamilyCard
                        key={cat.n}
                        cat={cat}
                        index={i}
                        isOpen={expandedCats.has(cat.n)}
                        onToggle={toggleCat}
                        className={
                          !showAllFamilies && i >= 4
                            ? "hidden lg:block"
                            : undefined
                        }
                      />
                    ))}
                  </div>
                  {!showAllFamilies && filtered.length > 4 && (
                    <div className="flex justify-center mt-5 lg:hidden">
                      <button
                        type="button"
                        onClick={() => setShowAllFamilies(true)}
                        className="px-6 py-3 rounded-full bg-orange-500 text-white text-sm font-semibold shadow-[0_14px_34px_rgba(15,23,42,0.08)] hover:bg-orange-600 transition-colors tracking-[-0.03em]"
                      >
                        Voir toutes les familles ({filtered.length})
                      </button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </Section>
  );
}
