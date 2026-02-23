import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { Link2, ExternalLink, TrendingUp } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "";
    const min_da = url.searchParams.get("min_da") || "";
    const page = url.searchParams.get("page") || "1";

    const params = new URLSearchParams({ page, limit: "20" });
    if (status) params.set("status", status);
    if (min_da) params.set("min_da", min_da);

    const [backlinksRes, statsRes] = await Promise.all([
      fetch(
        getInternalApiUrlFromRequest(
          `/api/admin/marketing/backlinks?${params}`,
          request,
        ),
        {
          headers: { Cookie: request.headers.get("Cookie") || "" },
        },
      ),
      fetch(
        getInternalApiUrlFromRequest(
          "/api/admin/marketing/backlinks/stats",
          request,
        ),
        {
          headers: { Cookie: request.headers.get("Cookie") || "" },
        },
      ),
    ]);

    if (!backlinksRes.ok || !statsRes.ok) {
      return json({
        backlinks: [],
        stats: null,
        total: 0,
        page: 1,
        totalPages: 0,
        error: "Failed to load",
      });
    }

    const backlinksData = await backlinksRes.json();
    const statsData = await statsRes.json();

    return json({
      backlinks: backlinksData.data || [],
      stats: statsData.data,
      total: backlinksData.total || 0,
      page: parseInt(page),
      totalPages: backlinksData.totalPages || 0,
      error: null,
    });
  } catch (e: any) {
    return json({
      backlinks: [],
      stats: null,
      total: 0,
      page: 1,
      totalPages: 0,
      error: e.message,
    });
  }
}

export default function BacklinksPage() {
  const { backlinks, stats, total, page, totalPages, error } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusOptions = [
    { value: "", label: "Tous" },
    { value: "live", label: "Live" },
    { value: "pending", label: "En attente" },
    { value: "lost", label: "Perdus" },
    { value: "broken", label: "Cassés" },
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

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-red-500">Erreur: {error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">{stats.live} live</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Domaines uniques
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uniqueDomains}</div>
              <p className="text-xs text-muted-foreground">Diversité</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                DA 30+
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.da30plus}</div>
              <p className="text-xs text-muted-foreground">Haute autorité</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Statuts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-xs">
                <div>Perdus: {stats.lost}</div>
                <div>Cassés: {stats.broken}</div>
                <div>Attente: {stats.pending}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Backlinks ({total})</CardTitle>
            <div className="flex gap-2">
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium">Target</th>
                  <th className="pb-2 font-medium">Anchor</th>
                  <th className="pb-2 font-medium">DA</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {backlinks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Aucun backlink trouvé
                    </td>
                  </tr>
                ) : (
                  backlinks.map((bl: any) => (
                    <tr key={bl.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-gray-400" />
                          <div>
                            <a
                              href={bl.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              {bl.source_domain}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            {bl.source_category && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {bl.source_category}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <a
                          href={bl.target_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1 text-xs"
                        >
                          {bl.target_url.substring(0, 40)}...
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="py-3">
                        {bl.anchor_text ? (
                          <div>
                            <div className="text-sm">
                              {bl.anchor_text.substring(0, 30)}
                            </div>
                            {bl.anchor_type && (
                              <Badge
                                variant="secondary"
                                className="mt-1 text-xs"
                              >
                                {bl.anchor_type}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        {bl.da_score ? (
                          <div className="flex items-center gap-1">
                            <TrendingUp
                              className={`h-4 w-4 ${bl.da_score >= 30 ? "text-green-600" : "text-gray-400"}`}
                            />
                            <span
                              className={
                                bl.da_score >= 30 ? "font-semibold" : ""
                              }
                            >
                              {bl.da_score}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={
                            bl.link_type === "dofollow"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {bl.link_type}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={
                            bl.status === "live"
                              ? "default"
                              : bl.status === "pending"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {bl.status}
                        </Badge>
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
                  Précédent
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
    </div>
  );
}
