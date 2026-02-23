import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { Film, ExternalLink } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
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

  try {
    const params = new URLSearchParams({ page, limit: "20" });
    if (status) params.set("status", status);
    if (vertical) params.set("vertical", vertical);

    const res = await fetch(
      `${backendUrl}/api/admin/video/productions?${params}`,
      { headers: { Cookie: cookieHeader } },
    );

    if (!res.ok) return json({ productions: [], total: 0 });

    const data = await res.json();
    return json({
      productions: (data.data ?? []) as Production[],
      total: data.total ?? 0,
    });
  } catch {
    return json({ productions: [], total: 0 });
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

export default function VideoHubProductions() {
  const { productions, total } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const currentStatus = searchParams.get("status") || "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Productions</h2>
        <Badge variant="outline">{total} total</Badge>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["", "draft", "qa", "published", "qa_failed", "archived"].map((s) => (
          <Link key={s} to={s ? `?status=${s}` : "?"} className="inline-block">
            <Badge
              variant={currentStatus === s ? "default" : "outline"}
              className="cursor-pointer"
            >
              {s || "Tous"}
            </Badge>
          </Link>
        ))}
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
    </div>
  );
}
