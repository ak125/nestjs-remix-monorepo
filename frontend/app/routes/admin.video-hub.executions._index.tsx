import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams, Form } from "@remix-run/react";
import {
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Layers,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { getInternalApiUrl } from "~/utils/internal-api.server";

interface Execution {
  id: number;
  briefId: string;
  videoType: string;
  vertical: string;
  status: string;
  engineName: string | null;
  durationMs: number | null;
  attemptNumber: number;
  renderErrorCode: string | null;
  retryable: boolean;
  isCanary: boolean;
  batchId: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const STATUSES = [
  { value: "all", label: "Tous" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const url = new URL(request.url);

  const page = url.searchParams.get("page") || "1";
  const status = url.searchParams.get("status") || "";
  const briefId = url.searchParams.get("briefId") || "";
  const limit = "20";

  const params = new URLSearchParams({ page, limit });
  if (status && status !== "all") params.set("status", status);
  if (briefId) params.set("briefId", briefId);

  try {
    const res = await fetch(
      `${backendUrl}/api/admin/video/executions?${params.toString()}`,
      { headers: { Cookie: cookieHeader } },
    );

    if (!res.ok) {
      return json({ executions: [], total: 0, error: "Erreur chargement" });
    }

    const data = await res.json();
    return json({
      executions: (data.data ?? []) as Execution[],
      total: (data.total ?? 0) as number,
      error: null,
    });
  } catch {
    return json({ executions: [], total: 0, error: "Erreur reseau" });
  }
}

export default function ExecutionsIndex() {
  const { executions, total, error } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const currentStatus = searchParams.get("status") || "all";
  const currentBriefId = searchParams.get("briefId") || "";
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-gray-700" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Executions</h2>
            <p className="text-sm text-gray-500">
              {total} execution{total !== 1 ? "s" : ""} au total
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <Form method="get" className="flex items-end gap-4">
            <div className="flex-1">
              <label
                htmlFor="briefId"
                className="block text-xs font-medium text-gray-500 mb-1"
              >
                Brief ID
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="briefId"
                  name="briefId"
                  placeholder="Filtrer par brief ID..."
                  defaultValue={currentBriefId}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-44">
              <label
                htmlFor="status"
                className="block text-xs font-medium text-gray-500 mb-1"
              >
                Status
              </label>
              <Select name="status" defaultValue={currentStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="outline" size="sm">
              Filtrer
            </Button>
          </Form>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {executions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                    <th className="p-3">#</th>
                    <th className="p-3">Brief ID</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Engine</th>
                    <th className="p-3">Duree</th>
                    <th className="p-3">Attempt</th>
                    <th className="p-3">Date</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((exec) => (
                    <tr
                      key={exec.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="p-3 font-mono text-gray-600">{exec.id}</td>
                      <td className="p-3">
                        <Link
                          to={`/admin/video-hub/productions/${exec.briefId}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {exec.briefId}
                        </Link>
                        {exec.batchId && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-xs text-purple-600 border-purple-200"
                          >
                            <Layers className="h-3 w-3 mr-1" />
                            batch
                          </Badge>
                        )}
                        {exec.isCanary && (
                          <Badge
                            variant="outline"
                            className="ml-1 text-xs text-amber-600 border-amber-200"
                          >
                            canary
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 capitalize text-gray-600">
                        {exec.videoType.replace("_", " ")}
                      </td>
                      <td className="p-3">
                        <Badge
                          className={`text-xs ${STATUS_BADGE[exec.status] ?? STATUS_BADGE.pending}`}
                        >
                          {exec.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-gray-600">
                        {exec.engineName ?? "—"}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {formatDuration(exec.durationMs)}
                      </td>
                      <td className="p-3 text-center">#{exec.attemptNumber}</td>
                      <td className="p-3 text-xs text-gray-500">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {new Date(exec.createdAt).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3">
                        <Link
                          to={`/admin/video-hub/executions/${exec.id}`}
                          className="text-gray-400 hover:text-gray-700"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Aucune execution trouvee.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {currentPage} sur {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              asChild={currentPage > 1}
            >
              {currentPage > 1 ? (
                <Link
                  to={`?page=${currentPage - 1}&status=${currentStatus}&briefId=${currentBriefId}`}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> Precedent
                </Link>
              ) : (
                <span className="gap-1">
                  <ChevronLeft className="h-4 w-4" /> Precedent
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              asChild={currentPage < totalPages}
            >
              {currentPage < totalPages ? (
                <Link
                  to={`?page=${currentPage + 1}&status=${currentStatus}&briefId=${currentBriefId}`}
                  className="gap-1"
                >
                  Suivant <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className="gap-1">
                  Suivant <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
