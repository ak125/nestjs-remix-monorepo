import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Map,
  AlertCircle,
  CheckCircle2,
  Clock,
  BookOpen,
  ShoppingCart,
  Activity,
  AlertTriangle,
  GitBranch,
  FileText,
} from "lucide-react";
import {
  DashboardShell,
  KpiGrid,
} from "~/components/admin/patterns/DashboardShell";
import { KpiCard } from "~/components/admin/patterns/KpiCard";
import {
  StatusBadge,
  type StatusType,
} from "~/components/admin/patterns/StatusBadge";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta = () => createNoIndexMeta("Content Roadmap - Admin");

// ── Types ──

interface CoverageData {
  total_gammes: number;
  gammes_with_advice: number;
  gammes_with_conseil_seo: number;
  gammes_with_purchase_guide: number;
  gammes_with_reference: number;
  gammes_with_diagnostic: number;
  gammes_with_roadmap: number;
  coverage_pct: number;
  gaps: GapItem[];
}

interface GapItem {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  has_advice: boolean;
  has_reference: boolean;
  has_diagnostic: boolean;
  has_roadmap: boolean;
  has_conseil_seo: boolean;
  has_purchase_guide: boolean;
}

interface PipelineGamme {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  r1_pieces: string | null;
  r3_conseils: string | null;
  r3_guide_achat: string | null;
  r4_reference: string | null;
  has_conseil: boolean;
  has_purchase_guide: boolean;
  has_reference: boolean;
  has_diagnostic: boolean;
  pipeline_last_run: string | null;
  pipeline_overall: string;
}

interface PipelineSummary {
  total: number;
  published: number;
  in_progress: number;
  failed: number;
  skipped: number;
  pending: number;
}

interface PipelineData {
  gammes: PipelineGamme[];
  summary: PipelineSummary;
}

// ── Helpers ──

function pipelineStatusToType(s: string | null): StatusType {
  if (!s) return "NEUTRAL";
  if (s === "auto_published" || s === "published") return "PASS";
  if (s === "draft") return "PENDING";
  if (s === "failed") return "FAIL";
  if (s === "skipped") return "WARN";
  return "NEUTRAL";
}

function pipelineStatusLabel(s: string | null): string {
  if (!s) return "-";
  if (s === "auto_published") return "auto";
  return s;
}

