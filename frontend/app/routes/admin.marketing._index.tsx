import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Link2, TrendingUp, FileText, Target } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const res = await fetch(
      getInternalApiUrlFromRequest("/api/admin/marketing/dashboard", request),
      {
        headers: { Cookie: request.headers.get("Cookie") || "" },
      },
    );
    if (!res.ok) return json({ dashboard: null, error: "Failed to load" });
    const result = await res.json();
    return json({ dashboard: result.data, error: null });
  } catch (e: any) {
    return json({ dashboard: null, error: e.message });
  }
}

export default function MarketingDashboard() {
  const { dashboard, error } = useLoaderData<typeof loader>();

  if (error || !dashboard) {
    return (
      <Card className="p-6">
        <p className="text-red-500">
          Erreur: {error || "Données non disponibles"}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Le module marketing est en cours de configuration.
        </p>
      </Card>
    );
  }

  const kpis = [
    {
      label: "Backlinks totaux",
      value: dashboard.backlinks?.total || 0,
      icon: Link2,
      color: "text-blue-600",
      sub: `${dashboard.backlinks?.live || 0} live`,
    },
    {
      label: "Domaines référents",
      value: dashboard.backlinks?.uniqueDomains || 0,
      icon: TrendingUp,
      color: "text-green-600",
      sub: `${dashboard.backlinks?.da30plus || 0} DA30+`,
    },
    {
      label: "Contenu planifié",
      value: dashboard.content?.total || 0,
      icon: FileText,
      color: "text-purple-600",
      sub: `${dashboard.content?.published || 0} publiés`,
    },
    {
      label: "Campagnes actives",
      value: dashboard.campaigns?.active || 0,
      icon: Target,
      color: "text-orange-600",
      sub: `${dashboard.campaigns?.total || 0} total`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </CardTitle>
                <Icon className={`h-5 w-5 ${kpi.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {kpi.value.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">{kpi.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {dashboard.outreach && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Outreach</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Badge variant="outline">{dashboard.outreach.sent} envoyés</Badge>
              <Badge variant="secondary">
                {dashboard.outreach.accepted} acceptés
              </Badge>
              <Badge>{dashboard.outreach.responseRate}% taux de réponse</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
