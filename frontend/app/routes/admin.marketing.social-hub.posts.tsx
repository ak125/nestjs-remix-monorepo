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
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  DashboardShell,
  KpiGrid,
} from "~/components/admin/patterns/DashboardShell";
import { KpiCard } from "~/components/admin/patterns/KpiCard";
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
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
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

  const [postsRes] = await Promise.allSettled([
    fetch(
      getInternalApiUrlFromRequest(
        `/api/admin/marketing/social/posts?${params.toString()}`,
        request,
      ),
      { headers },
    ),
  ]);

  const postsData =
    postsRes.status === "fulfilled" && postsRes.value.ok
      ? await postsRes.value.json()
      : { data: [], total: 0 };

  return json({
    posts: (postsData.data || []) as SocialPost[],
    total: postsData.total || 0,
    filters: { week, status },
  });
}

// ── Component ──

export default function SocialHubPostsPage() {
  const { posts, total, filters } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [previewPost, setPreviewPost] = useState<SocialPost | null>(null);
  const [approvePost, setApprovePost] = useState<SocialPost | null>(null);
  const [loading, setLoading] = useState(false);

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
              <div className="flex gap-2 sm:ml-auto">
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
      {/* Posts Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Posts ({total})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">ID</TableHead>
                <TableHead>Jour</TableHead>
                <TableHead>Pilier</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Aucun post pour cette semaine
                  </TableCell>
                </TableRow>
              ) : (
                posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-mono text-xs">
                      {post.id}
                    </TableCell>
                    <TableCell>
                      {DAY_NAMES[post.day_of_week] || `J${post.day_of_week}`}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          PILLAR_COLORS[post.slot_label] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {post.slot_label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs uppercase">
                      {post.primary_channel}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={POST_STATUS_MAP[post.status] || "NEUTRAL"}
                        label={post.status}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell>
                      {post.brand_gate_level ? (
                        <StatusBadge
                          status={
                            GATE_LEVEL_MAP[post.brand_gate_level] || "NEUTRAL"
                          }
                          label={post.brand_gate_level}
                          size="sm"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {post.compliance_gate_level ? (
                        <StatusBadge
                          status={
                            GATE_LEVEL_MAP[post.compliance_gate_level] ||
                            "NEUTRAL"
                          }
                          label={post.compliance_gate_level}
                          size="sm"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {post.quality_score != null
                        ? `${post.quality_score}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setPreviewPost(post)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setApprovePost(post)}
                            disabled={post.status !== "gate_passed" || loading}
                          >
                            <ThumbsUp className="mr-2 h-4 w-4" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleReject(post.id)}
                            disabled={loading}
                          >
                            <ThumbsDown className="mr-2 h-4 w-4" />
                            Reject
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleRunGate(post.id)}
                            disabled={loading}
                          >
                            <ShieldAlert className="mr-2 h-4 w-4" />
                            Run Gate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
