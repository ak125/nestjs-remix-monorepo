/**
 * 📊 SEO HUB — CWV Runtime Observability (Bloc 6)
 *
 * Dashboard runtime CWV (RUM) + funnel correlation. Source : `__seo_cwv_daily_rum`
 * (agg journalier) + `__seo_cwv_raw` (corrélation 48h pour funnel).
 *
 * V1 minimal : table view (pas Recharts). Itérations V1.1 si owner confirme valeur.
 *
 * Refs:
 *  - Plan CWV Runtime Observability bloc 6 (final)
 *  - Backend : @repo/cwv-taxonomy + cwv-dashboard.controller.ts
 *  - Migrations : 20260526 (raw), 20260527 (agg), 20260528 (runtime), 20260529 (RPCs)
 */
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

interface CwvDashboardRow {
  priority_tier: string;
  surface: string;
  route_group: string;
  device: string;
  metric: string;
  sample_total: number;
  p75_avg: number | null;
  days_observed: number;
}

interface CwvFunnelRow {
  inp_bucket: "fast" | "medium" | "slow";
  sessions: number;
  conversion_count: number;
  conversion_rate: number | null;
}

interface CwvHealth {
  last_beacon_at: string | null;
  last_aggregation_hourly_at: string | null;
  last_aggregation_daily_at: string | null;
  samples_last_24h: number;
  partitions_ok: boolean;
  cron_jobs_count: number;
}

interface LoaderData {
  dashboard: { rows: CwvDashboardRow[]; from: string; to: string };
  funnel: { rows: CwvFunnelRow[]; from_ts: string; to_ts: string };
  health: CwvHealth;
  priorityTier: string | null;
  apiError: string | null;
}

