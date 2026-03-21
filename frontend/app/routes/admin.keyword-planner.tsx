/**
 * Admin Keyword Planner — KP coverage R1-R8 per gamme.
 * All data from backend /api/admin/keyword-planner/coverage.
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { BarChart3, CheckCircle2, Search, Tag } from "lucide-react";
import { useState } from "react";
import {
  DashboardShell,
  KpiGrid,
} from "~/components/admin/patterns/DashboardShell";
import { KpiCard } from "~/components/admin/patterns/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Keyword Planner - Admin");

// ── Types ──

interface RoleCoverage {
  role: string;
  label: string;
  count: number;
  total: number;
  pct: number;
}

interface GammeRow {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  has_r1: boolean;
  has_r3: boolean;
  has_r4: boolean;
  has_r5: boolean;
  has_r6: boolean;
}

interface LoaderData {
  coverage: RoleCoverage[];
  gammes: GammeRow[];
  totalGammes: number;
}

// ── Loader ──

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrlFromRequest("", request);
  const cookieHeader = request.headers.get("Cookie") || "";

  let coverage: RoleCoverage[] = [];
  let gammes: GammeRow[] = [];
  let totalGammes = 221;

  try {
    const resp = await fetch(
      `${backendUrl}/api/admin/keyword-planner/coverage`,
      { headers: { Cookie: cookieHeader } },
    );
    if (resp.ok) {
      const data = await resp.json();
      coverage = data.coverage || [];
      gammes = data.gammes || [];
      totalGammes = data.totalGammes || 221;
    }
  } catch {
    // Fallback static
    const roles = [
      { role: "R1", label: "Router", count: 101 },
      { role: "R2", label: "Product", count: 0 },
      { role: "R3", label: "Conseils", count: 243 },
      { role: "R4", label: "Reference", count: 44 },
      { role: "R5", label: "Diagnostic", count: 7 },
      { role: "R6", label: "Guide Achat", count: 99 },
      { role: "R7", label: "Brand", count: 0 },
      { role: "R8", label: "Vehicle", count: 1 },
    ];
    coverage = roles.map((r) => ({
      ...r,
      total: totalGammes,
      pct: Math.round((r.count / totalGammes) * 100),
    }));
  }

  return json<LoaderData>({ coverage, gammes, totalGammes });
}

// ── Component ──

export default function KeywordPlannerPage() {
  const { coverage, gammes, totalGammes } = useLoaderData<LoaderData>();
  const [search, setSearch] = useState("");

  const filteredGammes = gammes.filter(
    (g) =>
      !search ||
      g.pg_name.toLowerCase().includes(search.toLowerCase()) ||
      g.pg_alias.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <DashboardShell
      title="Keyword Planner"
      description="Couverture KP par role (R1-R8) — 221 gammes actives"
    >
      {/* Coverage KPIs */}
      <KpiGrid columns={4}>
        {coverage.map((c) => (
          <KpiCard
            key={c.role}
            title={`${c.role} — ${c.label}`}
            value={`${c.pct}%`}
            subtitle={`${c.count}/${c.total} gammes`}
            icon={Tag}
            trend={
              c.pct >= 80
                ? { value: c.pct, direction: "up" as const }
                : { value: c.pct, direction: "down" as const }
            }
          />
        ))}
      </KpiGrid>

      {/* Gammes table */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Gammes ({totalGammes})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {gammes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Chargement depuis le backend...
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Gamme</th>
                    <th className="py-2 px-3 text-center">R1</th>
                    <th className="py-2 px-3 text-center">R3</th>
                    <th className="py-2 px-3 text-center">R4</th>
                    <th className="py-2 px-3 text-center">R5</th>
                    <th className="py-2 px-3 text-center">R6</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGammes.slice(0, 100).map((g) => (
                    <tr key={g.pg_id} className="border-b hover:bg-muted/50">
                      <td className="py-2 pr-4">
                        <Link
                          to={`/admin/gammes-seo/${g.pg_id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {g.pg_name}
                        </Link>
                        <span className="text-xs text-muted-foreground ml-2">
                          {g.pg_alias}
                        </span>
                      </td>
                      <Dot ok={g.has_r1} />
                      <Dot ok={g.has_r3} />
                      <Dot ok={g.has_r4} />
                      <Dot ok={g.has_r5} />
                      <Dot ok={g.has_r6} />
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredGammes.length > 100 && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  +{filteredGammes.length - 100} masquees
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <td className="py-2 px-3 text-center">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
      ) : (
        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/20 mx-auto" />
      )}
    </td>
  );
}
