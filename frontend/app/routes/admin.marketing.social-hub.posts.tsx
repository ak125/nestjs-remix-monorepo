import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  FileText,
  CheckCircle2,
  ShieldCheck,
  Send,
  MoreHorizontal,
  Eye,
  ThumbsUp,
  ThumbsDown,
  ShieldAlert,
  Download,
  RefreshCw,
  Wand2,
  Sparkles,
  Play,
  CalendarDays,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminDataTable } from "~/components/admin/patterns/AdminDataTable";
import {
  DashboardShell,
  KpiGrid,
} from "~/components/admin/patterns/DashboardShell";
import { KpiCard } from "~/components/admin/patterns/KpiCard";
import { type DataColumn } from "~/components/admin/patterns/ResponsiveDataTable";
import {
  StatusBadge,
  type StatusType,
} from "~/components/admin/patterns/StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectItem } from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () => createNoIndexMeta("Social Hub - Admin");

// ── Types ──

interface SocialPost {
  id: number;
  week_iso: string;
  day_of_week: number;
  slot_label: string;
  primary_channel: string;
  channels_list: string[];
  channels: Record<string, ChannelData>;
  gamme_alias: string | null;
  status: string;
  brand_gate_level: string | null;
  compliance_gate_level: string | null;
  quality_score: number | null;
  gate_summary: { blocking_issues?: string[] } | null;
  source_url: string | null;
  utm_campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  created_at: string;
  updated_at: string;
}

interface ChannelData {
  caption?: string;
  hashtags?: string[];
  format?: string;
  dimensions?: string;
  visual_brief?: string;
  alt_text?: string;
  link_preview?: string;
  title?: string;
  description?: string;
  tags?: string[];
  hook_script?: string;
  thumbnail_brief?: string;
}

interface PipelineStatus {
  plan_status: string | null;
  posts: {
    draft: number;
    generated: number;
    gate_passed: number;
    gate_failed: number;
    approved: number;
    published: number;
  };
  total: number;
}

// ── Mappings ──

const POST_STATUS_MAP: Record<string, StatusType> = {
  draft: "PENDING",
  generated: "INFO",
  gate_passed: "PASS",
  gate_failed: "FAIL",
  approved: "PASS",
  published: "PASS",
};

const GATE_LEVEL_MAP: Record<string, StatusType> = {
  PASS: "PASS",
  WARN: "WARN",
  FAIL: "FAIL",
};

const PILLAR_COLORS: Record<string, string> = {
  catalogue: "bg-blue-100 text-blue-800",
  conseil: "bg-emerald-100 text-emerald-800",
  confiance: "bg-amber-100 text-amber-800",
  promo: "bg-red-100 text-red-800",
};

const DAY_NAMES = [
  "",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

const STATUS_OPTIONS = [
  { value: "", label: "Tous" },
  { value: "draft", label: "Draft" },
  { value: "generated", label: "Generated" },
  { value: "gate_passed", label: "Gate Passed" },
  { value: "gate_failed", label: "Gate Failed" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
];

// ── Helpers ──

function getCurrentWeekISO(): string {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const dayDiff = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayDiff + 1);
  const weekNum = Math.ceil(
    ((now.getTime() - monday.getTime()) / 86400000 + 1) / 7,
  );
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// ── Loader ──

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const headers = { Cookie: cookie };
  const url = new URL(request.url);

  const week = url.searchParams.get("week") || getCurrentWeekISO();
  const status = url.searchParams.get("status") || "";

  const params = new URLSearchParams({ week });
  if (status) params.set("status", status);

  const [postsRes, statusRes] = await Promise.allSettled([
    fetch(
      getInternalApiUrlFromRequest(
        `/api/admin/marketing/social/posts?${params.toString()}`,
        request,
      ),
      { headers },
    ),
    fetch(
      getInternalApiUrlFromRequest(
        `/api/admin/marketing/pipeline/status/${week}`,
        request,
      ),
      { headers },
    ),
  ]);

  const postsData =
    postsRes.status === "fulfilled" && postsRes.value.ok
      ? await postsRes.value.json()
      : { data: [], total: 0 };

  const pipelineData =
    statusRes.status === "fulfilled" && statusRes.value.ok
      ? await statusRes.value.json()
      : null;

  return json({
    posts: (postsData.data || []) as SocialPost[],
    total: postsData.total || 0,
    filters: { week, status },
    pipeline: pipelineData as PipelineStatus | null,
  });
}

// ── Post Actions ──

function PostActions({
  post,
  onPreview,
  onApprove,
  onReject,
  onRunGate,
  disabled,
}: {
  post: SocialPost;
  onPreview: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRunGate: () => void;
  disabled: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onPreview}>
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onApprove}
          disabled={post.status !== "gate_passed" || disabled}
        >
          <ThumbsUp className="mr-2 h-4 w-4" />
          Approve
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onReject} disabled={disabled}>
          <ThumbsDown className="mr-2 h-4 w-4" />
          Reject
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onRunGate} disabled={disabled}>
          <ShieldAlert className="mr-2 h-4 w-4" />
          Run Gate
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Component ──

