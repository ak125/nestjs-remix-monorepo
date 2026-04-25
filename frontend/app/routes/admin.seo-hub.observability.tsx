/**
 * 📊 SEO HUB — OBSERVABILITY (Phase 1c)
 *
 * Dashboard timeseries unifié des sources Google :
 *  - GSC : positions, clicks, impressions, CTR sur 90 jours
 *  - GA4 : sessions, conversions, bounce rate
 *  - CWV : Core Web Vitals (LCP, CLS, INP) sur sample top pages
 *  - Runs : audit trail des fetchers (event_log)
 *
 * Consomme les endpoints du module backend `seo-monitoring` (Phase 1a, PR #170).
 *
 * État vide gracieux : si credentials Google manquantes ou aucune ingestion
 * encore exécutée, affiche message "Configurer Service Account dans runbook"
 * sans crash.
 *
 * Refs:
 * - ADR-025 (vault) : architecture département SEO
 * - .spec/runbooks/seo/observability-setup.md : procédure setup SA
 * - PR #166 : recharts ^2.15.4 ajouté en Phase 0
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import {
  AlertCircle,
  Clock,
  ExternalLink,
  Gauge,
  LineChart as LineChartIcon,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";

// ─── Types miroirs des endpoints backend ─────────────────────────────────

interface GscRow {
  date: string;
  page: string;
  query: string;
  device: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface Ga4Row {
  date: string;
  page: string;
  channel: string;
  sessions: number;
  conversions: number;
  bounce_rate: number | null;
  avg_session_duration: number | null;
}

interface CwvRow {
  date: string;
  page: string;
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  ttfb: number | null;
}

interface RunRow {
  id: string;
  event_type: string;
  severity: string;
  payload: Record<string, unknown>;
  created_at: string;
  ack_at: string | null;
  resolved_at: string | null;
}

interface CredentialsHealth {
  monitoring_enabled: boolean;
  readiness: {
    gsc: { ready: boolean; reason?: string };
    ga4: { ready: boolean; reason?: string };
  };
  gsc_site_url: string;
  ga4_property: string | null;
}

// ─── Loader ──────────────────────────────────────────────────────────────

export const meta: MetaFunction = () =>
  createNoIndexMeta("Observability SEO - Admin");

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "30", 10);
  const top = url.searchParams.get("top") || "200";
  const dateTo = new Date().toISOString().slice(0, 10);
  const dateFrom = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const headers = { Cookie: cookieHeader };

  try {
    const [healthRes, gscRes, ga4Res, cwvRes, runsRes] = await Promise.all([
      fetch(`${backendUrl}/api/admin/seo-monitoring/credentials/health`, {
        headers,
      }),
      fetch(
        `${backendUrl}/api/admin/seo-monitoring/timeseries/gsc?from=${dateFrom}&to=${dateTo}&top=${top}`,
        { headers },
      ),
      fetch(
        `${backendUrl}/api/admin/seo-monitoring/timeseries/ga4?from=${dateFrom}&to=${dateTo}`,
        { headers },
      ),
      fetch(
        `${backendUrl}/api/admin/seo-monitoring/timeseries/cwv?from=${dateFrom}&to=${dateTo}`,
        { headers },
      ),
      fetch(`${backendUrl}/api/admin/seo-monitoring/runs?limit=20`, {
        headers,
      }),
    ]);

    const health: CredentialsHealth | null = healthRes.ok
      ? await healthRes.json()
      : null;
    const gscData = gscRes.ok ? await gscRes.json() : null;
    const ga4Data = ga4Res.ok ? await ga4Res.json() : null;
    const cwvData = cwvRes.ok ? await cwvRes.json() : null;
    const runsData = runsRes.ok ? await runsRes.json() : null;

    return json({
      health,
      gscRows: ((gscData?.rows ?? []) as GscRow[]),
      gscTotals: gscData?.totals ?? {
        clicks: 0,
        impressions: 0,
        ctr: 0,
        avg_position: 0,
      },
      ga4Rows: ((ga4Data?.rows ?? []) as Ga4Row[]),
      ga4Totals: ga4Data?.totals ?? { sessions: 0, conversions: 0 },
      cwvRows: ((cwvData?.rows ?? []) as CwvRow[]),
      runs: ((runsData?.rows ?? []) as RunRow[]),
      dateFrom,
      dateTo,
      days,
      error: null as string | null,
    });
  } catch (error) {
    logger.error("[SEO Observability] Loader error:", error);
    return json({
      health: null,
      gscRows: [] as GscRow[],
      gscTotals: { clicks: 0, impressions: 0, ctr: 0, avg_position: 0 },
      ga4Rows: [] as Ga4Row[],
      ga4Totals: { sessions: 0, conversions: 0 },
      cwvRows: [] as CwvRow[],
      runs: [] as RunRow[],
      dateFrom: new Date(Date.now() - 30 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      dateTo: new Date().toISOString().slice(0, 10),
      days: 30,
      error: "Erreur connexion backend SEO Monitoring",
    });
  }
}

// ─── Component ───────────────────────────────────────────────────────────

export default function SeoHubObservability() {
  const data = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const credsReady =
    data.health?.readiness.gsc.ready && data.health?.readiness.ga4.ready;
  const monitoringOn = data.health?.monitoring_enabled ?? false;
  const hasGscData = data.gscRows.length > 0;
  const hasGa4Data = data.ga4Rows.length > 0;

  // Aggrégation par jour pour les line charts
  const gscByDay = useMemo(() => aggregateByDate(data.gscRows), [data.gscRows]);
  const ga4ByDay = useMemo(() => aggregateGa4ByDate(data.ga4Rows), [data.ga4Rows]);

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <LineChartIcon className="size-8" />
            SEO Observability
          </h1>
          <p className="text-muted-foreground mt-1">
            GSC + GA4 + Core Web Vitals timeseries · {data.days} jours
            ({data.dateFrom} → {data.dateTo})
          </p>
        </div>
        <Select
          value={String(data.days)}
          onValueChange={(v) => {
            searchParams.set("days", v);
            setSearchParams(searchParams);
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 jours</SelectItem>
            <SelectItem value="14">14 jours</SelectItem>
            <SelectItem value="30">30 jours</SelectItem>
            <SelectItem value="60">60 jours</SelectItem>
            <SelectItem value="90">90 jours</SelectItem>
          </SelectContent>
        </Select>
      </header>

      {data.error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Backend indisponible</AlertTitle>
          <AlertDescription>{data.error}</AlertDescription>
        </Alert>
      ) : null}

      {!credsReady || !monitoringOn ? (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Configuration requise</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Avant que la donnée Google soit ingérée, suivre la procédure
              setup Service Account dans{" "}
              <code className="text-xs">
                .spec/runbooks/seo/observability-setup.md
              </code>
              .
            </p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>
                <code>GSC ready</code> :{" "}
                {data.health?.readiness.gsc.ready ? (
                  <span className="text-green-600">✓</span>
                ) : (
                  <span className="text-amber-600">
                    ✗ {data.health?.readiness.gsc.reason ?? "credentials missing"}
                  </span>
                )}
              </li>
              <li>
                <code>GA4 ready</code> :{" "}
                {data.health?.readiness.ga4.ready ? (
                  <span className="text-green-600">✓</span>
                ) : (
                  <span className="text-amber-600">
                    ✗ {data.health?.readiness.ga4.reason ?? "credentials missing"}
                  </span>
                )}
              </li>
              <li>
                <code>SEO_MONITORING_ENABLED</code> :{" "}
                <span
                  className={cn(
                    monitoringOn ? "text-green-600" : "text-amber-600",
                  )}
                >
                  {String(monitoringOn)}
                </span>
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="size-4" />}
          label="Clicks GSC"
          value={data.gscTotals.clicks.toLocaleString("fr-FR")}
          hint={`${data.gscTotals.impressions.toLocaleString("fr-FR")} impressions`}
        />
        <KpiCard
          icon={<Gauge className="size-4" />}
          label="CTR moyen"
          value={`${(data.gscTotals.ctr * 100).toFixed(2)}%`}
          hint={`Position moy : ${data.gscTotals.avg_position.toFixed(1)}`}
        />
        <KpiCard
          icon={<Users className="size-4" />}
          label="Sessions GA4"
          value={data.ga4Totals.sessions.toLocaleString("fr-FR")}
          hint={`${data.ga4Totals.conversions.toLocaleString("fr-FR")} conversions`}
        />
        <KpiCard
          icon={<Clock className="size-4" />}
          label="Runs récents"
          value={data.runs.length.toString()}
          hint="event_log fetchers"
        />
      </div>

      <Tabs defaultValue="traffic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="traffic">Traffic</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="cwv">Core Web Vitals</TabsTrigger>
          <TabsTrigger value="runs">Runs (audit)</TabsTrigger>
        </TabsList>

        {/* Traffic tab */}
        <TabsContent value="traffic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Position moyenne & CTR (GSC)</CardTitle>
              <CardDescription>
                Évolution sur {data.days} jours
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasGscData ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={gscByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="position"
                      stroke="#2563eb"
                      name="Position moy"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="ctr_pct"
                      stroke="#16a34a"
                      name="CTR %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="Aucune donnée GSC ingérée — exécuter POST /api/admin/seo-monitoring/run/gsc ou attendre cron quotidien (Phase 1b)." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sessions & conversions (GA4)</CardTitle>
              <CardDescription>
                Évolution sur {data.days} jours
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasGa4Data ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={ga4ByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="sessions"
                      stroke="#2563eb"
                      name="Sessions"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="conversions"
                      stroke="#16a34a"
                      name="Conversions"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="Aucune donnée GA4 ingérée." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pages tab */}
        <TabsContent value="pages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top pages GSC</CardTitle>
              <CardDescription>
                Triées par clicks décroissants
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasGscData ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Page</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Impressions</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                      <TableHead className="text-right">Position</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topPages(data.gscRows, 50).map((p) => (
                      <TableRow key={p.page}>
                        <TableCell className="max-w-[400px] truncate text-xs">
                          <Link
                            to={p.page}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline inline-flex items-center gap-1"
                          >
                            {p.page}
                            <ExternalLink className="size-3" />
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {p.clicks.toLocaleString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {p.impressions.toLocaleString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {(p.ctr * 100).toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {p.position.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState message="Pas de pages dans la fenêtre sélectionnée." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CWV tab */}
        <TabsContent value="cwv" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Core Web Vitals</CardTitle>
              <CardDescription>
                LCP / CLS / INP / TTFB — sample top pages (PageSpeed Insights)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.cwvRows.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead className="text-right">LCP (ms)</TableHead>
                      <TableHead className="text-right">CLS</TableHead>
                      <TableHead className="text-right">INP (ms)</TableHead>
                      <TableHead className="text-right">TTFB (ms)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.cwvRows.slice(0, 50).map((r, i) => (
                      <TableRow key={`${r.date}-${r.page}-${i}`}>
                        <TableCell className="font-mono text-xs">
                          {r.date}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-xs">
                          {r.page}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono",
                            r.lcp && r.lcp > 2500 && "text-amber-600",
                            r.lcp && r.lcp > 4000 && "text-red-600",
                          )}
                        >
                          {r.lcp?.toFixed(0) ?? "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono",
                            r.cls && r.cls > 0.1 && "text-amber-600",
                            r.cls && r.cls > 0.25 && "text-red-600",
                          )}
                        >
                          {r.cls?.toFixed(3) ?? "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono",
                            r.inp && r.inp > 200 && "text-amber-600",
                            r.inp && r.inp > 500 && "text-red-600",
                          )}
                        >
                          {r.inp?.toFixed(0) ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {r.ttfb?.toFixed(0) ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState message="Aucune donnée CWV. Exécuter sample top 1k pages via cron CWV (Phase 1b)." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Runs tab */}
        <TabsContent value="runs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit trail fetchers</CardTitle>
              <CardDescription>
                Derniers événements ingestion_run_* (event_log)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.runs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                      <TableHead className="text-right">Rows</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.runs.map((r) => {
                      const p = r.payload as Record<string, unknown>;
                      const source = (p.source as string) ?? "?";
                      const dur =
                        typeof p.duration_seconds === "number"
                          ? `${(p.duration_seconds as number).toFixed(1)}s`
                          : "—";
                      const rows =
                        typeof p.rows_inserted === "number"
                          ? (p.rows_inserted as number).toLocaleString("fr-FR")
                          : "—";
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">
                            {new Date(r.created_at).toLocaleString("fr-FR")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                r.event_type === "ingestion_run_failed"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {r.event_type.replace("ingestion_run_", "")}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {source}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                r.severity === "critical"
                                  ? "destructive"
                                  : r.severity === "high"
                                    ? "default"
                                    : "outline"
                              }
                            >
                              {r.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {dur}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {rows}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState message="Aucun run encore exécuté. Configurer credentials puis exécuter POST /api/admin/seo-monitoring/run/gsc." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="text-2xl font-bold mt-2">{value}</div>
        {hint ? (
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Zap className="size-8 mb-2 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function aggregateByDate(
  rows: GscRow[],
): Array<{ date: string; clicks: number; impressions: number; position: number; ctr_pct: number }> {
  const m = new Map<
    string,
    { clicks: number; impressions: number; position_sum: number }
  >();
  for (const r of rows) {
    const acc = m.get(r.date) ?? { clicks: 0, impressions: 0, position_sum: 0 };
    acc.clicks += r.clicks;
    acc.impressions += r.impressions;
    acc.position_sum += r.position * r.impressions;
    m.set(r.date, acc);
  }
  return Array.from(m.entries())
    .map(([date, v]) => ({
      date,
      clicks: v.clicks,
      impressions: v.impressions,
      position:
        v.impressions > 0
          ? Number((v.position_sum / v.impressions).toFixed(2))
          : 0,
      ctr_pct:
        v.impressions > 0
          ? Number(((v.clicks / v.impressions) * 100).toFixed(2))
          : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateGa4ByDate(
  rows: Ga4Row[],
): Array<{ date: string; sessions: number; conversions: number }> {
  const m = new Map<string, { sessions: number; conversions: number }>();
  for (const r of rows) {
    const acc = m.get(r.date) ?? { sessions: 0, conversions: 0 };
    acc.sessions += r.sessions;
    acc.conversions += r.conversions;
    m.set(r.date, acc);
  }
  return Array.from(m.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function topPages(
  rows: GscRow[],
  limit: number,
): Array<{
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}> {
  const m = new Map<
    string,
    { clicks: number; impressions: number; position_sum: number }
  >();
  for (const r of rows) {
    const acc = m.get(r.page) ?? { clicks: 0, impressions: 0, position_sum: 0 };
    acc.clicks += r.clicks;
    acc.impressions += r.impressions;
    acc.position_sum += r.position * r.impressions;
    m.set(r.page, acc);
  }
  return Array.from(m.entries())
    .map(([page, v]) => ({
      page,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
      position: v.impressions > 0 ? v.position_sum / v.impressions : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit);
}
