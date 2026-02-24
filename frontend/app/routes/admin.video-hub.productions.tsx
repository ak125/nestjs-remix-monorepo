import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useSearchParams,
  Form,
  useFetcher,
} from "@remix-run/react";
import {
  Film,
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { getInternalApiUrl } from "~/utils/internal-api.server";

interface Production {
  id: number;
  briefId: string;
  videoType: string;
  vertical: string;
  status: string;
  qualityScore: number | null;
  createdAt: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const url = new URL(request.url);
  const page = url.searchParams.get("page") || "1";
  const status = url.searchParams.get("status") || "";
  const vertical = url.searchParams.get("vertical") || "";
  const search = url.searchParams.get("search") || "";

  try {
    const params = new URLSearchParams({ page, limit: "20" });
    if (status) params.set("status", status);
    if (vertical) params.set("vertical", vertical);
    if (search) params.set("search", search);

    const res = await fetch(
      `${backendUrl}/api/admin/video/productions?${params}`,
      { headers: { Cookie: cookieHeader } },
    );

    if (!res.ok)
      return json({
        productions: [],
        total: 0,
        currentPage: 1,
        currentSearch: "",
      });

    const data = await res.json();
    return json({
      productions: (data.data ?? []) as Production[],
      total: data.total ?? 0,
      currentPage: parseInt(page, 10),
      currentSearch: search,
    });
  } catch {
    return json({
      productions: [],
      total: 0,
      currentPage: 1,
      currentSearch: "",
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const formData = await request.formData();

  const body = {
    briefId: formData.get("briefId") as string,
    videoType: formData.get("videoType") as string,
    vertical: formData.get("vertical") as string,
    gammeAlias: (formData.get("gammeAlias") as string) || undefined,
    templateId: (formData.get("templateId") as string) || undefined,
    createdBy: "admin",
  };

  try {
    const res = await fetch(`${backendUrl}/api/admin/video/productions`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return json({
        ok: false,
        error: data.error ?? data.message ?? "Erreur creation",
      });
    }
    return json({ ok: true, briefId: data.data?.briefId ?? null });
  } catch {
    return json({ ok: false, error: "Erreur reseau" });
  }
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_review: "bg-blue-100 text-blue-700",
  script_approved: "bg-emerald-100 text-emerald-700",
  storyboard: "bg-purple-100 text-purple-700",
  rendering: "bg-amber-100 text-amber-700",
  qa: "bg-orange-100 text-orange-700",
  qa_failed: "bg-red-100 text-red-700",
  ready_for_publish: "bg-green-100 text-green-700",
  published: "bg-green-200 text-green-800",
  archived: "bg-slate-100 text-slate-600",
};

const TYPE_LABEL: Record<string, string> = {
  film_socle: "Socle",
  film_gamme: "Gamme",
  short: "Short",
};

function buildPageUrl(currentParams: URLSearchParams, page: number): string {
  const next = new URLSearchParams(currentParams.toString());
  next.set("page", String(page));
  return `?${next}`;
}

export default function VideoHubProductions() {
  const { productions, total, currentPage, currentSearch } =
    useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const currentStatus = searchParams.get("status") || "";

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const createFetcher = useFetcher<{
    ok: boolean;
    error?: string;
    briefId?: string | null;
  }>();

  useEffect(() => {
    if (createFetcher.data?.ok === true) {
      setCreateOpen(false);
    }
  }, [createFetcher.data]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Productions</h2>
        <div className="flex items-center gap-3">
          <Badge variant="outline">{total} total</Badge>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Nouvelle production
          </Button>
        </div>
      </div>

      {/* Create feedback */}
      {createFetcher.data?.ok === true && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-center justify-between">
          <span>Production creee avec succes.</span>
          {createFetcher.data.briefId && (
            <Link
              to={`/admin/video-hub/productions/${createFetcher.data.briefId}`}
              className="text-green-800 font-medium underline"
            >
              Voir {createFetcher.data.briefId}
            </Link>
          )}
        </div>
      )}
      {createFetcher.data?.ok === false && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {createFetcher.data.error ?? "Erreur inconnue"}
        </div>
      )}

      {/* Search */}
      <Form method="get" className="flex gap-2 max-w-md">
        {currentStatus && (
          <input type="hidden" name="status" value={currentStatus} />
        )}
        <Input
          name="search"
          defaultValue={currentSearch}
          placeholder="Rechercher par brief ID..."
          className="h-9 text-sm"
        />
        <Button type="submit" size="sm" variant="outline">
          <Search className="h-4 w-4" />
        </Button>
      </Form>

      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap">
        {["", "draft", "qa", "published", "qa_failed", "archived"].map((s) => {
          const params = new URLSearchParams();
          if (s) params.set("status", s);
          if (currentSearch) params.set("search", currentSearch);
          return (
            <Link key={s} to={`?${params}`} className="inline-block">
              <Badge
                variant={currentStatus === s ? "default" : "outline"}
                className="cursor-pointer"
              >
                {s || "Tous"}
              </Badge>
            </Link>
          );
        })}
      </div>

      {/* Table */}
      {productions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Film className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            Aucune production trouvee.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Brief ID
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Vertical
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Score
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Date
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {productions.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{p.briefId}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">
                        {TYPE_LABEL[p.videoType] ?? p.videoType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 capitalize">{p.vertical}</td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-700"
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {p.qualityScore != null ? (
                        <span
                          className={
                            p.qualityScore >= 80
                              ? "text-green-600 font-medium"
                              : p.qualityScore >= 50
                                ? "text-amber-600 font-medium"
                                : "text-red-600 font-medium"
                          }
                        >
                          {p.qualityScore}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(p.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/video-hub/productions/${p.briefId}`}>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {(currentPage - 1) * 20 + 1}–{Math.min(currentPage * 20, total)} sur{" "}
            {total}
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link to={buildPageUrl(searchParams, currentPage - 1)}>
                <Button variant="outline" size="sm" className="gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Precedent
                </Button>
              </Link>
            )}
            {currentPage < totalPages && (
              <Link to={buildPageUrl(searchParams, currentPage + 1)}>
                <Button variant="outline" size="sm" className="gap-1">
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Create Production Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle production</DialogTitle>
          </DialogHeader>
          <createFetcher.Form method="post" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="briefId">Brief ID *</Label>
              <Input
                id="briefId"
                name="briefId"
                placeholder="freinage-socle-2026-q1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="videoType">Type video *</Label>
              <Select name="videoType" required defaultValue="short">
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="film_gamme">Film Gamme</SelectItem>
                  <SelectItem value="film_socle">Film Socle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vertical">Vertical *</Label>
              <Input
                id="vertical"
                name="vertical"
                placeholder="freinage"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gammeAlias">Gamme alias (optionnel)</Label>
              <Input
                id="gammeAlias"
                name="gammeAlias"
                placeholder="disque-de-frein"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateId">Template ID (optionnel)</Label>
              <Input
                id="templateId"
                name="templateId"
                placeholder="short-product-highlight"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createFetcher.state !== "idle"}
                className="gap-1"
              >
                {createFetcher.state !== "idle" && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Creer
              </Button>
            </DialogFooter>
          </createFetcher.Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
