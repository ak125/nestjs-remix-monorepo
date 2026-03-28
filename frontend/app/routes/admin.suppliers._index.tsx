// app/routes/admin.suppliers._index.tsx
// Liste des equipementiers — données via useOutletContext (pas de loader propre)

import {
  useOutletContext,
  useSearchParams,
  useNavigate,
} from "@remix-run/react";
import { Search, X, Trophy } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

interface Equipementier {
  id: string;
  name: string;
  display: string;
  tier: string;
  articleCount: number;
}

interface OutletData {
  listItems: Equipementier[];
  listTotal: number;
  search: string;
  display: string;
}

const TIER_CONFIG: Record<
  string,
  { label: string; badge: string; bar: string }
> = {
  principal: {
    label: "Principal",
    badge: "bg-indigo-100 text-indigo-700",
    bar: "bg-indigo-500",
  },
  secondaire: {
    label: "Secondaire",
    badge: "bg-green-100 text-green-700",
    bar: "bg-green-500",
  },
  tertiaire: {
    label: "Tertiaire",
    badge: "bg-orange-100 text-orange-700",
    bar: "bg-orange-400",
  },
};

export default function EquipementiersIndex() {
  const {
    listItems: items,
    listTotal: total,
    search,
    display,
  } = useOutletContext<OutletData>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [localSearch, setLocalSearch] = useState(search);

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  const maxArticles =
    items.length > 0 ? Math.max(...items.map((e) => e.articleCount)) : 1;

  const top10 = [...items]
    .sort((a, b) => b.articleCount - a.articleCount)
    .slice(0, 10);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    if (localSearch.trim()) {
      p.set("search", localSearch.trim());
    } else {
      p.delete("search");
    }
    p.delete("page");
    navigate(`/admin/suppliers?${p.toString()}`);
  };

  const clearSearch = () => {
    setLocalSearch("");
    const p = new URLSearchParams(searchParams);
    p.delete("search");
    p.delete("page");
    navigate(`/admin/suppliers?${p.toString()}`);
  };

  const setFilter = (d: string) => {
    const p = new URLSearchParams(searchParams);
    if (d) {
      p.set("display", d);
    } else {
      p.delete("display");
    }
    p.delete("page");
    navigate(`/admin/suppliers?${p.toString()}`);
  };

  const showTop10 = !search && !display && items.length > 10;

  return (
    <div className="p-6 space-y-5">
      {/* Filtres + recherche */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { value: "", label: "Tous" },
            { value: "1", label: "Principaux", dot: "bg-indigo-500" },
            { value: "2", label: "Secondaires", dot: "bg-green-500" },
            { value: "5", label: "Tertiaires", dot: "bg-orange-400" },
          ].map((f) => (
            <Button
              key={f.value}
              variant={display === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.value)}
              className="h-8 text-xs"
            >
              {f.dot && (
                <span
                  className={`w-2 h-2 rounded-full ${f.dot} inline-block mr-1`}
                />
              )}
              {f.label}
            </Button>
          ))}
          <span className="text-xs text-gray-400 ml-2">
            {fmt(total)} resultats
          </span>
        </div>

        <form onSubmit={handleSearch} className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          {localSearch && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>
      </div>

      {/* Top 10 compact */}
      {showTop10 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">
              Top 10 par volume
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {top10.map((eq, i) => {
              const cfg = TIER_CONFIG[eq.tier] || TIER_CONFIG.principal;
              return (
                <div
                  key={eq.id}
                  className="bg-white rounded-md px-3 py-2 text-center"
                >
                  <div className="text-xs text-gray-400 mb-0.5">#{i + 1}</div>
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {eq.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {fmt(eq.articleCount)}
                  </div>
                  <div
                    className={`w-full h-1 rounded-full mt-1 ${cfg.bar} opacity-50`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase w-8">
                #
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                Equipementier
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase w-28">
                Tier
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase w-32">
                Articles
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase w-40">
                Volume
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase w-16">
                ID
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-gray-500 text-sm"
                >
                  {search
                    ? `Aucun resultat pour "${search}"`
                    : "Aucun equipementier trouve"}
                </td>
              </tr>
            ) : (
              items.map((eq, idx) => {
                const cfg = TIER_CONFIG[eq.tier] || TIER_CONFIG.principal;
                const barWidth =
                  maxArticles > 0
                    ? Math.max(
                        (eq.articleCount / maxArticles) * 100,
                        eq.articleCount > 0 ? 2 : 0,
                      )
                    : 0;
                return (
                  <tr
                    key={eq.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-xs text-gray-400">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-sm font-medium text-gray-900">
                        {eq.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={`${cfg.badge} text-xs font-normal`}>
                        {cfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`text-sm tabular-nums ${
                          eq.articleCount > 0
                            ? "font-medium text-gray-900"
                            : "text-gray-300"
                        }`}
                      >
                        {fmt(eq.articleCount)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${cfg.bar} transition-all`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-xs text-gray-400 font-mono">
                        {eq.id}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-400 text-right">
        {fmt(items.length)} / {fmt(total)} affiches
      </div>
    </div>
  );
}