// ── Loader ──

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "";
    const content_type = url.searchParams.get("content_type") || "";
    const page = url.searchParams.get("page") || "1";
    const view = url.searchParams.get("view") || "pipeline";

    const params = new URLSearchParams({ page, limit: "20" });
    if (status) params.set("status", status);
    if (content_type) params.set("content_type", content_type);

    const cookieHeader = { Cookie: request.headers.get("Cookie") || "" };
    const base = "/api/admin/marketing/content-roadmap";

    const [roadmapRes, coverageRes, pipelineRes] = await Promise.all([
      fetch(getInternalApiUrlFromRequest(`${base}?${params}`, request), {
        headers: cookieHeader,
      }),
      fetch(getInternalApiUrlFromRequest(`${base}/coverage`, request), {
        headers: cookieHeader,
      }),
      fetch(getInternalApiUrlFromRequest(`${base}/pipeline-status`, request), {
        headers: cookieHeader,
      }),
    ]);

    const [roadmapData, coverageData, pipelineData] = await Promise.all([
      roadmapRes.ok ? roadmapRes.json() : { data: [], total: 0, totalPages: 0 },
      coverageRes.ok ? coverageRes.json() : { data: null },
      pipelineRes.ok ? pipelineRes.json() : { data: null },
    ]);

    return json({
      roadmap: roadmapData.data || [],
      coverage: coverageData.data as CoverageData | null,
      pipeline: pipelineData.data as PipelineData | null,
      total: roadmapData.total || 0,
      page: parseInt(page),
      totalPages: roadmapData.totalPages || 0,
      view,
      error: null,
    });
  } catch (e: unknown) {
    return json({
      roadmap: [],
      coverage: null,
      pipeline: null,
      total: 0,
      page: 1,
      totalPages: 0,
      view: "pipeline",
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
}

// ── Component ──

export default function ContentRoadmapPage() {
  const { roadmap, coverage, pipeline, total, page, totalPages, view, error } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentView = searchParams.get("view") || view;

  const statusOptions = [
    { value: "", label: "Tous" },
    { value: "planned", label: "Planifie" },
    { value: "writing", label: "En cours" },
    { value: "review", label: "Relecture" },
    { value: "published", label: "Publie" },
  ];

  const currentStatus = searchParams.get("status") || "";

  const handleStatusChange = (status: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (status) {
      newParams.set("status", status);
    } else {
      newParams.delete("status");
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const switchView = (v: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("view", v);
    setSearchParams(newParams);
  };

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-red-500">Erreur: {error}</p>
      </Card>
    );
  }

  return (
    <DashboardShell
      title="Content Roadmap"
      description="Couverture contenu et statut pipeline RAG"
      kpis={
        coverage ? (
          <KpiGrid columns={4}>
            <KpiCard
              title="Couverture"
              value={`${coverage.coverage_pct}%`}
              icon={Activity}
              variant={
                coverage.coverage_pct >= 80
                  ? "success"
                  : coverage.coverage_pct >= 50
                    ? "warning"
                    : "danger"
              }
              subtitle={`${coverage.total_gammes} gammes`}
            />
            <KpiCard
              title="Conseil SEO"
              value={coverage.gammes_with_conseil_seo}
              icon={BookOpen}
              variant="success"
              subtitle="sections conseil pipeline"
            />
            <KpiCard
              title="Guide achat"
              value={coverage.gammes_with_purchase_guide}
              icon={ShoppingCart}
              variant="success"
              subtitle="guides enrichis"
            />
            <KpiCard
              title="References"
              value={coverage.gammes_with_reference}
              icon={FileText}
              variant="info"
              subtitle="pages reference"
            />
            <KpiCard
              title="Diagnostics"
              value={coverage.gammes_with_diagnostic}
              icon={Activity}
              variant="info"
              subtitle="gammes avec diag"
            />
            {pipeline && (
              <>
                <KpiCard
                  title="Pipeline OK"
                  value={pipeline.summary.published}
                  icon={CheckCircle2}
                  variant="success"
                  subtitle="auto_published"
                />
                <KpiCard
                  title="Pipeline KO"
                  value={pipeline.summary.failed}
                  icon={AlertTriangle}
                  variant={pipeline.summary.failed > 0 ? "danger" : "default"}
                  subtitle="failed runs"
                />
              </>
            )}
          </KpiGrid>
        ) : undefined
      }
      filters={
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              {/* View toggle */}
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={currentView === "pipeline" ? "default" : "outline"}
                  onClick={() => switchView("pipeline")}
                >
                  <GitBranch className="h-3.5 w-3.5 mr-1" />
                  Pipeline
                </Button>
                <Button
                  size="sm"
                  variant={currentView === "roadmap" ? "default" : "outline"}
                  onClick={() => switchView("roadmap")}
                >
                  <Map className="h-3.5 w-3.5 mr-1" />
                  Roadmap
                </Button>
              </div>
              {/* Status filters (roadmap view only) */}
              {currentView === "roadmap" && (
                <div className="flex gap-1 ml-auto">
                  {statusOptions.map((option) => (
                    <Button
                      key={option.value}
                      size="sm"
                      variant={
                        currentStatus === option.value ? "default" : "outline"
                      }
                      onClick={() => handleStatusChange(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              )}
              {/* Pipeline summary (pipeline view) */}
              {currentView === "pipeline" && pipeline && (
                <div className="flex gap-3 ml-auto text-xs text-muted-foreground">
                  <span>
                    Published:{" "}
                    <strong className="text-green-600">
                      {pipeline.summary.published}
                    </strong>
                  </span>
                  <span>
                    In progress:{" "}
                    <strong className="text-blue-600">
                      {pipeline.summary.in_progress}
                    </strong>
                  </span>
                  <span>
                    Failed:{" "}
                    <strong className="text-red-600">
                      {pipeline.summary.failed}
                    </strong>
                  </span>
                  <span>
                    Pending: <strong>{pipeline.summary.pending}</strong>
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      }
    >
      {/* Pipeline View */}
      {currentView === "pipeline" && pipeline && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Pipeline RAG ({pipeline.summary.total} gammes)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="px-4 pb-2 font-medium">Gamme</th>
                    <th className="px-2 pb-2 font-medium text-center">
                      R1 Pieces
                    </th>
                    <th className="px-2 pb-2 font-medium text-center">
                      R3 Conseils
                    </th>
                    <th className="px-2 pb-2 font-medium text-center">
                      R3 Guide
                    </th>
                    <th className="px-2 pb-2 font-medium text-center">
                      R4 Ref
                    </th>
                    <th className="px-2 pb-2 font-medium text-center">
                      Conseil
                    </th>
                    <th className="px-2 pb-2 font-medium text-center">Guide</th>
                    <th className="px-4 pb-2 font-medium">MAJ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pipeline.gammes.map((g) => (
                    <tr key={g.pg_id} className="hover:bg-muted/50">
                      <td className="px-4 py-2">
                        <div className="font-medium text-sm">{g.pg_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {g.pg_alias}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <StatusBadge
                          status={pipelineStatusToType(g.r1_pieces)}
                          label={pipelineStatusLabel(g.r1_pieces)}
                          size="sm"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <StatusBadge
                          status={pipelineStatusToType(g.r3_conseils)}
                          label={pipelineStatusLabel(g.r3_conseils)}
                          size="sm"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <StatusBadge
                          status={pipelineStatusToType(g.r3_guide_achat)}
                          label={pipelineStatusLabel(g.r3_guide_achat)}
                          size="sm"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <StatusBadge
                          status={pipelineStatusToType(g.r4_reference)}
                          label={pipelineStatusLabel(g.r4_reference)}
                          size="sm"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        {g.has_conseil ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {g.has_purchase_guide ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {g.pipeline_last_run
                          ? new Date(g.pipeline_last_run).toLocaleDateString(
                              "fr-FR",
                            )
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roadmap View */}
      {currentView === "roadmap" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Roadmap ({total})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-2 font-medium">Titre</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Priorite</th>
                    <th className="pb-2 font-medium">Statut</th>
                    <th className="pb-2 font-medium">Mots</th>
                    <th className="pb-2 font-medium">Deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {roadmap.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Aucun contenu planifie
                      </td>
                    </tr>
                  ) : (
                    roadmap.map((item: any) => (
                      <tr key={item.id} className="hover:bg-muted/50">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Map className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="font-medium">{item.title}</div>
                              {item.target_family && (
                                <Badge
                                  variant="outline"
                                  className="mt-1 text-xs"
                                >
                                  {item.target_family}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <Badge variant="secondary">{item.content_type}</Badge>
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              item.priority === "critical"
                                ? "destructive"
                                : item.priority === "high"
                                  ? "default"
                                  : "outline"
                            }
                          >
                            {item.priority}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {item.status === "published" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : item.status === "writing" ? (
                              <Clock className="h-4 w-4 text-blue-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-gray-400" />
                            )}
                            <span>{item.status}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          {item.estimated_words?.toLocaleString() ?? "-"}
                        </td>
                        <td className="py-3">
                          {item.deadline ? (
                            <span
                              className={
                                new Date(item.deadline) < new Date()
                                  ? "text-red-600 font-semibold"
                                  : "text-gray-600"
                              }
                            >
                              {new Date(item.deadline).toLocaleDateString(
                                "fr-FR",
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {page > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set("page", String(page - 1));
                      setSearchParams(newParams);
                    }}
                  >
                    Precedent
                  </Button>
                )}
                <span className="flex items-center px-4 text-sm text-muted-foreground">
                  Page {page} / {totalPages}
                </span>
                {page < totalPages && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set("page", String(page + 1));
                      setSearchParams(newParams);
                    }}
                  >
                    Suivant
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lacunes */}
      {coverage && coverage.gaps && coverage.gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Lacunes de contenu ({coverage.gaps.length} gammes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {coverage.gaps.slice(0, 10).map((gap: GapItem) => (
                <div
                  key={gap.pg_id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded"
                >
                  <div>
                    <span className="font-medium">{gap.pg_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({gap.pg_alias})
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {!gap.has_advice && (
                      <Badge variant="destructive" className="text-xs">
                        Sans conseil
                      </Badge>
                    )}
                    {!gap.has_purchase_guide && (
                      <Badge variant="outline" className="text-xs">
                        Sans guide
                      </Badge>
                    )}
                    {!gap.has_reference && (
                      <Badge variant="destructive" className="text-xs">
                        Sans ref
                      </Badge>
                    )}
                    {!gap.has_diagnostic && (
                      <Badge variant="secondary" className="text-xs">
                        Sans diag
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {coverage.gaps.length > 10 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  ... et {coverage.gaps.length - 10} autres lacunes
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardShell>
  );
}