export default function SocialHubPostsPage() {
  const { posts, total, filters, pipeline } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [previewPost, setPreviewPost] = useState<SocialPost | null>(null);
  const [approvePost, setApprovePost] = useState<SocialPost | null>(null);
  const [loading, setLoading] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planWeek, setPlanWeek] = useState(filters.week);
  const [planGammes, setPlanGammes] = useState("");
  const [pipelineLoading, setPipelineLoading] = useState<string | null>(null);

  // ── KPI counts ──
  const counts = {
    total: posts.length,
    gate_passed: posts.filter((p) => p.status === "gate_passed").length,
    approved: posts.filter((p) => p.status === "approved").length,
    published: posts.filter((p) => p.status === "published").length,
  };

  // ── Filters ──
  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params);
  }

  // ── Actions ──
  async function handleApprove(id: number) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/marketing/social/posts/${id}/approve`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved_by: "admin" }),
        },
      );
      const data = await res.json();
      if (data.success) {
        toast.success(`Post #${id} approuve`);
        setSearchParams(new URLSearchParams(searchParams));
      } else {
        toast.error("Echec de l'approbation");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setLoading(false);
      setApprovePost(null);
    }
  }

  async function handleReject(id: number) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/marketing/social/posts/${id}/reject`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = await res.json();
      if (data.success) {
        toast.success(`Post #${id} rejete`);
        setSearchParams(new URLSearchParams(searchParams));
      } else {
        toast.error("Echec du rejet");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setLoading(false);
    }
  }

  async function handleRunGate(id: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/marketing/social/posts/${id}/gate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.data) {
        toast.success(
          `Gate: brand=${data.data.brand.level} compliance=${data.data.compliance.level}`,
        );
        setSearchParams(new URLSearchParams(searchParams));
      } else {
        toast.error(data.error || "Echec du gate");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setLoading(false);
    }
  }

  function handleExport(channel: string) {
    const week = searchParams.get("week") || filters.week;
    window.open(
      `/api/admin/marketing/social/export?week=${week}&channel=${channel}`,
      "_blank",
    );
  }

  // ── Pipeline Actions ──

  async function handleGeneratePlan() {
    setPipelineLoading("plan");
    try {
      const aliases = planGammes
        .split(/[,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/marketing/pipeline/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_iso: planWeek,
          ...(aliases.length > 0 ? { gamme_aliases: aliases } : {}),
        }),
      });
      const data = await res.json();
      if (data.week_iso) {
        toast.success(
          `Plan ${planWeek} genere : ${data.plan_json?.length || 0} slots`,
        );
        setPlanDialogOpen(false);
        updateFilter("week", planWeek);
      } else {
        toast.error(data.message || "Echec de la generation du plan");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setPipelineLoading(null);
    }
  }

  async function handleGenerateCopy() {
    const week = searchParams.get("week") || filters.week;
    setPipelineLoading("copy");
    try {
      const res = await fetch("/api/admin/marketing/pipeline/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_iso: week }),
      });
      const data = await res.json();
      if (data.generated != null) {
        toast.success(
          `${data.generated} posts generes, ${data.errors} erreurs`,
        );
        setSearchParams(new URLSearchParams(searchParams));
      } else {
        toast.error(data.message || "Echec de la generation");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setPipelineLoading(null);
    }
  }

  async function handleGateAll() {
    const week = searchParams.get("week") || filters.week;
    setPipelineLoading("gate");
    try {
      const res = await fetch("/api/admin/marketing/pipeline/gate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_iso: week }),
      });
      const data = await res.json();
      if (data.passed != null) {
        toast.success(
          `Gates: ${data.passed} passed, ${data.warned} warned, ${data.failed} failed`,
        );
        setSearchParams(new URLSearchParams(searchParams));
      } else {
        toast.error(data.message || "Echec des gates");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setPipelineLoading(null);
    }
  }

  // ── Column definitions ──
  const postColumns: DataColumn<SocialPost>[] = [
    {
      key: "id",
      header: "ID",
      width: "56px",
      render: (val) => <span className="font-mono text-xs">{String(val)}</span>,
    },
    {
      key: "day_of_week",
      header: "Jour",
      render: (val) => DAY_NAMES[val as number] || `J${val}`,
    },
    {
      key: "slot_label",
      header: "Pilier",
      render: (val) => (
        <Badge
          variant="outline"
          className={
            PILLAR_COLORS[val as string] || "bg-gray-100 text-gray-800"
          }
        >
          {String(val)}
        </Badge>
      ),
    },
    {
      key: "primary_channel",
      header: "Canal",
      render: (val) => <span className="text-xs uppercase">{String(val)}</span>,
    },
    {
      key: "status",
      header: "Statut",
    },
    {
      key: "brand_gate_level",
      header: "Brand",
      render: (val) =>
        val ? (
          <StatusBadge
            status={GATE_LEVEL_MAP[val as string] || "NEUTRAL"}
            label={String(val)}
            size="sm"
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "compliance_gate_level",
      header: "Compliance",
      render: (val) =>
        val ? (
          <StatusBadge
            status={GATE_LEVEL_MAP[val as string] || "NEUTRAL"}
            label={String(val)}
            size="sm"
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "quality_score",
      header: "Score",
      align: "right" as const,
      render: (val) => (
        <span className="font-mono text-sm">
          {val != null ? String(val) : "—"}
        </span>
      ),
    },
    {
      key: "updated_at",
      header: "",
      width: "40px",
      render: (_val, row) => (
        <PostActions
          post={row as SocialPost}
          onPreview={() => setPreviewPost(row as SocialPost)}
          onApprove={() => setApprovePost(row as SocialPost)}
          onReject={() => handleReject((row as SocialPost).id)}
          onRunGate={() => handleRunGate((row as SocialPost).id)}
          disabled={loading}
        />
      ),
    },
  ];

  return (
    <DashboardShell
      title="Social Hub"
      description="Gestion des posts sociaux multi-canal"
      kpis={
        <KpiGrid columns={4}>
          <KpiCard
            title="Total posts"
            value={counts.total}
            icon={FileText}
            variant="info"
          />
          <KpiCard
            title="Gate Passed"
            value={counts.gate_passed}
            icon={ShieldCheck}
            variant="success"
          />
          <KpiCard
            title="Approved"
            value={counts.approved}
            icon={CheckCircle2}
            variant="success"
          />
          <KpiCard
            title="Published"
            value={counts.published}
            icon={Send}
            variant="info"
          />
        </KpiGrid>
      }
      filters={
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="week">Semaine</Label>
                <Input
                  id="week"
                  type="text"
                  placeholder="2026-W09"
                  defaultValue={filters.week}
                  className="w-36"
                  onBlur={(e) => updateFilter("week", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      updateFilter("week", e.currentTarget.value);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Statut</Label>
                <Select
                  id="status"
                  value={filters.status}
                  onValueChange={(v) => updateFilter("status", v)}
                  className="w-40"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                {/* Pipeline actions */}
                <Button
                  size="sm"
                  onClick={() => {
                    setPlanWeek(filters.week);
                    setPlanDialogOpen(true);
                  }}
                  disabled={pipelineLoading !== null}
                >
                  {pipelineLoading === "plan" ? (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Plan
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleGenerateCopy}
                  disabled={pipelineLoading !== null || !pipeline?.plan_status}
                  title={
                    !pipeline?.plan_status
                      ? "Generez un plan d'abord"
                      : "Generer le copy pour tous les slots"
                  }
                >
                  {pipelineLoading === "copy" ? (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleGateAll}
                  disabled={
                    pipelineLoading !== null ||
                    (pipeline?.posts.generated || 0) === 0
                  }
                  title={
                    (pipeline?.posts.generated || 0) === 0
                      ? "Pas de posts generated"
                      : "Lancer les gates sur tous les posts"
                  }
                >
                  {pipelineLoading === "gate" ? (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Gates
                </Button>
                {/* Separator */}
                <div className="w-px bg-border self-stretch" />
                {/* Export buttons */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("instagram")}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  IG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("facebook")}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  FB
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("youtube")}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  YT
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      }
    >
      {/* Pipeline Status Bar */}
      {pipeline && (
        <PipelineStatusBar pipeline={pipeline} week={filters.week} />
      )}

      {/* Posts Table */}
      <AdminDataTable<SocialPost>
        data={posts as SocialPost[]}
        columns={postColumns}
        getRowKey={(r) => String(r.id)}
        emptyMessage="Aucun post pour cette semaine"
        statusColumn={{ key: "status", mapping: POST_STATUS_MAP }}
        toolbar={<span className="text-sm font-medium">Posts ({total})</span>}
      />

      {/* Preview Dialog */}
      <Dialog
        open={!!previewPost}
        onOpenChange={(open) => !open && setPreviewPost(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Post #{previewPost?.id} — {previewPost?.slot_label} —{" "}
              {DAY_NAMES[previewPost?.day_of_week || 0]}
            </DialogTitle>
          </DialogHeader>
          {previewPost && (
            <Tabs defaultValue={previewPost.primary_channel}>
              <TabsList>
                {previewPost.channels_list?.map((ch) => (
                  <TabsTrigger key={ch} value={ch}>
                    {ch.toUpperCase()}
                  </TabsTrigger>
                ))}
              </TabsList>
              {previewPost.channels_list?.map((ch) => {
                const data = previewPost.channels?.[ch];
                return (
                  <TabsContent key={ch} value={ch} className="space-y-3 mt-3">
                    {!data ? (
                      <p className="text-sm text-muted-foreground">
                        Pas de contenu pour {ch}
                      </p>
                    ) : ch === "youtube" ? (
                      <YouTubePreview data={data} />
                    ) : (
                      <SocialPreview data={data} channel={ch} />
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
          {previewPost?.gate_summary?.blocking_issues &&
            previewPost.gate_summary.blocking_issues.length > 0 && (
              <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive mb-1">
                  Issues bloquantes
                </p>
                <ul className="text-xs text-destructive space-y-0.5">
                  {previewPost.gate_summary.blocking_issues.map((issue, i) => (
                    <li key={i}>- {issue}</li>
                  ))}
                </ul>
              </div>
            )}
        </DialogContent>
      </Dialog>

      {/* Generate Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generer un plan hebdomadaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-week">Semaine ISO</Label>
              <Input
                id="plan-week"
                type="text"
                placeholder="2026-W09"
                value={planWeek}
                onChange={(e) => setPlanWeek(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-gammes">
                Gammes (optionnel, alias separes par virgules)
              </Label>
              <Textarea
                id="plan-gammes"
                placeholder="disque-frein, plaquette-frein, filtre-a-huile, alternateur"
                value={planGammes}
                onChange={(e) => setPlanGammes(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide pour auto-detection basee sur le SEO
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPlanDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleGeneratePlan}
                disabled={!planWeek || pipelineLoading === "plan"}
              >
                {pipelineLoading === "plan" ? (
                  <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-1.5 h-4 w-4" />
                )}
                Generer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation */}
      <AlertDialog
        open={!!approvePost}
        onOpenChange={(open) => !open && setApprovePost(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Approuver le post #{approvePost?.id} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ce post passera en statut &quot;approved&quot; et sera disponible
              pour export dans le manifest de publication.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => approvePost && handleApprove(approvePost.id)}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ThumbsUp className="mr-2 h-4 w-4" />
              )}
              Approuver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}

// ── Sub-components ──

function PipelineStatusBar({
  pipeline,
  week,
}: {
  pipeline: PipelineStatus;
  week: string;
}) {
  const p = pipeline.posts;
  const steps = [
    {
      label: "Plan",
      value: pipeline.plan_status || "—",
      active: !!pipeline.plan_status,
    },
    {
      label: "Generated",
      value:
        p.generated + p.gate_passed + p.gate_failed + p.approved + p.published,
      active: p.generated > 0 || p.gate_passed > 0,
    },
    {
      label: "Gated",
      value: p.gate_passed + p.gate_failed,
      active: p.gate_passed > 0 || p.gate_failed > 0,
    },
    {
      label: "Approved",
      value: p.approved + p.published,
      active: p.approved > 0 || p.published > 0,
    },
    { label: "Published", value: p.published, active: p.published > 0 },
  ];

  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-1 text-xs">
          <span className="font-medium text-muted-foreground mr-2">{week}</span>
          {steps.map((step, i) => (
            <span key={step.label} className="flex items-center gap-1">
              {i > 0 && (
                <Play className="h-2.5 w-2.5 text-muted-foreground/40" />
              )}
              <span
                className={
                  step.active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }
              >
                {step.label}:{" "}
                <span
                  className={step.active ? "text-primary font-semibold" : ""}
                >
                  {step.value}
                </span>
              </span>
            </span>
          ))}
          {pipeline.total > 0 && (
            <span className="ml-auto text-muted-foreground">
              Total: {pipeline.total}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SocialPreview({
  data,
  channel,
}: {
  data: ChannelData;
  channel: string;
}) {
  return (
    <div className="space-y-3">
      {data.caption && (
        <div>
          <Label className="text-xs text-muted-foreground">Caption</Label>
          <p className="mt-1 whitespace-pre-wrap text-sm rounded-md bg-muted/50 p-3">
            {data.caption}
          </p>
        </div>
      )}
      {data.hashtags && data.hashtags.length > 0 && (
        <div>
          <Label className="text-xs text-muted-foreground">Hashtags</Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {data.hashtags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {tag.startsWith("#") ? tag : `#${tag}`}
              </Badge>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-4 text-xs text-muted-foreground">
        {data.format && <span>Format: {data.format}</span>}
        {data.dimensions && <span>Dim: {data.dimensions}</span>}
      </div>
      {data.visual_brief && (
        <div>
          <Label className="text-xs text-muted-foreground">Visual Brief</Label>
          <p className="mt-1 text-xs text-muted-foreground italic">
            {data.visual_brief}
          </p>
        </div>
      )}
      {data.alt_text && (
        <div>
          <Label className="text-xs text-muted-foreground">Alt Text</Label>
          <p className="mt-1 text-xs">{data.alt_text}</p>
        </div>
      )}
      {channel === "facebook" && data.link_preview && (
        <div>
          <Label className="text-xs text-muted-foreground">Link Preview</Label>
          <p className="mt-1 text-xs">{data.link_preview}</p>
        </div>
      )}
    </div>
  );
}

function YouTubePreview({ data }: { data: ChannelData }) {
  return (
    <div className="space-y-3">
      {data.title && (
        <div>
          <Label className="text-xs text-muted-foreground">Titre</Label>
          <p className="mt-1 font-medium text-sm">{data.title}</p>
        </div>
      )}
      {data.description && (
        <div>
          <Label className="text-xs text-muted-foreground">Description</Label>
          <p className="mt-1 whitespace-pre-wrap text-sm rounded-md bg-muted/50 p-3">
            {data.description}
          </p>
        </div>
      )}
      {data.tags && data.tags.length > 0 && (
        <div>
          <Label className="text-xs text-muted-foreground">Tags</Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {data.tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-4 text-xs text-muted-foreground">
        {data.format && <span>Format: {data.format}</span>}
      </div>
      {data.hook_script && (
        <div>
          <Label className="text-xs text-muted-foreground">Hook Script</Label>
          <p className="mt-1 text-sm italic rounded-md bg-muted/50 p-3">
            {data.hook_script}
          </p>
        </div>
      )}
      {data.thumbnail_brief && (
        <div>
          <Label className="text-xs text-muted-foreground">
            Thumbnail Brief
          </Label>
          <p className="mt-1 text-xs text-muted-foreground italic">
            {data.thumbnail_brief}
          </p>
        </div>
      )}
    </div>
  );
}
