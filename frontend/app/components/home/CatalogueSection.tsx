import { Link } from "@remix-run/react";
import { memo, useCallback, useState } from "react";
import { Reveal, Section, SectionHeader } from "~/components/layout";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { CATALOG_DOMAINS, type CatalogFamily } from "./constants";

interface CatalogCardProps {
  cat: CatalogFamily;
  index: number;
  isOpen: boolean;
  onToggle: (name: string) => void;
}

const CatalogFamilyCard = memo(function CatalogFamilyCard({
  cat,
  index,
  isOpen,
  onToggle,
}: CatalogCardProps) {
  const displayedGammes = isOpen ? cat.gammes : cat.gammes.slice(0, 4);
  return (
    <Reveal key={cat.n} delay={Math.min(index * 40, 400)}>
      <Card className="group transition-all duration-200 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1">
        <div
          className={`relative h-32 sm:h-48 overflow-hidden bg-gradient-to-br ${cat.color}`}
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
            <span className="absolute inset-0 flex items-center justify-center text-6xl opacity-40">
              {cat.i}
            </span>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent group-hover:from-black/80 transition-colors duration-300">
            <h3 className="text-white font-bold text-lg line-clamp-2">
              {cat.n}
            </h3>
          </div>
        </div>
        <CardContent className="pt-4 pb-4">
          {cat.desc && (
            <p className="text-sm text-slate-500 mb-3 line-clamp-2">
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
            {cat.gammes.length > 4 && (
              <button
                type="button"
                onClick={() => onToggle(cat.n)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-cta hover:bg-orange-50 transition-colors border border-cta/20 cursor-pointer"
              >
                {isOpen ? "Voir moins" : `+${cat.gammes.length - 4} gammes`}
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

      <Tabs
        defaultValue="Tout"
        className="w-full"
        aria-label="Catalogue par domaine technique"
      >
        <TabsList className="w-full justify-start overflow-x-auto hide-scroll bg-navy rounded-2xl p-1.5 mb-5 sm:mb-6 flex-nowrap h-auto shadow-lg">
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
                className="group tab-pill text-xs sm:text-sm px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl whitespace-nowrap font-semibold flex items-center gap-1.5 sm:gap-2 text-white/50 hover:text-white/80 hover:bg-white/[0.06] data-[state=active]:bg-cta data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(232,89,12,0.3)]"
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
          const filtered =
            domain.families === null
              ? families
              : families.filter((cat) =>
                  domain.families!.some((d) => d === cat.n),
                );
          return (
            <TabsContent
              key={domain.label}
              value={domain.label}
              className="mt-0"
            >
              {filtered.length === 0 ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-48 rounded-2xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                  {filtered.map((cat, i) => (
                    <CatalogFamilyCard
                      key={cat.n}
                      cat={cat}
                      index={i}
                      isOpen={expandedCats.has(cat.n)}
                      onToggle={toggleCat}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </Section>
  );
}