export const meta: MetaFunction = () => [
  { title: "CWV Runtime Observability — Admin" },
  {
    name: "description",
    content: "Dashboard CWV runtime + funnel correlation (RUM, bloc 6).",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const priorityTier = url.searchParams.get("priority_tier");

  const apiBase = process.env.INTERNAL_API_BASE_URL ?? "http://localhost:3000";

  // 3 fetches en parallèle. En cas d'erreur, on tombe en empty state.
  const cookie = request.headers.get("cookie") ?? "";
  const fetchOpts: RequestInit = {
    headers: { cookie },
    signal: AbortSignal.timeout(10_000),
  };

  let dashboard: LoaderData["dashboard"] = {
    rows: [],
    from: "",
    to: "",
  };
  let funnel: LoaderData["funnel"] = {
    rows: [],
    from_ts: "",
    to_ts: "",
  };
  let health: CwvHealth = {
    last_beacon_at: null,
    last_aggregation_hourly_at: null,
    last_aggregation_daily_at: null,
    samples_last_24h: 0,
    partitions_ok: false,
    cron_jobs_count: 0,
  };
  let apiError: string | null = null;

  try {
    const dashUrl = new URL("/api/seo/cwv/dashboard", apiBase);
    if (priorityTier) dashUrl.searchParams.set("priority_tier", priorityTier);
    const [dashResp, funnelResp, healthResp] = await Promise.all([
      fetch(dashUrl, fetchOpts),
      fetch(new URL("/api/seo/cwv/funnel-correlation", apiBase), fetchOpts),
      fetch(new URL("/api/seo/cwv/health", apiBase), fetchOpts),
    ]);

    if (dashResp.ok) {
      dashboard = (await dashResp.json()) as LoaderData["dashboard"];
    }
    if (funnelResp.ok) {
      funnel = (await funnelResp.json()) as LoaderData["funnel"];
    }
    if (healthResp.ok) {
      health = (await healthResp.json()) as CwvHealth;
    }

    if (!dashResp.ok || !funnelResp.ok || !healthResp.ok) {
      apiError = `Partial fetch error: dashboard=${dashResp.status} funnel=${funnelResp.status} health=${healthResp.status}`;
    }
  } catch (err) {
    apiError = err instanceof Error ? err.message : "Unknown fetch error";
  }

  return json<LoaderData>({
    dashboard,
    funnel,
    health,
    priorityTier,
    apiError,
  });
};

function formatMs(value: number | null, metric: string): string {
  if (value === null) return "—";
  if (metric === "CLS") return value.toFixed(3);
  return `${Math.round(value)} ms`;
}

function tierBadgeVariant(
  tier: string,
): "destructive" | "default" | "secondary" {
  if (tier === "CWV_P0") return "destructive";
  if (tier === "CWV_P1") return "default";
  return "secondary";
}

function metricRating(metric: string, value: number | null): string {
  if (value === null) return "—";
  if (metric === "INP") {
    if (value <= 200) return "good";
    if (value <= 500) return "needs-improvement";
    return "poor";
  }
  if (metric === "LCP") {
    if (value <= 2500) return "good";
    if (value <= 4000) return "needs-improvement";
    return "poor";
  }
  if (metric === "CLS") {
    if (value <= 0.1) return "good";
    if (value <= 0.25) return "needs-improvement";
    return "poor";
  }
  return "—";
}

export default function CwvRuntimeObservability() {
  const data = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const currentTier = searchParams.get("priority_tier") ?? "all";

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">CWV Runtime Observability</h1>
        <p className="text-muted-foreground">
          Field RUM Web Vitals + funnel correlation. Bloc 6 / 6 — V1 minimal
          (table view).
        </p>
      </header>

      {data.apiError ? (
        <Alert variant="destructive">
          <AlertTitle>API partial error</AlertTitle>
          <AlertDescription>{data.apiError}</AlertDescription>
        </Alert>
      ) : null}

      {/* Health */}
      <Card>
        <CardHeader>
          <CardTitle>Health</CardTitle>
          <CardDescription>
            Indicateurs ingestion + agg + samples 24h.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Last beacon</dt>
              <dd className="font-medium">
                {data.health.last_beacon_at
                  ? new Date(data.health.last_beacon_at).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last hourly agg</dt>
              <dd className="font-medium">
                {data.health.last_aggregation_hourly_at
                  ? new Date(
                      data.health.last_aggregation_hourly_at,
                    ).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last daily agg</dt>
              <dd className="font-medium">
                {data.health.last_aggregation_daily_at
                  ? new Date(
                      data.health.last_aggregation_daily_at,
                    ).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Samples 24h</dt>
              <dd className="font-medium">
                {data.health.samples_last_24h.toLocaleString()}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle>
            Dashboard ({data.dashboard.from} → {data.dashboard.to})
          </CardTitle>
          <CardDescription>
            p75 weighted by sample_count. ua_class=human only. Filtre tier
            actuel : <Badge variant="outline">{currentTier}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.dashboard.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune donnée. Vérifier que le beacon `/api/seo/cwv/beacon` reçoit
              du trafic et que les jobs hourly/daily tournent.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead>Surface</TableHead>
                  <TableHead>Route group</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Samples</TableHead>
                  <TableHead className="text-right">p75</TableHead>
                  <TableHead>Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dashboard.rows.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant={tierBadgeVariant(row.priority_tier)}>
                        {row.priority_tier}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.surface}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.route_group}
                    </TableCell>
                    <TableCell>{row.device}</TableCell>
                    <TableCell className="font-mono">{row.metric}</TableCell>
                    <TableCell className="text-right">
                      {row.sample_total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMs(row.p75_avg, row.metric)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {metricRating(row.metric, row.p75_avg)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Funnel correlation */}
      <Card>
        <CardHeader>
          <CardTitle>Funnel correlation — INP × conversion</CardTitle>
          <CardDescription>
            Sessions bucketées par INP moyen sur view_*. Fenêtre :{" "}
            {data.funnel.from_ts} → {data.funnel.to_ts} (raw TTL 48h).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.funnel.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune session — corrélation indisponible.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>INP bucket</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.funnel.rows.map((row) => (
                  <TableRow key={row.inp_bucket}>
                    <TableCell>
                      <Badge
                        variant={
                          row.inp_bucket === "fast"
                            ? "default"
                            : row.inp_bucket === "medium"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {row.inp_bucket}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.sessions.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.conversion_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.conversion_rate !== null
                        ? `${(row.conversion_rate * 100).toFixed(2)}%`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
