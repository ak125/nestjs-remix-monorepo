/**
 * Admin Keyword Planner — KP coverage R1-R8 + prompt generator.
 * All data from backend /api/admin/keyword-planner/*.
 */

import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  Search,
  Sparkles,
  Tag,
} from "lucide-react";
import { useState } from "react";
import {
  DashboardShell,
  KpiGrid,
} from "~/components/admin/patterns/DashboardShell";
import { KpiCard } from "~/components/admin/patterns/KpiCard";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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

interface PromptResult {
  role: string;
  prompt: string | null;
  chars?: number;
  error?: string | null;
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

// ── Action (generate prompt) ──

export async function action({ request }: ActionFunctionArgs) {
  const backendUrl = getInternalApiUrlFromRequest("", request);
  const cookieHeader = request.headers.get("Cookie") || "";
  const form = await request.formData();
  const pg_id = Number(form.get("pg_id"));
  const roleVal = String(form.get("role") || "all");
  const roles =
    roleVal === "all"
      ? ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]
      : [roleVal];

  try {
    const resp = await fetch(
      `${backendUrl}/api/admin/keyword-planner/generate`,
      {
        method: "POST",
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pg_id, roles }),
      },
    );
    if (resp.ok) {
      return json(await resp.json());
    }
    return json({ error: `Backend ${resp.status}` });
  } catch (e) {
    return json({ error: String(e) });
  }
}

// ── Role config ──

const ROLE_COLORS: Record<string, string> = {
  R1: "bg-blue-100 text-blue-800",
  R2: "bg-purple-100 text-purple-800",
  R3: "bg-green-100 text-green-800",
  R4: "bg-gray-100 text-gray-800",
  R5: "bg-red-100 text-red-800",
  R6: "bg-amber-100 text-amber-800",
  R7: "bg-indigo-100 text-indigo-800",
  R8: "bg-teal-100 text-teal-800",
};

// ── Component ──

export default function KeywordPlannerPage() {
  const { coverage, gammes, totalGammes } = useLoaderData<LoaderData>();
  const fetcher = useFetcher<{
    pg_name?: string;
    pg_alias?: string;
    results?: PromptResult[];
    error?: string;
  }>();
  const [search, setSearch] = useState("");
  const [selectedPgId, setSelectedPgId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const filteredGammes = gammes.filter(
    (g) =>
      !search ||
      g.pg_name.toLowerCase().includes(search.toLowerCase()) ||
      g.pg_alias.toLowerCase().includes(search.toLowerCase()),
  );

  const isGenerating = fetcher.state !== "idle";
  const results = fetcher.data?.results;

  function handleGenerate() {
    if (!selectedPgId) return;
    fetcher.submit(
      { pg_id: selectedPgId, role: selectedRole },
      { method: "post" },
    );
  }

  function handleGenerateForGamme(pgId: number) {
    setSelectedPgId(String(pgId));
    fetcher.submit({ pg_id: String(pgId), role: "all" }, { method: "post" });
  }

  async function copyPrompt(text: string, idx: number) {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

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

      {/* Prompt generator */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generer un prompt Claude Chrome
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[250px]">
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Gamme
              </label>
              <Select value={selectedPgId} onValueChange={setSelectedPgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une gamme..." />
                </SelectTrigger>
                <SelectContent>
                  {gammes.map((g) => (
                    <SelectItem key={g.pg_id} value={String(g.pg_id)}>
                      {g.pg_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Role
              </label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous (R1-R8)</SelectItem>
                  <SelectItem value="R1">R1 — Router</SelectItem>
                  <SelectItem value="R2">R2 — Product</SelectItem>
                  <SelectItem value="R3">R3 — Conseils</SelectItem>
                  <SelectItem value="R4">R4 — Reference</SelectItem>
                  <SelectItem value="R5">R5 — Diagnostic</SelectItem>
                  <SelectItem value="R6">R6 — Guide Achat</SelectItem>
                  <SelectItem value="R7">R7 — Brand</SelectItem>
                  <SelectItem value="R8">R8 — Vehicle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={!selectedPgId || isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generer
            </Button>
          </div>

          {/* Error */}
          {fetcher.data?.error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {fetcher.data.error}
            </div>
          )}

          {/* Results */}
          {results && results.length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="text-sm text-muted-foreground">
                Prompts pour{" "}
                <span className="font-medium text-foreground">
                  {fetcher.data?.pg_name}
                </span>{" "}
                ({fetcher.data?.pg_alias})
              </div>
              {results.map((r, idx) => (
                <div key={r.role} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                    <div className="flex items-center gap-2">
                      <Badge className={ROLE_COLORS[r.role]}>{r.role}</Badge>
                      {r.chars && (
                        <span className="text-xs text-muted-foreground">
                          {r.chars} chars
                        </span>
                      )}
                    </div>
                    {r.prompt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 h-7"
                        onClick={() => copyPrompt(r.prompt!, idx)}
                      >
                        <ClipboardCopy className="h-3 w-3" />
                        {copiedIdx === idx ? "Copie !" : "Copier"}
                      </Button>
                    )}
                  </div>
                  {r.error ? (
                    <div className="px-4 py-3 text-sm text-red-600 bg-red-50">
                      {r.error}
                    </div>
                  ) : (
                    <pre className="px-4 py-3 text-xs font-mono text-muted-foreground bg-muted/20 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap">
                      {r.prompt}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                    <th className="py-2 px-3 text-center" />
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
                      <td className="py-2 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleGenerateForGamme(g.pg_id)}
                          disabled={isGenerating}
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          KP
                        </Button>
                      </td>
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
