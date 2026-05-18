// app/routes/admin.suppliers.tsx
// Dashboard fournisseurs avec stats réelles depuis pieces_marque (pm_display breakdown)

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Outlet, useLoaderData, Link } from "@remix-run/react";
import {
  Building2,
  Users,
  Package,
  AlertTriangle,
  EyeOff,
  Star,
  Layers,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";
import { requireAuth } from "../auth/unified.server";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Fournisseurs - Admin");

interface TierStats {
  count: number;
  withArticles: number;
  articles: number;
}

interface SupplierDisplayBreakdown {
  tiers: {
    principaux: TierStats;
    secondaires: TierStats;
    tertiaires: TierStats;
    masques: TierStats;
  };
  totals: {
    totalSuppliers: number;
    totalActive: number;
    totalWithArticles: number;
    totalArticles: number;
  };
  cachedAt: string;
}

const FALLBACK_STATS: SupplierDisplayBreakdown = {
  tiers: {
    principaux: { count: 0, withArticles: 0, articles: 0 },
    secondaires: { count: 0, withArticles: 0, articles: 0 },
    tertiaires: { count: 0, withArticles: 0, articles: 0 },
    masques: { count: 0, withArticles: 0, articles: 0 },
  },
  totals: {
    totalSuppliers: 0,
    totalActive: 0,
    totalWithArticles: 0,
    totalArticles: 0,
  },
  cachedAt: "",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  if (!user.level || user.level < 7) {
    throw new Response("Acces refuse - Permissions administrateur requises", {
      status: 403,
    });
  }

  const cookieHeader = request.headers.get("Cookie") || "";
  const headers = { Cookie: cookieHeader };
  const base = getInternalApiUrl("");

  // Single unified fetch (1 GROUP BY instead of 2)
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const display = url.searchParams.get("display") || "";
  const qs = new URLSearchParams({ search, display });

  let stats: SupplierDisplayBreakdown = FALLBACK_STATS;
  let listItems: Array<{
    id: string;
    name: string;
    display: string;
    tier: string;
    articleCount: number;
  }> = [];
  let listTotal = 0;
  let apiError: string | null = null;

  try {
    const res = await fetch(`${base}/api/admin/supplier-stats/unified?${qs}`, {
      headers,
    });

    if (res.ok) {
      const body = await res.json();
      const data = body.data ?? body;
      stats = data.stats ?? FALLBACK_STATS;
      listItems = data.listItems || [];
      listTotal = data.listTotal || 0;
    } else {
      apiError = `API unified: ${res.status}`;
    }
  } catch {
    apiError = "API supplier-stats indisponible";
  }

  return json({ user, stats, listItems, listTotal, search, display, apiError });
}

export default function AdminSuppliersLayout() {
  const { stats, listItems, listTotal, search, display, apiError } =
    useLoaderData<typeof loader>();

  const fmt = (num: number) => new Intl.NumberFormat("fr-FR").format(num);

  const activeRate =
    stats.totals.totalSuppliers > 0
      ? Math.round(
          (stats.totals.totalActive / stats.totals.totalSuppliers) * 100,
        )
      : 0;

  const totalArt = stats.totals.totalArticles || 1;
  const pctPrincipaux = Math.round(
    (stats.tiers.principaux.articles / totalArt) * 100,
  );
  const pctSecondaires = Math.round(
    (stats.tiers.secondaires.articles / totalArt) * 100,
  );
  const pctTertiaires = 100 - pctPrincipaux - pctSecondaires;

  const tiers = [
    {
      key: "1",
      label: "Principaux",
      icon: Star,
      color: "indigo",
      border: "border-indigo-500",
      iconColor: "text-indigo-600",
      badgeColor: "bg-indigo-100 text-indigo-800",
      barColor: "bg-indigo-500",
      stats: stats.tiers.principaux,
      pct: pctPrincipaux,
    },
    {
      key: "2",
      label: "Secondaires",
      icon: Package,
      color: "green",
      border: "border-green-500",
      iconColor: "text-green-600",
      badgeColor: "bg-green-100 text-green-800",
      barColor: "bg-green-500",
      stats: stats.tiers.secondaires,
      pct: pctSecondaires,
    },
    {
      key: "5",
      label: "Tertiaires",
      icon: Layers,
      color: "orange",
      border: "border-orange-500",
      iconColor: "text-orange-600",
      badgeColor: "bg-orange-100 text-orange-800",
      barColor: "bg-orange-400",
      stats: stats.tiers.tertiaires,
      pct: pctTertiaires,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header compact */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg shadow-lg p-6 text-white mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Building2 className="h-10 w-10" />
            <div>
              <h1 className="text-3xl font-bold">Equipementiers</h1>
              <p className="text-indigo-100 mt-0.5">
                {fmt(stats.totals.totalActive)} actifs &mdash;{" "}
                {fmt(stats.totals.totalArticles)} articles
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{activeRate}%</div>
            <div className="text-xs text-indigo-200">
              {fmt(stats.totals.totalWithArticles)} avec articles
            </div>
          </div>
        </div>
      </div>

      {apiError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 mb-6 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {apiError}
        </div>
      )}

      {/* Cartes tier cliquables + Total */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {tiers.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              to={`/admin/suppliers?display=${t.key}`}
              className={`bg-white rounded-lg shadow p-5 border-l-4 ${t.border} hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={`h-6 w-6 ${t.iconColor}`} />
                  <h2 className="font-semibold text-gray-900">{t.label}</h2>
                </div>
                <Badge className={`${t.badgeColor} text-xs`}>
                  {t.stats.count}
                </Badge>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {fmt(t.stats.articles)}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{t.stats.withArticles} avec articles</span>
                <span className="font-medium">{t.pct}%</span>
              </div>
              {/* Mini bar */}
              <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2">
                <div
                  className={`h-full rounded-full ${t.barColor}`}
                  style={{ width: `${t.pct}%` }}
                />
              </div>
            </Link>
          );
        })}

        {/* Total */}
        <div className="bg-white rounded-lg shadow p-5 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 text-purple-600" />
              <h2 className="font-semibold text-gray-900">Total Actifs</h2>
            </div>
            <Badge className="bg-purple-100 text-purple-800 text-xs">
              {stats.totals.totalActive}
            </Badge>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {fmt(stats.totals.totalArticles)}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{stats.totals.totalWithArticles} avec articles</span>
            <span className="font-medium">{activeRate}%</span>
          </div>
          {/* Stacked bar */}
          <div className="w-full h-1.5 rounded-full overflow-hidden flex mt-2 bg-gray-100">
            {tiers.map((t) => (
              <div
                key={t.key}
                className={`h-full ${t.barColor}`}
                style={{ width: `${t.pct}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Masqués — ligne compacte */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <EyeOff className="h-4 w-4" />
          <span className="font-medium">Masques (display 0)</span>
        </div>
        <div className="flex items-center gap-6 text-gray-500">
          <span>
            <strong className="text-gray-700">
              {fmt(stats.tiers.masques.count)}
            </strong>{" "}
            fournisseurs
          </span>
          <span>
            <strong className="text-gray-700">
              {fmt(stats.tiers.masques.withArticles)}
            </strong>{" "}
            avec articles
          </span>
          <span>
            <strong className="text-amber-700">
              {fmt(stats.tiers.masques.articles)}
            </strong>{" "}
            articles
          </span>
        </div>
        {stats.cachedAt && (
          <span className="text-xs text-gray-400">
            Cache{" "}
            {new Date(stats.cachedAt).toLocaleString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {/* Liste (Outlet) — données passées via context */}
      <div className="bg-white rounded-lg shadow">
        <Outlet context={{ listItems, listTotal, search, display }} />
      </div>
    </div>
  );
}
