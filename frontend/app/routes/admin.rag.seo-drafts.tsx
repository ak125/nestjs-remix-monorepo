import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FilePen,
  Info,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminDataTable } from "~/components/admin/patterns/AdminDataTable";
import { DashboardShell } from "~/components/admin/patterns/DashboardShell";
import { type DataColumn } from "~/components/admin/patterns/ResponsiveDataTable";
import { StatusBadge } from "~/components/admin/patterns/StatusBadge";
import { Alert, AlertDescription } from "~/components/ui/alert";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card";
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Brouillons SEO - Admin RAG");

// ─── Types ──────────────────────────────────────────────────────

interface SeoDraft {
  pg_id: string;
  pg_alias: string;
  sg_descrip: string | null;
  sg_descrip_draft: string | null;
  sg_content_draft: string | null;
  sg_draft_source: string | null;
  sg_draft_updated_at: string | null;
  quality_score: number | null;
}

interface DraftDetail {
  current: { sg_descrip: string | null; sg_content: string | null };
  draft: {
    sg_descrip_draft: string | null;
    sg_content_draft: string | null;
    sg_draft_source: string | null;
    sg_draft_updated_at: string | null;
  };
}

// ─── Loader ─────────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const res = await fetch(
    getInternalApiUrlFromRequest(
      "/api/admin/content-refresh/seo-drafts",
      request,
    ),
    { headers: { Cookie: cookie } },
  );
  const result = res.ok ? await res.json() : { drafts: [] };
  return json({ drafts: (result.drafts || []) as SeoDraft[] });
}

// ─── Helpers ────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(str: string | null, maxLen: number): string {
  if (!str) return "\u2014";
  return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
}

/** Character count color for meta description */
function metaCharColor(len: number): string {
  if (len === 0) return "text-muted-foreground";
  if (len >= 120 && len <= 160) return "text-green-600";
  if (len < 120) return "text-yellow-600";
  return "text-red-600";
}

/** Quality score color classes */
function scoreColorClass(score: number): string {
  if (score >= 85) return "bg-green-100 text-green-800";
  if (score >= 70) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function scoreProgressClass(score: number): string {
  if (score >= 85) return "[&>div]:bg-green-500";
  if (score >= 70) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-red-500";
}

// ─── Word Diff ──────────────────────────────────────────────────

interface DiffSegment {
  text: string;
  type: "same" | "added" | "removed";
}

function wordDiff(oldText: string, newText: string): DiffSegment[] {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

  // Simple LCS-based diff
  const m = oldWords.length;
  const n = newWords.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const segments: DiffSegment[] = [];
  let i = m;
  let j = n;
  const stack: DiffSegment[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      stack.push({ text: oldWords[i - 1], type: "same" });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ text: newWords[j - 1], type: "added" });
      j--;
    } else {
      stack.push({ text: oldWords[i - 1], type: "removed" });
      i--;
    }
  }

  // Reverse to get correct order and merge consecutive same-type segments
  stack.reverse();
  for (const seg of stack) {
    const last = segments[segments.length - 1];
    if (last && last.type === seg.type) {
      last.text += seg.text;
    } else {
      segments.push({ ...seg });
    }
  }

  return segments;
}

function DiffDisplay({
  oldText,
  newText,
}: {
  oldText: string;
  newText: string;
}) {
  if (!oldText && !newText) {
    return <span className="italic text-muted-foreground text-xs">vide</span>;
  }
  if (!oldText) {
    return (
      <span className="text-xs text-green-700 bg-green-50 px-0.5 rounded">
        {newText}
      </span>
    );
  }
  if (!newText) {
    return (
      <span className="text-xs text-red-700 bg-red-50 line-through px-0.5 rounded">
        {oldText}
      </span>
    );
  }

  const segments = wordDiff(oldText, newText);
  return (
    <span className="text-xs leading-relaxed">
      {segments.map((seg, idx) => {
        if (seg.type === "same") {
          return <span key={idx}>{seg.text}</span>;
        }
        if (seg.type === "added") {
          return (
            <span
              key={idx}
              className="bg-green-100 text-green-800 px-0.5 rounded"
            >
              {seg.text}
            </span>
          );
        }
        return (
          <span
            key={idx}
            className="bg-red-100 text-red-800 line-through px-0.5 rounded"
          >
            {seg.text}
          </span>
        );
      })}
    </span>
  );
}

