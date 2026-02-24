/**
 * Page Briefs — Admin SEO Hub
 *
 * /admin/seo-hub/page-briefs
 *
 * Dashboard des briefs SEO par gamme et role.
 * Stats, filtres, table expansible, actions validate/activate.
 */

import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, useSearchParams, useFetcher } from "@remix-run/react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ClipboardList,
  FileText,
  Filter,
  TrendingUp,
} from "lucide-react";
import { Fragment, useState } from "react";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Page Briefs - Admin");

// ── Types ──

interface BriefRow {
  id: number;
  pg_id: number;
  pg_alias: string;
  page_role: string;
  primary_intent: string;
  secondary_intents: string[];
  angles_obligatoires: string[];
  forbidden_overlap: string[];
  faq_paa: string[];
  termes_techniques: string[];
  preuves: string[];
  keywords_primary: string | null;
  keywords_secondary: string[];
  writing_constraints: string[];
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
  confidence_score: number | null;
  coverage_score: number | null;
  keyword_source?: string;
  llm_provider?: string;
}

interface BriefStats {
  total: number;
  gammes: number;
  active: number;
  draft: number;
  validated: number;
  archived: number;
  avgConfidence: number;
  avgCoverage: number;
}

function computeStats(briefs: BriefRow[]): BriefStats {
  const gammes = new Set(briefs.map((b) => b.pg_alias));
  const active = briefs.filter((b) => b.status === "active").length;
  const draft = briefs.filter((b) => b.status === "draft").length;
  const validated = briefs.filter((b) => b.status === "validated").length;
  const archived = briefs.filter((b) => b.status === "archived").length;

  const withConfidence = briefs.filter((b) => b.confidence_score !== null);
  const avgConfidence =
    withConfidence.length > 0
      ? withConfidence.reduce((s, b) => s + (b.confidence_score ?? 0), 0) /
        withConfidence.length
      : 0;

  const withCoverage = briefs.filter((b) => b.coverage_score !== null);
  const avgCoverage =
    withCoverage.length > 0
      ? withCoverage.reduce((s, b) => s + (b.coverage_score ?? 0), 0) /
        withCoverage.length
      : 0;

  return {
    total: briefs.length,
    gammes: gammes.size,
    active,
    draft,
    validated,
    archived,
    avgConfidence,
    avgCoverage,
  };
}

// ── Loader ──

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const url = new URL(request.url);

  const params = new URLSearchParams({ limit: "200", offset: "0" });
  const pgAlias = url.searchParams.get("pgAlias");
  const pageRole = url.searchParams.get("pageRole");
  const status = url.searchParams.get("status");
  if (pgAlias) params.set("pgAlias", pgAlias);
  if (pageRole) params.set("pageRole", pageRole);
  if (status) params.set("status", status);

  try {
    const res = await fetch(
      `${backendUrl}/api/admin/page-briefs?${params.toString()}`,
      { headers: { Cookie: cookieHeader } },
    );

    if (!res.ok) {
      return json({
        briefs: [] as BriefRow[],
        stats: null as BriefStats | null,
        total: 0,
        error: `API error: ${res.status}`,
      });
    }

    const body = await res.json();
    const briefs = (body.data ?? []) as BriefRow[];
    const stats = computeStats(briefs);

    return json({
      briefs,
      stats,
      total: body.total ?? briefs.length,
      error: null,
    });
  } catch (error) {
    return json({
      briefs: [] as BriefRow[],
      stats: null as BriefStats | null,
      total: 0,
      error: `Erreur chargement: ${error instanceof Error ? error.message : "inconnu"}`,
    });
  }
}

// ── Action ──

export async function action({ request }: ActionFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const briefId = formData.get("briefId") as string;

  try {
    if (intent === "validate") {
      const res = await fetch(`${backendUrl}/api/admin/page-briefs/validate`, {
        method: "POST",
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ briefIds: [parseInt(briefId, 10)] }),
      });
      const data = await res.json();
      return json({
        ok: data.validated === true,
        action: "validate",
        briefId,
        message: data.validated
          ? "Brief valide"
          : `Overlap detecte: ${data.overlap?.details?.length ?? 0} conflits`,
      });
    }

    if (intent === "activate") {
      const res = await fetch(
        `${backendUrl}/api/admin/page-briefs/${briefId}/activate`,
        {
          method: "PATCH",
          headers: { Cookie: cookieHeader },
        },
      );
      const data = await res.json();
      return json({
        ok: !!data.id,
        action: "activate",
        briefId,
        message: data.id ? "Brief active" : "Erreur activation",
      });
    }

    return json({
      ok: false,
      action: intent,
      briefId,
      message: "Action inconnue",
    });
  } catch (error) {
    return json({
      ok: false,
      action: intent,
      briefId,
      message: `Erreur: ${error instanceof Error ? error.message : "inconnu"}`,
    });
  }
}

