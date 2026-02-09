import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { Map, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getInternalApiUrl } from "~/utils/internal-api.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "";
    const content_type = url.searchParams.get("content_type") || "";
    const page = url.searchParams.get("page") || "1";

    const params = new URLSearchParams({ page, limit: "20" });
    if (status) params.set("status", status);
    if (content_type) params.set("content_type", content_type);

    const [roadmapRes, coverageRes] = await Promise.all([
      fetch(
        getInternalApiUrl(`/api/admin/marketing/content-roadmap?${params}`),
        {
          headers: { Cookie: request.headers.get("Cookie") || "" },
        },
      ),
      fetch(
        getInternalApiUrl("/api/admin/marketing/content-roadmap/coverage"),
        {
          headers: { Cookie: request.headers.get("Cookie") || "" },
        },
      ),
    ]);

    if (!roadmapRes.ok || !coverageRes.ok) {
      return json({
        roadmap: [],
        coverage: null,
        total: 0,
        page: 1,
        totalPages: 0,
        error: "Failed to load",
      });
    }

    const roadmapData = await roadmapRes.json();
    const coverageData = await coverageRes.json();

    return json({
      roadmap: roadmapData.data || [],
      coverage: coverageData.data,
      total: roadmapData.total || 0,
      page: parseInt(page),
      totalPages: roadmapData.totalPages || 0,
      error: null,
    });
  } catch (e: any) {
    return json({
      roadmap: [],
      coverage: null,
      total: 0,
      page: 1,
      totalPages: 0,
      error: e.message,
    });
  }
}

export default function ContentRoadmapPage() {
  const { roadmap, coverage, total, page, totalPages, error } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusOptions = [
    { value: "", label: "Tous" },
    { value: "planned", label: "Planifié" },
    { value: "writing", label: "En cours" },
    { value: "review", label: "Relecture" },
    { value: "published", label: "Publié" },
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
      {coverage && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Couverture
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{coverage.coverage_pct}%</div>
              <p className="text-xs text-muted-foreground">
                {coverage.total_gammes} gammes
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Conseils
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {coverage.gammes_with_advice}
              </div>
              <p className="text-xs text-muted-foreground">
                gammes avec conseil
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Références
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {coverage.gammes_with_reference}
              </div>
              <p className="text-xs text-muted-foreground">pages référence</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Diagnostics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {coverage.gammes_with_diagnostic}
              </div>
              <p className="text-xs text-muted-foreground">gammes avec diag</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Roadmap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {coverage.gammes_with_roadmap}
              </div>
              <p className="text-xs text-muted-foreground">en planification</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Content Roadmap ({total})</CardTitle>
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
                  <th className="pb-2 font-medium">Titre</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Priorité</th>
                  <th className="pb-2 font-medium">Statut</th>
                  <th className="pb-2 font-medium">Mots estimés</th>
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
                      Aucun contenu planifié
                    </td>
                  </tr>
                ) : (
                  roadmap.map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Map className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{item.title}</div>
                            {item.target_family && (
                              <Badge variant="outline" className="mt-1 text-xs">
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
                        {item.estimated_words.toLocaleString()}
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

      {coverage && coverage.gaps && coverage.gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Lacunes de contenu ({coverage.gaps.length} gammes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {coverage.gaps.slice(0, 10).map((gap: any) => (
                <div
                  key={gap.pg_id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div>
                    <span className="font-medium">{gap.pg_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({gap.pg_alias})
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {!gap.has_advice && (
                      <Badge variant="destructive">Pas de conseil</Badge>
                    )}
                    {!gap.has_reference && (
                      <Badge variant="destructive">Pas de référence</Badge>
                    )}
                    {!gap.has_diagnostic && (
                      <Badge variant="destructive">Pas de diagnostic</Badge>
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
    </div>
  );
}