/** Meta char counter badge */
function MetaCharCounter({ text }: { text: string | null }) {
  const len = text?.length ?? 0;
  return (
    <span className={`text-xs font-mono ${metaCharColor(len)}`}>{len}/160</span>
  );
}

/** Quality score badge with mini progress */
function QualityScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-sm text-muted-foreground">{"\u2014"}</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <Progress
        value={score}
        max={100}
        className={`h-1.5 max-w-[50px] flex-1 ${scoreProgressClass(score)}`}
      />
      <Badge
        variant="outline"
        className={`font-mono text-xs ${scoreColorClass(score)}`}
      >
        {score}
      </Badge>
    </div>
  );
}

// ─── Draft Actions ──────────────────────────────────────────────

function DraftActions({
  onCompare,
  onPublish,
  onReject,
}: {
  onCompare: () => void;
  onPublish: () => void;
  onReject: () => void;
}) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onCompare}>
            <Eye className="mr-2 h-4 w-4" />
            Comparer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-green-700" onClick={onPublish}>
            <Check className="mr-2 h-4 w-4" />
            Publier
          </DropdownMenuItem>
          <DropdownMenuItem className="text-red-700" onClick={onReject}>
            <Trash2 className="mr-2 h-4 w-4" />
            Rejeter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function AdminRagSeoDrafts() {
  const { drafts } = useLoaderData<typeof loader>();
  const refreshFetcher = useFetcher<typeof loader>();

  // Sheet comparison
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffData, setDiffData] = useState<DraftDetail | null>(null);
  const [diffAlias, setDiffAlias] = useState("");
  const [diffPgId, setDiffPgId] = useState("");
  const [diffIndex, setDiffIndex] = useState(0);

  // AlertDialog states
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishItemId, setPublishItemId] = useState("");
  const [publishItemAlias, setPublishItemAlias] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectItemId, setRejectItemId] = useState("");
  const [rejectItemAlias, setRejectItemAlias] = useState("");

  // Bulk selection (synced with AdminDataTable)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Filters & sort
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState("all");
  const [sortBy, setSortBy] = useState<keyof SeoDraft>("sg_draft_updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const displayDrafts = refreshFetcher.data?.drafts ?? drafts;

  // Derived: filtered + sorted
  const filteredDrafts = displayDrafts
    .filter((d) => {
      if (
        searchQuery &&
        !d.pg_alias.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (filterSource !== "all" && d.sg_draft_source !== filterSource) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "pg_alias") {
        return dir * a.pg_alias.localeCompare(b.pg_alias);
      }
      if (sortBy === "quality_score") {
        return dir * ((a.quality_score ?? 0) - (b.quality_score ?? 0));
      }
      // date
      const da = a.sg_draft_updated_at ?? "";
      const db = b.sg_draft_updated_at ?? "";
      return dir * da.localeCompare(db);
    });

  // Unique sources for filter
  const uniqueSources = [
    ...new Set(displayDrafts.map((d) => d.sg_draft_source).filter(Boolean)),
  ] as string[];

  // ─── Bulk Actions ────────────────────────────────

  async function bulkPublish() {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    let published = 0;
    const total = selectedIds.size;

    for (const pgId of selectedIds) {
      try {
        const res = await fetch(
          `/api/admin/content-refresh/seo-draft/${pgId}/publish`,
          { method: "PATCH" },
        );
        const data = await res.json();
        if (res.ok && data.published) {
          published++;
          toast.success(`Publie ${published}/${total}`, {
            id: "bulk-progress",
          });
        }
      } catch {
        // continue to next
      }
    }

    toast.success(`${published}/${total} brouillon(s) publie(s)`, {
      id: "bulk-progress",
    });
    setSelectedIds(new Set());
    setBulkProcessing(false);
    refreshFetcher.load("/admin/rag/seo-drafts");
  }

  async function bulkReject() {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    let rejected = 0;
    const total = selectedIds.size;

    for (const pgId of selectedIds) {
      try {
        const res = await fetch(
          `/api/admin/content-refresh/seo-draft/${pgId}`,
          { method: "DELETE" },
        );
        const data = await res.json();
        if (res.ok && data.rejected) {
          rejected++;
          toast.success(`Rejete ${rejected}/${total}`, { id: "bulk-progress" });
        }
      } catch {
        // continue to next
      }
    }

    toast.success(`${rejected}/${total} brouillon(s) rejete(s)`, {
      id: "bulk-progress",
    });
    setSelectedIds(new Set());
    setBulkProcessing(false);
    refreshFetcher.load("/admin/rag/seo-drafts");
  }

  // ─── Sheet Comparison ────────────────────────────

  async function openDiff(pgId: string, alias: string, index?: number) {
    setDiffAlias(alias);
    setDiffPgId(pgId);
    setDiffLoading(true);
    setDiffOpen(true);
    setDiffData(null);
    if (index !== undefined) setDiffIndex(index);
    try {
      const res = await fetch(`/api/admin/content-refresh/seo-draft/${pgId}`);
      if (res.ok) {
        setDiffData(await res.json());
      }
    } catch {
      // silently handle
    } finally {
      setDiffLoading(false);
    }
  }

  function navigateDiff(direction: "prev" | "next") {
    const newIndex =
      direction === "prev"
        ? Math.max(0, diffIndex - 1)
        : Math.min(filteredDrafts.length - 1, diffIndex + 1);
    if (newIndex !== diffIndex) {
      const target = filteredDrafts[newIndex];
      openDiff(target.pg_id, target.pg_alias, newIndex);
    }
  }

  // ─── Single Actions ──────────────────────────────

  function openPublishDialog(pgId: string, alias: string) {
    setPublishItemId(pgId);
    setPublishItemAlias(alias);
    setPublishDialogOpen(true);
  }

  function openRejectDialog(pgId: string, alias: string) {
    setRejectItemId(pgId);
    setRejectItemAlias(alias);
    setRejectDialogOpen(true);
  }

  async function confirmPublish() {
    const pgId = publishItemId;
    setPublishDialogOpen(false);
    try {
      const res = await fetch(
        `/api/admin/content-refresh/seo-draft/${pgId}/publish`,
        { method: "PATCH" },
      );
      const data = await res.json();
      if (!res.ok || !data.published) {
        toast.error(
          `Erreur: ${data.error || data.message || "Publication echouee"}`,
        );
      } else {
        toast.success("Brouillon publie avec succes");
      }
    } catch (err) {
      toast.error(
        `Erreur: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      refreshFetcher.load("/admin/rag/seo-drafts");
      if (diffOpen && diffPgId === pgId) setDiffOpen(false);
    }
  }

  async function confirmReject() {
    const pgId = rejectItemId;
    setRejectDialogOpen(false);
    try {
      const res = await fetch(`/api/admin/content-refresh/seo-draft/${pgId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.rejected) {
        toast.error(`Erreur: ${data.error || data.message || "Rejet echoue"}`);
      } else {
        toast.success("Brouillon rejete");
      }
    } catch (err) {
      toast.error(
        `Erreur: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      refreshFetcher.load("/admin/rag/seo-drafts");
      if (diffOpen && diffPgId === pgId) setDiffOpen(false);
    }
  }

  // ─── Sort handler ───────────────────────────────

  function handleSort(key: keyof SeoDraft) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(key === "pg_alias" ? "asc" : "desc");
    }
  }

  // ─── Column definitions ─────────────────────────

  const draftColumns: DataColumn<SeoDraft>[] = [
    {
      key: "pg_alias",
      header: "Gamme",
      sortable: true,
      render: (val) => <span className="text-sm font-medium">{val}</span>,
    },
    {
      key: "sg_draft_source",
      header: "Origine",
      render: (val) =>
        val ? (
          <Badge variant="secondary" className="text-xs">
            {String(val)}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
        ),
    },
    {
      key: "quality_score",
      header: "Qualite",
      sortable: true,
      render: (val) => <QualityScoreBadge score={val as number | null} />,
    },
    {
      key: "sg_draft_updated_at",
      header: "Date",
      sortable: true,
      render: (val) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(val as string | null)}
        </span>
      ),
    },
    {
      key: "sg_descrip_draft",
      header: "Meta description",
      render: (val) => {
        const text = val as string | null;
        if (!text)
          return (
            <span className="text-xs text-muted-foreground">{"\u2014"}</span>
          );
        return (
          <div className="space-y-1 max-w-[250px]">
            {text.length > 60 ? (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <span className="cursor-help text-xs text-muted-foreground underline decoration-dotted">
                    {truncate(text, 60)}
                  </span>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <p className="text-xs">{text}</p>
                </HoverCardContent>
              </HoverCard>
            ) : (
              <span className="text-xs text-muted-foreground">{text}</span>
            )}
            <MetaCharCounter text={text} />
          </div>
        );
      },
    },
    {
      key: "sg_content_draft",
      header: "Contenu",
      render: (val) => {
        const text = val as string | null;
        if (!text)
          return <StatusBadge status="NEUTRAL" label="aucun" size="sm" />;
        return (
          <Badge variant="outline" className="text-xs font-mono">
            {text.length} car.
          </Badge>
        );
      },
    },
    {
      key: "pg_id",
      header: "Actions",
      align: "right" as const,
      render: (_val, row) => (
        <DraftActions
          onCompare={() =>
            openDiff(
              row.pg_id,
              row.pg_alias,
              filteredDrafts.indexOf(row as SeoDraft),
            )
          }
          onPublish={() => openPublishDialog(row.pg_id, row.pg_alias)}
          onReject={() => openRejectDialog(row.pg_id, row.pg_alias)}
        />
      ),
    },
  ];

  // ─── Render ──────────────────────────────────────

  return (
    <DashboardShell
      title="Brouillons SEO"
      description="Validez et publiez les textes generes automatiquement pour vos gammes"
      breadcrumb={
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/admin" className="hover:text-foreground">
            Admin
          </Link>
          <span>/</span>
          <Link to="/admin/rag" className="hover:text-foreground">
            RAG
          </Link>
          <span>/</span>
          <span className="text-foreground">Brouillons SEO</span>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshFetcher.load("/admin/rag/seo-drafts")}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshFetcher.state !== "idle" ? "animate-spin" : ""}`}
            />
            Rafraichir
          </Button>
          <Badge variant="secondary" className="gap-1">
            <FilePen className="h-3 w-3" />
            {displayDrafts.length} brouillon
            {displayDrafts.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      }
    >
      {/* Guide */}
      <Alert
        variant="info"
        icon={<Info className="h-4 w-4" />}
        title="Brouillons de texte a valider"
      >
        <AlertDescription>
          Le pipeline a genere de nouveaux textes SEO pour vos gammes. Pour
          chaque brouillon :{" "}
          <strong>
            comparez l&apos;ancien texte avec le nouveau (bouton Comparer)
          </strong>
          , puis <strong>publiez sur le site ou rejetez le brouillon</strong>.
        </AlertDescription>
      </Alert>

      {/* Filters bar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une gamme..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Toutes origines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes origines</SelectItem>
                {uniqueSources.map((src) => (
                  <SelectItem key={src} value={src}>
                    {src}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              {filteredDrafts.length}/{displayDrafts.length} affiche(s)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-medium text-blue-700">
                {selectedIds.size} brouillon(s) selectionne(s)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 gap-1.5"
                  onClick={bulkPublish}
                  disabled={bulkProcessing}
                >
                  {bulkProcessing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Tout publier
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  onClick={bulkReject}
                  disabled={bulkProcessing}
                >
                  {bulkProcessing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Tout rejeter
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  onClick={() => setSelectedIds(new Set())}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Deselectionner
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main table */}
      <AdminDataTable<SeoDraft>
        data={filteredDrafts as SeoDraft[]}
        columns={draftColumns}
        getRowKey={(r) => r.pg_id}
        selectable
        onSelectionChange={setSelectedIds}
        expandable
        renderExpandedRow={(draft) =>
          draft.sg_content_draft ? (
            <ScrollArea className="h-[200px]">
              <pre className="rounded-lg border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap">
                {draft.sg_content_draft}
              </pre>
            </ScrollArea>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Aucun contenu brouillon
            </p>
          )
        }
        sortBy={sortBy}
        sortDirection={sortDir}
        onSort={handleSort}
        emptyMessage={
          displayDrafts.length === 0
            ? "Aucun brouillon en attente de validation"
            : "Aucun resultat pour les filtres actifs"
        }
        emptyState={
          <div className="rounded-lg border bg-muted/30 p-8 text-center">
            <FilePen className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">
              {displayDrafts.length === 0
                ? "Aucun brouillon en attente de validation"
                : "Aucun resultat pour les filtres actifs"}
            </p>
          </div>
        }
        isLoading={refreshFetcher.state !== "idle"}
        toolbar={
          <span className="text-sm font-medium">
            Gammes avec brouillons a valider
          </span>
        }
      />

      {/* Publish confirmation dialog */}
      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publier ce brouillon ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le contenu actuel de <strong>{publishItemAlias}</strong> sera
              remplace par la nouvelle version. Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPublish}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="mr-2 h-4 w-4" />
              Publier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject confirmation dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeter ce brouillon ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le texte propose pour <strong>{rejectItemAlias}</strong> sera
              supprime definitivement. La gamme conservera son contenu actuel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReject}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Rejeter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Comparison Sheet with diff + prev/next */}
      <Sheet open={diffOpen} onOpenChange={setDiffOpen}>
        <SheetContent side="right" className="sm:w-[650px] sm:max-w-[650px]">
          <SheetHeader>
            <div className="flex items-center justify-between pr-8">
              <SheetTitle>{diffAlias}</SheetTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => navigateDiff("prev")}
                  disabled={diffIndex <= 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                  {diffIndex + 1}/{filteredDrafts.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => navigateDiff("next")}
                  disabled={diffIndex >= filteredDrafts.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <SheetDescription>
              Comparaison ancien / nouveau — verifiez les changements avant
              publication
            </SheetDescription>
          </SheetHeader>

          {/* Loading skeleton */}
          {diffLoading ? (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-20 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-20 w-full rounded-md" />
              </div>
            </div>
          ) : diffData ? (
            <ScrollArea className="mt-6 h-[calc(100vh-220px)]">
              <div className="space-y-6 pr-4">
                {/* Description SEO - with diff */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">
                      Description SEO (meta description)
                    </h4>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        Actuel:{" "}
                        <MetaCharCounter text={diffData.current.sg_descrip} />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Nouveau:{" "}
                        <MetaCharCounter
                          text={diffData.draft.sg_descrip_draft}
                        />
                      </span>
                    </div>
                  </div>

                  {/* Diff view */}
                  <div className="rounded-md border p-3">
                    <DiffDisplay
                      oldText={diffData.current.sg_descrip || ""}
                      newText={diffData.draft.sg_descrip_draft || ""}
                    />
                  </div>

                  {/* Side-by-side originals (collapsed) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Badge variant="secondary" className="mb-1 text-xs">
                        Texte actuel
                      </Badge>
                      <div className="rounded-md border bg-muted/30 p-2 text-xs">
                        {diffData.current.sg_descrip || (
                          <span className="italic text-muted-foreground">
                            vide
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <Badge
                        variant="secondary"
                        className="mb-1 bg-blue-50 text-blue-700 text-xs"
                      >
                        Nouveau propose
                      </Badge>
                      <div className="rounded-md border border-blue-200 bg-blue-50/30 p-2 text-xs">
                        {diffData.draft.sg_descrip_draft || (
                          <span className="italic text-muted-foreground">
                            vide
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contenu de la page - with diff */}
                {(diffData.current.sg_content ||
                  diffData.draft.sg_content_draft) && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Contenu de la page</h4>
                    <div className="max-h-[300px] overflow-auto rounded-md border p-3">
                      <DiffDisplay
                        oldText={diffData.current.sg_content || ""}
                        newText={diffData.draft.sg_content_draft || ""}
                      />
                    </div>
                  </div>
                )}

                {/* Informations */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    Origine :{" "}
                    <Badge variant="secondary" className="text-xs">
                      {diffData.draft.sg_draft_source || "N/A"}
                    </Badge>
                  </span>
                  <span>
                    Cree le : {formatDate(diffData.draft.sg_draft_updated_at)}
                  </span>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              Impossible de charger les donnees
            </p>
          )}

          <SheetFooter className="mt-4">
            <Button variant="outline" onClick={() => setDiffOpen(false)}>
              Fermer
            </Button>
            <Button
              variant="destructive"
              onClick={() => openRejectDialog(diffPgId, diffAlias)}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Rejeter
            </Button>
            <Button
              onClick={() => openPublishDialog(diffPgId, diffAlias)}
              className="gap-1.5 bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4" />
              Publier
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </DashboardShell>
  );
}