// ── Helper components ──

const roleBadgeColors: Record<string, string> = {
  R1: "bg-blue-100 text-blue-700",
  R3_guide: "bg-purple-100 text-purple-700",
  R3_conseils: "bg-teal-100 text-teal-700",
  R4: "bg-orange-100 text-orange-700",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge
      className={`text-xs ${roleBadgeColors[role] ?? "bg-gray-100 text-gray-700"}`}
    >
      {role}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-green-500 text-white text-xs hover:bg-green-600">
          active
        </Badge>
      );
    case "validated":
      return (
        <Badge className="bg-blue-500 text-white text-xs hover:bg-blue-600">
          validated
        </Badge>
      );
    case "draft":
      return (
        <Badge variant="secondary" className="text-xs">
          draft
        </Badge>
      );
    case "archived":
      return (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          archived
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-xs">
          {status}
        </Badge>
      );
  }
}

function ScoreCell({ value }: { value: number | null }) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">-</span>;
  const pct = Math.round(value * 100);
  const color =
    pct >= 80
      ? "text-green-600"
      : pct >= 50
        ? "text-amber-600"
        : "text-red-600";
  return <span className={`font-mono ${color}`}>{pct}%</span>;
}

// ── Stats Cards ──

function StatsCards({ stats }: { stats: BriefStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            Total Briefs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">{stats.gammes} gammes</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Active
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          <p className="text-xs text-muted-foreground">sur {stats.total}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-amber-500" />
            Draft
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-amber-600">{stats.draft}</p>
          <p className="text-xs text-muted-foreground">a valider</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Confidence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {Math.round(stats.avgConfidence * 100)}%
          </p>
          <p className="text-xs text-muted-foreground">
            coverage: {Math.round(stats.avgCoverage * 100)}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Filter Bar ──

function FilterBar() {
  const [searchParams, setSearchParams] = useSearchParams();

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filtres
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Filtrer par gamme..."
            defaultValue={searchParams.get("pgAlias") || ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateFilter("pgAlias", e.currentTarget.value);
              }
            }}
            className="px-3 py-1.5 text-sm border rounded-md w-48 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <select
            value={searchParams.get("pageRole") || ""}
            onChange={(e) => updateFilter("pageRole", e.target.value)}
            className="px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">Tous les roles</option>
            <option value="R1">R1</option>
            <option value="R3_guide">R3_guide</option>
            <option value="R3_conseils">R3_conseils</option>
            <option value="R4">R4</option>
          </select>
          <select
            value={searchParams.get("status") || ""}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">Tous les statuts</option>
            <option value="draft">Draft</option>
            <option value="validated">Validated</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Expanded Brief Details ──

function ExpandedBriefDetails({ brief }: { brief: BriefRow }) {
  return (
    <div className="pl-8 py-3 space-y-3 bg-gray-50 border-t text-sm">
      {brief.angles_obligatoires?.length > 0 && (
        <div>
          <span className="font-medium text-gray-600">
            Angles obligatoires:
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {brief.angles_obligatoires.map((a, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {a}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {brief.secondary_intents?.length > 0 && (
        <div>
          <span className="font-medium text-gray-600">
            Intents secondaires:
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {brief.secondary_intents.map((s, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {brief.keywords_secondary?.length > 0 && (
        <div>
          <span className="font-medium text-gray-600">
            Keywords secondaires:
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">
            {brief.keywords_secondary.join(", ")}
          </p>
        </div>
      )}

      {brief.faq_paa?.length > 0 && (
        <div>
          <span className="font-medium text-gray-600">
            FAQ/PAA ({brief.faq_paa.length}):
          </span>
          <ul className="list-disc list-inside mt-1 text-xs text-muted-foreground space-y-0.5">
            {brief.faq_paa.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {brief.termes_techniques?.length > 0 && (
        <div>
          <span className="font-medium text-gray-600">Termes techniques:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {brief.termes_techniques.map((t, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {brief.preuves?.length > 0 && (
        <div>
          <span className="font-medium text-gray-600">Preuves:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {brief.preuves.map((p, i) => (
              <Badge key={i} variant="outline" className="text-xs bg-green-50">
                {p}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {brief.forbidden_overlap?.length > 0 && (
        <div>
          <span className="font-medium text-gray-600">Forbidden overlap:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {brief.forbidden_overlap.map((f, i) => (
              <Badge key={i} variant="destructive" className="text-xs">
                {f}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {brief.writing_constraints?.length > 0 && (
        <div>
          <span className="font-medium text-gray-600">
            Writing constraints:
          </span>
          <ul className="list-disc list-inside mt-1 text-xs text-muted-foreground space-y-0.5">
            {brief.writing_constraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t border-gray-200">
        <span>
          Updated:{" "}
          {brief.updated_at
            ? new Date(brief.updated_at).toLocaleDateString("fr-FR")
            : "-"}
        </span>
        {brief.keyword_source && <span>Source: {brief.keyword_source}</span>}
        {brief.llm_provider && <span>Provider: {brief.llm_provider}</span>}
      </div>
    </div>
  );
}

// ── Brief Table ──

function BriefTable({ briefs }: { briefs: BriefRow[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const fetcher = useFetcher();

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Page Briefs
        </CardTitle>
        <CardDescription>
          {briefs.length} briefs SEO par gamme et role
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Gamme</th>
                <th className="text-left p-3 font-medium">Role</th>
                <th className="text-left p-3 font-medium">Primary Intent</th>
                <th className="text-left p-3 font-medium">Keywords</th>
                <th className="text-right p-3 font-medium">Conf.</th>
                <th className="text-right p-3 font-medium">Cov.</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">v</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {briefs.map((b) => {
                const isExpanded = expanded.has(b.id);
                const hasDetails =
                  (b.angles_obligatoires?.length ?? 0) > 0 ||
                  (b.faq_paa?.length ?? 0) > 0 ||
                  (b.preuves?.length ?? 0) > 0;

                return (
                  <Fragment key={b.id}>
                    <tr
                      className={`border-b hover:bg-muted/30 ${hasDetails ? "cursor-pointer" : ""}`}
                      onClick={() => hasDetails && toggle(b.id)}
                    >
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-1">
                          {hasDetails &&
                            (isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ))}
                          {b.pg_alias}
                        </div>
                      </td>
                      <td className="p-3">
                        <RoleBadge role={b.page_role} />
                      </td>
                      <td className="p-3 max-w-[240px]">
                        <span
                          className="truncate block"
                          title={b.primary_intent}
                        >
                          {b.primary_intent
                            ? b.primary_intent.length > 60
                              ? b.primary_intent.slice(0, 60) + "..."
                              : b.primary_intent
                            : "-"}
                        </span>
                      </td>
                      <td className="p-3 text-xs">
                        {b.keywords_primary || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <ScoreCell value={b.confidence_score} />
                      </td>
                      <td className="p-3 text-right">
                        <ScoreCell value={b.coverage_score} />
                      </td>
                      <td className="p-3">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        v{b.version}
                      </td>
                      <td className="p-3 text-right">
                        <div
                          className="flex gap-1 justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {b.status === "draft" && (
                            <fetcher.Form method="post">
                              <input
                                type="hidden"
                                name="intent"
                                value="validate"
                              />
                              <input
                                type="hidden"
                                name="briefId"
                                value={b.id}
                              />
                              <button
                                type="submit"
                                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                disabled={fetcher.state !== "idle"}
                              >
                                Valider
                              </button>
                            </fetcher.Form>
                          )}
                          {b.status === "validated" && (
                            <fetcher.Form method="post">
                              <input
                                type="hidden"
                                name="intent"
                                value="activate"
                              />
                              <input
                                type="hidden"
                                name="briefId"
                                value={b.id}
                              />
                              <button
                                type="submit"
                                className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                disabled={fetcher.state !== "idle"}
                              >
                                Activer
                              </button>
                            </fetcher.Form>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={9}>
                          <ExpandedBriefDetails brief={b} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {briefs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Aucun brief trouve</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──

export default function AdminPageBriefs() {
  const { briefs, stats, error } = useLoaderData<typeof loader>();

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          Page Briefs
        </h1>
        <p className="text-muted-foreground">
          Briefs SEO par gamme et role — angles, FAQ, keywords, contraintes
        </p>
      </div>

      {stats && <StatsCards stats={stats} />}

      <FilterBar />

      <BriefTable briefs={briefs} />
    </div>
  );
}
