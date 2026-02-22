import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import {
  FilePen,
  RefreshCw,
  Check,
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp,
  Info,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DashboardShell } from "~/components/admin/patterns/DashboardShell";
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
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Brouillons SEO - Admin RAG");

interface SeoDraft {
  pg_id: string;
  pg_alias: string;
  sg_descrip: string | null;
  sg_descrip_draft: string | null;
  sg_content_draft: string | null;
  sg_draft_source: string | null;
  sg_draft_updated_at: string | null;
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

export default function AdminRagSeoDrafts() {
  const { drafts } = useLoaderData<typeof loader>();
  const refreshFetcher = useFetcher<typeof loader>();

  // Sheet comparison
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffData, setDiffData] = useState<DraftDetail | null>(null);
  const [diffAlias, setDiffAlias] = useState("");
  const [diffPgId, setDiffPgId] = useState("");

  // AlertDialog states
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishItemId, setPublishItemId] = useState("");
  const [publishItemAlias, setPublishItemAlias] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectItemId, setRejectItemId] = useState("");
  const [rejectItemAlias, setRejectItemAlias] = useState("");

  // Expandable rows
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const displayDrafts = refreshFetcher.data?.drafts ?? drafts;

  async function openDiff(pgId: string, alias: string) {
    setDiffAlias(alias);
    setDiffPgId(pgId);
    setDiffLoading(true);
    setDiffOpen(true);
    setDiffData(null);
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Gammes avec brouillons a valider
          </CardTitle>
        </CardHeader>
        <CardContent>
          {displayDrafts.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-8 text-center">
              <FilePen className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                Aucun brouillon en attente de validation
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gamme</TableHead>
                    <TableHead>Origine</TableHead>
                    <TableHead>Date de creation</TableHead>
                    <TableHead>Nouveau texte propose</TableHead>
                    <TableHead>Apercu</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayDrafts.map((draft) => (
                    <>
                      <TableRow key={draft.pg_id} className="hover:bg-muted/50">
                        <TableCell>
                          <span className="text-sm font-medium">
                            {draft.pg_alias}
                          </span>
                        </TableCell>
                        <TableCell>
                          {draft.sg_draft_source ? (
                            <Badge variant="secondary" className="text-xs">
                              {draft.sg_draft_source}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {"\u2014"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(draft.sg_draft_updated_at)}
                        </TableCell>
                        {/* S7: HoverCard on truncated description */}
                        <TableCell className="max-w-[200px]">
                          {draft.sg_descrip_draft &&
                          draft.sg_descrip_draft.length > 60 ? (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <span className="cursor-help text-xs text-muted-foreground underline decoration-dotted">
                                  {truncate(draft.sg_descrip_draft, 60)}
                                </span>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80">
                                <p className="text-xs">
                                  {draft.sg_descrip_draft}
                                </p>
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {truncate(draft.sg_descrip_draft, 60)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {draft.sg_content_draft ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() =>
                                setExpandedRow(
                                  expandedRow === draft.pg_id
                                    ? null
                                    : draft.pg_id,
                                )
                              }
                            >
                              {expandedRow === draft.pg_id ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                              {draft.sg_content_draft.length} car.
                            </Button>
                          ) : (
                            <StatusBadge
                              status="NEUTRAL"
                              label="aucun"
                              size="sm"
                            />
                          )}
                        </TableCell>
                        {/* S8: DropdownMenu for row actions */}
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  openDiff(draft.pg_id, draft.pg_alias)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Comparer
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-green-700"
                                onClick={() =>
                                  openPublishDialog(draft.pg_id, draft.pg_alias)
                                }
                              >
                                <Check className="mr-2 h-4 w-4" />
                                Publier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-700"
                                onClick={() =>
                                  openRejectDialog(draft.pg_id, draft.pg_alias)
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Rejeter
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {/* S6: ScrollArea in expanded content */}
                      {expandedRow === draft.pg_id &&
                        draft.sg_content_draft && (
                          <TableRow key={`${draft.pg_id}-expanded`}>
                            <TableCell colSpan={6}>
                              <ScrollArea className="h-[200px]">
                                <pre className="rounded-lg border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap">
                                  {draft.sg_content_draft}
                                </pre>
                              </ScrollArea>
                            </TableCell>
                          </TableRow>
                        )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* S1: AlertDialog for publish confirmation */}
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

      {/* S2: AlertDialog for reject confirmation */}
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

      {/* S4: Sheet for comparison (replaces Dialog) */}
      <Sheet open={diffOpen} onOpenChange={setDiffOpen}>
        <SheetContent side="right" className="sm:w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>{diffAlias}</SheetTitle>
            <SheetDescription>
              Comparaison ancien / nouveau — verifiez les changements avant
              publication
            </SheetDescription>
          </SheetHeader>

          {/* S5: Skeleton during loading */}
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
                {/* Description SEO */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">
                    Description SEO (meta description)
                  </h4>
                  <div>
                    <Badge variant="secondary" className="mb-1 text-xs">
                      Texte actuel
                    </Badge>
                    <div className="rounded-md border bg-muted/30 p-3 text-xs">
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
                      Nouveau texte propose
                    </Badge>
                    <div className="rounded-md border border-blue-200 bg-blue-50/30 p-3 text-xs">
                      {diffData.draft.sg_descrip_draft || (
                        <span className="italic text-muted-foreground">
                          vide
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contenu de la page */}
                {(diffData.current.sg_content ||
                  diffData.draft.sg_content_draft) && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Contenu de la page</h4>
                    <div>
                      <Badge variant="secondary" className="mb-1 text-xs">
                        Texte actuel
                      </Badge>
                      <pre className="max-h-[250px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap">
                        {diffData.current.sg_content || (
                          <span className="italic text-muted-foreground">
                            vide
                          </span>
                        )}
                      </pre>
                    </div>
                    <div>
                      <Badge
                        variant="secondary"
                        className="mb-1 bg-blue-50 text-blue-700 text-xs"
                      >
                        Nouveau texte propose
                      </Badge>
                      <pre className="max-h-[250px] overflow-auto rounded-md border border-blue-200 bg-blue-50/30 p-3 text-xs font-mono whitespace-pre-wrap">
                        {diffData.draft.sg_content_draft || (
                          <span className="italic text-muted-foreground">
                            vide
                          </span>
                        )}
                      </pre>
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
