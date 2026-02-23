import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Film, CheckCircle, Clock, AlertTriangle, Archive } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getInternalApiUrl } from "~/utils/internal-api.server";

interface DashboardStats {
  total: number;
  byStatus: Record<string, number>;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    const res = await fetch(`${backendUrl}/api/admin/video/dashboard`, {
      headers: { Cookie: cookieHeader },
    });

    if (!res.ok) return json({ stats: null });

    const data = await res.json();
    return json({ stats: data.data as DashboardStats | null });
  } catch {
    return json({ stats: null });
  }
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof Film }
> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: Clock },
  pending_review: {
    label: "En review",
    color: "bg-blue-100 text-blue-700",
    icon: Clock,
  },
  script_approved: {
    label: "Script OK",
    color: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle,
  },
  storyboard: {
    label: "Storyboard",
    color: "bg-purple-100 text-purple-700",
    icon: Film,
  },
  rendering: {
    label: "Rendu",
    color: "bg-amber-100 text-amber-700",
    icon: Film,
  },
  qa: {
    label: "QA",
    color: "bg-orange-100 text-orange-700",
    icon: AlertTriangle,
  },
  qa_failed: {
    label: "QA Echoue",
    color: "bg-red-100 text-red-700",
    icon: AlertTriangle,
  },
  ready_for_publish: {
    label: "Pret",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  published: {
    label: "Publie",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  archived: {
    label: "Archive",
    color: "bg-slate-100 text-slate-600",
    icon: Archive,
  },
};

export default function VideoHubDashboard() {
  const { stats } = useLoaderData<typeof loader>();

  if (!stats) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Video Dashboard</h2>
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Aucune production video pour le moment.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Video Dashboard</h2>
        <Badge variant="outline" className="text-sm">
          {stats.total} production{stats.total !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const count = stats.byStatus[key] ?? 0;
          const Icon = config.icon;
          return (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {config.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                {count > 0 && (
                  <Badge className={`mt-1 ${config.color}`}>
                    {((count / stats.total) * 100).toFixed(0)}%
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Gouvernance Video P1</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <p>7 gates de gouvernance (G1-G7) — 2 STRICT (Safety, Visual Role)</p>
          <p>5 artefacts obligatoires par production (NO-GO sans les 5)</p>
          <p>3 modes : socle (7-9min), gamme (3-6min), short (15-60s)</p>
        </CardContent>
      </Card>
    </div>
  );
}
