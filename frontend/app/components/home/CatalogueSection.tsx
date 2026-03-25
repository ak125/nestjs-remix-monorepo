import { Link } from "@remix-run/react";
import { ChevronDown, ChevronUp, Loader2, Search, X } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import {
  CATALOG_DOMAINS,
  type CatalogFamily,
} from "~/components/home/constants";
import { Reveal, Section, SectionHeader } from "~/components/layout";
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
  onToggle: (name: string, familyId?: number) => void;
  className?: string;
  isLoading?: boolean;
}

const CatalogFamilyCard = memo(function CatalogFamilyCard({
  cat,
  index,
  isOpen,
  onToggle,
  className,
  isLoading,
}: CatalogCardProps) {
  const displayedGammes = isOpen ? cat.gammes : cat.gammes.slice(0, 4);
  const pop = isPopular(cat.n);
  const totalGammes = cat.gammes_count ?? cat.gammes.length;
  const hasMore = totalGammes > 4;

  const isAboveFold = index < 4;
  const revealDelay = isAboveFold ? 0 : Math.min(index * 40, 400);

  return (
    <Reveal key={cat.n} delay={revealDelay} className={className}>
      <div className="group flex flex-col h-full rounded-2xl border border-slate-200/80 bg-white overflow-hidden transition-all duration-200 hover:shadow-[0_8px_30px_rgba(15,23,42,0.10)] hover:-translate-y-0.5">
        {/* Image header — compact, focused */}
        <div
          className={`relative h-36 sm:h-40 overflow-hidden bg-gradient-to-br ${cat.color}`}
        >
          {cat.img ? (
            <img
              src={cat.img}
              alt={`Pièces ${cat.n} — catalogue AutoMecanik`}
              className="w-full h-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
              loading={isAboveFold ? "eager" : "lazy"}
              fetchPriority={isAboveFold ? "high" : undefined}
              width="400"
              height="300"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-6xl opacity-50">
              {cat.i}
            </span>
          )}
          {pop && (
            <span className="absolute top-2.5 right-2.5 text-[10px] font-bold uppercase tracking-wide text-white bg-cta/90 px-2 py-0.5 rounded-md shadow-sm z-10">
              Populaire
            </span>
          )}
          {/* Gamme count chip */}
          <span className="absolute bottom-2.5 right-2.5 text-[11px] font-semibold text-white/90 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-md z-10">
            {totalGammes} gammes
          </span>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 px-4 pt-3.5 pb-4">
          {/* Family name */}
          <h3 className="text-[15px] font-bold text-slate-900 leading-snug tracking-[-0.01em] font-heading mb-1.5 line-clamp-2">
            {cat.n}
          </h3>

          {/* Description — 1 line max */}
          {cat.desc && (
            <p className="text-[12px] text-slate-400 mb-3 line-clamp-1 leading-relaxed">
              {cat.desc}
            </p>
          )}

          {/* Gamme links — clean list */}
          <div className="flex flex-col gap-1 mt-auto">
            {displayedGammes.map((g) => (
              <Link
                key={g.name}
                to={g.link}
                className="flex items-center gap-2 px-2.5 py-2 -mx-1 rounded-lg text-[13px] text-slate-600 font-medium hover:bg-slate-50 hover:text-cta transition-colors group/link"
              >
                <span className="w-1 h-1 rounded-full bg-slate-300 group-hover/link:bg-cta shrink-0" />
                <span className="truncate">{g.name}</span>
              </Link>
            ))}

            {/* Expand / collapse */}
            {hasMore && (
              <button
                type="button"
                onClick={() => onToggle(cat.n)}
                disabled={isLoading}
                className="flex items-center justify-center gap-1.5 mt-1 px-3 py-2 rounded-lg text-[12px] font-semibold text-cta bg-orange-50/80 hover:bg-orange-100 transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isOpen ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Voir moins
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />+{totalGammes - 4}{" "}
                    autres gammes
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
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
  const [_activeTab, setActiveTab] = useState("Tout");
  const [loadingFamily, setLoadingFamily] = useState<string | null>(null);
  // Expanded gammes fetched from API (keyed by family name)
  const [expandedGammes, setExpandedGammes] = useState<
    Map<string, Array<{ name: string; link: string }>>
  >(new Map());

  const toggleCat = useCallback(
    async (name: string) => {
      // Collapsing
      if (expandedCats.has(name)) {
        setExpandedCats((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
        return;
      }

      // Find the family to get its mf_id (stored as part of first gamme link)
      const family = families.find((f) => f.n === name);
      if (!family) return;

      // If we already have full gammes (SSR had all of them or already fetched)
      const totalGammes = family.gammes_count ?? family.gammes.length;
      if (family.gammes.length >= totalGammes || expandedGammes.has(name)) {
        setExpandedCats((prev) => new Set(prev).add(name));
        return;
      }

      // Fetch remaining gammes — mf_id already available in CatalogFamily
      setLoadingFamily(name);
      try {
        const gammesRes = await fetch(
          `/api/catalog/family-gammes/${family.mf_id}`,
        );
        if (gammesRes.ok) {
          const gammesData = await gammesRes.json();
          if (gammesData.success && gammesData.gammes) {
            const mappedGammes = gammesData.gammes.map(
              (g: { pg_id: number; pg_alias: string; pg_name: string }) => ({
                name: g.pg_name,
                link: `/pieces/${g.pg_alias}-${g.pg_id}.html`,
              }),
            );
            setExpandedGammes((prev) => new Map(prev).set(name, mappedGammes));
          }
        }
      } catch {
        // Silently fail — user sees the initial gammes
      } finally {
        setLoadingFamily(null);
        setExpandedCats((prev) => new Set(prev).add(name));
      }
    },
    [expandedCats, families, expandedGammes],
  );

  // Build display families: merge SSR gammes with dynamically-loaded gammes
  const displayFamilies = useMemo(
    () =>
      families.map((cat) => {
        const extra = expandedGammes.get(cat.n);
        return extra ? { ...cat, gammes: extra } : cat;
      }),
    [families, expandedGammes],
  );

  return (
    <Section variant="white" spacing="md" id="catalogue">
      <SectionHeader
        title="Catalogue pièces auto"
        sub={`Pièces neuves pour toutes marques — ${families.length} familles techniques`}
      />

      <Tabs
        defaultValue="Tout"
        className="w-full"
        aria-label="Catalogue par domaine technique"
        onValueChange={(val) => {
          setShowAllFamilies(false);
          setActiveTab(val);
        }}
      >
        {/* Barre unifiée : filtres + recherche */}
        <div className="mb-5 sm:mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          {/* Pills scroll horizontal */}
          <div className="relative flex-1 min-w-0">
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-10 lg:hidden" />
            <TabsList className="w-full justify-start overflow-x-auto hide-scroll rounded-xl bg-slate-100 p-1 flex-nowrap h-auto">
              {CATALOG_DOMAINS.map((domain) => {
                const count = domain.familyIds
                  ? displayFamilies.filter((c) =>
                      domain.familyIds!.includes(c.mf_id),
                    ).length
                  : displayFamilies.length;
                const DomainIcon = domain.icon;
                return (
                  <TabsTrigger
                    key={domain.label}
                    value={domain.label}
                    className="group text-xs sm:text-[13px] px-3 sm:px-4 py-2.5 sm:py-2.5 rounded-lg whitespace-nowrap font-semibold flex items-center gap-1.5 min-h-[44px] text-slate-500 hover:text-slate-700 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200"
                  >
                    <DomainIcon className="w-3.5 h-3.5 flex-shrink-0 group-data-[state=active]:text-cta" />
                    <span className="hidden sm:inline">{domain.label}</span>
                    <span className="sm:hidden">
                      {domain.label.split(" ")[0]}
                    </span>
                    <span className="px-1.5 py-0.5 text-xs rounded-full bg-slate-200/60 font-medium leading-none group-data-[state=active]:bg-cta/10 group-data-[state=active]:text-cta">
                      {count}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Recherche */}
          <div className="relative w-full lg:w-64 shrink-0">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10"
            />
            <Input
              value={catSearch}
              onChange={(e) => setCatSearch(e.target.value)}
              className="pl-9 pr-8 h-11 bg-slate-50 border-slate-200 rounded-xl text-[13px] focus-visible:border-cta/40 focus-visible:ring-cta/10"
              placeholder="Rechercher une pièce..."
            />
            {catSearch && (
              <button
                type="button"
                onClick={() => setCatSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                aria-label="Effacer la recherche"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {CATALOG_DOMAINS.map((domain) => {
          const domainFiltered =
            domain.familyIds === null
              ? displayFamilies
              : displayFamilies.filter((cat) =>
                  domain.familyIds!.includes(cat.mf_id),
                );
          const q = catSearch.toLowerCase();
          const filtered =
            q === ""
              ? domainFiltered
              : domainFiltered.filter(
                  (cat) =>
                    cat.n.toLowerCase().includes(q) ||
                    cat.desc?.toLowerCase().includes(q) ||
                    cat.gammes.some((g) => g.name.toLowerCase().includes(q)),
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
                    {filtered.map((cat, i) => {
                      // Domain tabs (≤8 families): show all. "Tout" (19): paginate.
                      const isDomainTab = domain.familyIds !== null;
                      const hiddenClass = isDomainTab
                        ? undefined
                        : !showAllFamilies && i >= 8
                          ? "hidden"
                          : undefined;

                      return (
                        <CatalogFamilyCard
                          key={cat.n}
                          cat={cat}
                          index={i}
                          isOpen={expandedCats.has(cat.n)}
                          onToggle={toggleCat}
                          isLoading={loadingFamily === cat.n}
                          className={hiddenClass}
                        />
                      );
                    })}
                  </div>
                  {domain.familyIds === null &&
                    !showAllFamilies &&
                    filtered.length > 8 && (
                      <div className="flex justify-center mt-5">
                        <button
                          type="button"
                          onClick={() => setShowAllFamilies(true)}
                          className="px-6 py-3 rounded-full border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors tracking-[-0.03em]"
                        >
                          Voir les {filtered.length - 8} familles restantes
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
