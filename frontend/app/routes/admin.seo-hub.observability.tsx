/**
 * 📊 SEO HUB — OBSERVABILITY (Phase 1c)
 *
 * Dashboard timeseries unifié des sources Google :
 *  - GSC : positions, clicks, impressions, CTR sur 90 jours
 *  - GA4 : sessions et événements clés par jour, tous canaux
 *  - CWV : Core Web Vitals (LCP, CLS, INP) sur sample top pages
 *  - Runs : audit trail des fetchers (event_log)
 *
 * Consomme les endpoints du module backend `seo-monitoring` (Phase 1a, PR #170).
 *
 * État vide gracieux : si credentials Google manquantes ou aucune ingestion
 * encore exécutée, affiche message "Configurer Service Account dans runbook"
 * sans crash.
 *
 * Une source en échec (HTTP non-2xx, ou corps `{ error }` de l'API) n'est pas
 * une source vide : elle est nommée dans l'alerte « Sources indisponibles » et
 * ses totaux affichent « — », jamais 0.
 *
 * Refs:
 * - ADR-025 (vault) : architecture département SEO
 * - .spec/runbooks/seo/observability-setup.md : procédure setup SA
 * - PR #166 : recharts ^2.15.4 ajouté en Phase 0
 */

import {
  AlertCircle,
  Clock,
  ExternalLink,
  Gauge,
  LineChart as LineChartIcon,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import {
  type LoaderFunctionArgs,
  type MetaFunction,
  Link,
  useLoaderData,
  useSearchParams,
} from "react-router";
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

/** Total propriété d'un jour PRÉSENT (`__seo_gsc_daily_property_total`). */
interface GscDailyTotal {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  /** Marqueur de commit posé : jour certifié (un zéro confirmé est un vrai zéro). */
  confirmed: boolean;
}

/** Couverture jours du total propriété (jours absents ≠ zéro, présent ≠ confirmé). */
interface GscCoverage {
  last_data_date: string | null;
  expected_from: string | null;
  expected_to: string | null;
  days_expected: number;
  days_present: number;
  days_confirmed: number;
  missing_dates: string[];
  /** Ligne présente sans marqueur : ancien ingesteur ou réécriture interrompue. */
  unconfirmed_dates: string[];
  complete: boolean;
}

/** Portée de l'échantillon `rows` (grain requêtes, jamais exhaustif). */
interface GscRowsScope {
  exhaustive: false;
  limit: number;
  returned: number;
  truncated: boolean;
}

/**
 * Total GA4 d'un jour, tous canaux. `conversions` = événements clés GA4
 * (métrique `keyEvents`), pas des commandes payées.
 */
interface Ga4DailyTotal {
  date: string;
  sessions: number;
  conversions: number;
}

/** Portée des totaux GA4 ; `exhaustive: false` = borne de lecture atteinte côté API. */
interface Ga4TotalsScope {
  grain: "date";
  channels: "all";
  exhaustive: boolean;
  rows_read: number;
  days_present: number;
  last_data_date: string | null;
}

interface GscTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  avg_position: number;
}

/** Source dont la lecture a échoué : à ne jamais confondre avec « aucune donnée ». */
interface UnavailableSource {
  source: string;
  reason: string;
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

    const unavailable: UnavailableSource[] = [];
    const read = async (source: string, res: Response) => {
      const { data, reason } = await readSource(res);
      if (reason) unavailable.push({ source, reason });
      return data;
    };

    const health = (await read(
      "État des credentials",
      healthRes,
    )) as CredentialsHealth | null;
    const gscData = await read("GSC", gscRes);
    let ga4Data = await read("GA4", ga4Res);
    const cwvData = await read("Core Web Vitals", cwvRes);
    const runsData = await read("Runs", runsRes);

    // Sans série quotidienne, totaux et portée, GA4 n'est pas interprétable.
    if (
      ga4Data &&
      !(Array.isArray(ga4Data.daily) && ga4Data.totals && ga4Data.totals_scope)
    ) {
      unavailable.push({
        source: "GA4",
        reason: "réponse sans série quotidienne, totaux ou portée",
      });
      ga4Data = null;
    }

    return {
      health,
      gscRows: (gscData?.rows ?? []) as GscRow[],
      gscRowsScope: (gscData?.rows_scope ?? null) as GscRowsScope | null,
      gscDaily: (gscData?.daily ?? []) as GscDailyTotal[],
      gscCoverage: (gscData?.coverage ?? null) as GscCoverage | null,
      gscTotals: (gscData?.totals ?? null) as GscTotals | null,
      ga4Daily: (ga4Data?.daily ?? []) as Ga4DailyTotal[],
      ga4Totals: (ga4Data?.totals ?? null) as {
        sessions: number;
        conversions: number;
      } | null,
      ga4Scope: (ga4Data?.totals_scope ?? null) as Ga4TotalsScope | null,
      unavailable,
      cwvRows: (cwvData?.rows ?? []) as CwvRow[],
      runs: (runsData?.rows ?? []) as RunRow[],
      dateFrom,
      dateTo,
      days,
      error: null as string | null,
    };
  } catch (error) {
    logger.error("[SEO Observability] Loader error:", error);
    return {
      health: null,
      gscRows: [] as GscRow[],
      gscRowsScope: null as GscRowsScope | null,
      gscDaily: [] as GscDailyTotal[],
      gscCoverage: null as GscCoverage | null,
      gscTotals: null as GscTotals | null,
      ga4Daily: [] as Ga4DailyTotal[],
      ga4Totals: null as { sessions: number; conversions: number } | null,
      ga4Scope: null as Ga4TotalsScope | null,
      unavailable: [] as UnavailableSource[],
      cwvRows: [] as CwvRow[],
      runs: [] as RunRow[],
      dateFrom: new Date(Date.now() - 30 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      dateTo: new Date().toISOString().slice(0, 10),
      days: 30,
      error: "Erreur connexion backend SEO Monitoring",
    };
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
  const hasGscDaily = data.gscDaily.length > 0;
  const hasGa4Data = data.ga4Daily.length > 0;
  const ga4Scope = data.ga4Scope;
  const runsUnavailable = data.unavailable.some((u) => u.source === "Runs");
  const gscCov = data.gscCoverage;
  const gscDaysLabel =
    gscCov && gscCov.days_expected > 0
      ? `${gscCov.days_confirmed}/${gscCov.days_expected} jours confirmés`
      : "couverture inconnue";

  // Série quotidienne du total propriété ; jours manquants = null (trou visible), jamais 0.
  const gscByDay = useMemo(
    () =>
      dailySeriesWithGaps(data.gscDaily, data.gscCoverage?.missing_dates ?? []),
    [data.gscDaily, data.gscCoverage],
  );
  // Série GA4 calculée par l'API sur toutes les lignes ; jours sans donnée = null.
  const ga4ByDay = useMemo(
    () => ga4SeriesWithGaps(data.ga4Daily, data.dateFrom, data.dateTo),
    [data.ga4Daily, data.dateFrom, data.dateTo],
  );

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <LineChartIcon className="size-8" />
            SEO Observability
          </h1>
          <p className="text-muted-foreground mt-1">
            GSC + GA4 + Core Web Vitals timeseries · {data.days} jours (
            {data.dateFrom} → {data.dateTo})
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

      {data.unavailable.length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Sources indisponibles</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>
              La lecture de ces sources a échoué : leurs totaux ne sont pas
              affichés, et un bloc vide ci-dessous ne signifie pas « aucune
              donnée ».
            </p>
            <ul className="list-disc list-inside text-sm">
              {data.unavailable.map((u) => (
                <li key={`${u.source}-${u.reason}`}>
                  {u.source} : <span className="font-mono">{u.reason}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {data.health && (!credsReady || !monitoringOn) ? (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Configuration requise</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Avant que la donnée Google soit ingérée, suivre la procédure setup
              Service Account dans{" "}
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
                    ✗{" "}
                    {data.health?.readiness.gsc.reason ?? "credentials missing"}
                  </span>
                )}
              </li>
              <li>
                <code>GA4 ready</code> :{" "}
                {data.health?.readiness.ga4.ready ? (
                  <span className="text-green-600">✓</span>
                ) : (
                  <span className="text-amber-600">
                    ✗{" "}
                    {data.health?.readiness.ga4.reason ?? "credentials missing"}
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

      {gscCov && !gscCov.complete && gscCov.days_expected > 0 ? (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Données GSC incomplètes ({gscDaysLabel})</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>
              Totaux non exhaustifs : les jours manquants ne sont pas comptés
              comme zéro et apparaissent comme des trous dans la courbe.
            </p>
            {gscCov.missing_dates.length > 0 ? (
              <p className="text-xs font-mono break-words">
                Jours manquants : {gscCov.missing_dates.join(", ")}
              </p>
            ) : null}
            {gscCov.unconfirmed_dates.length > 0 ? (
              <p className="text-xs font-mono break-words">
                Jours présents non confirmés (ingestion à reprendre) :{" "}
                {gscCov.unconfirmed_dates.join(", ")}
              </p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {ga4Scope && !ga4Scope.exhaustive ? (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Données GA4 partielles</AlertTitle>
          <AlertDescription>
            La borne de lecture a été atteinte (
            {ga4Scope.rows_read.toLocaleString("fr-FR")} lignes lues) :{" "}
            {ga4Scope.last_data_date
              ? `la série et les totaux GA4 s'arrêtent au ${ga4Scope.last_data_date}`
              : "aucun jour n'a pu être lu en entier"}
            . Réduire la fenêtre pour un total complet.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="size-4" />}
          label="Clicks GSC"
          value={
            data.gscTotals ? data.gscTotals.clicks.toLocaleString("fr-FR") : "—"
          }
          hint={
            data.gscTotals
              ? `${data.gscTotals.impressions.toLocaleString("fr-FR")} impressions · ${gscDaysLabel}${gscCov?.last_data_date ? ` · dernier jour ${gscCov.last_data_date}` : ""}`
              : "GSC indisponible"
          }
        />
        <KpiCard
          icon={<Gauge className="size-4" />}
          label="CTR moyen"
          value={
            data.gscTotals ? `${(data.gscTotals.ctr * 100).toFixed(2)}%` : "—"
          }
          hint={
            data.gscTotals
              ? `Position moy : ${data.gscTotals.avg_position.toFixed(1)}`
              : "GSC indisponible"
          }
        />
        <KpiCard
          icon={<Users className="size-4" />}
          label="Sessions GA4"
          value={
            data.ga4Totals
              ? data.ga4Totals.sessions.toLocaleString("fr-FR")
              : "—"
          }
          hint={
            data.ga4Totals
              ? `${data.ga4Totals.conversions.toLocaleString("fr-FR")} événements clés · tous canaux${ga4Scope?.last_data_date ? ` · dernier jour ${ga4Scope.last_data_date}` : ""}`
              : "GA4 indisponible"
          }
        />
        <KpiCard
          icon={<Clock className="size-4" />}
          label="Runs récents"
          value={runsUnavailable ? "—" : data.runs.length.toString()}
          hint={runsUnavailable ? "Runs indisponibles" : "event_log fetchers"}
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
                Total propriété par jour · {gscDaysLabel} · jours manquants non
                tracés
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasGscDaily ? (
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
              <CardTitle>Sessions & événements clés (GA4)</CardTitle>
              <CardDescription>
                Tous canaux, par jour
                {ga4Scope
                  ? ` · ${ga4Scope.days_present} jours avec données`
                  : ""}{" "}
                · jours sans donnée non tracés · un événement clé GA4 n'est pas
                une commande payée
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
                      name="Événements clés"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  message={
                    data.ga4Totals
                      ? "Aucune donnée GA4 ingérée sur cette fenêtre."
                      : "GA4 indisponible : la série n'a pas pu être lue."
                  }
                />
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
                Échantillon non exhaustif du détail requêtes (
                {data.gscRowsScope?.returned ?? data.gscRows.length} lignes
                {data.gscRowsScope?.truncated ? ", tronqué" : ""}) — trié par
                clics sur cet échantillon, pas un classement complet
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

/**
 * Série du total propriété : jours présents + jours manquants à `null` (recharts
 * coupe la ligne, `connectNulls` false par défaut) — un trou d'ingestion reste
 * visible au lieu d'être dessiné comme une chute à zéro ou masqué par l'axe.
 */
function dailySeriesWithGaps(
  daily: GscDailyTotal[],
  missingDates: string[],
): Array<{ date: string; position: number | null; ctr_pct: number | null }> {
  return [
    ...daily.map((d) => ({
      date: d.date,
      position: d.impressions > 0 ? Number(d.position.toFixed(2)) : null,
      ctr_pct:
        d.impressions > 0
          ? Number(((d.clicks / d.impressions) * 100).toFixed(2))
          : null,
    })),
    ...missingDates.map((date) => ({ date, position: null, ctr_pct: null })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Série GA4 sur la fenêtre demandée : un jour sans ligne vaut `null` (trou dans
 * la courbe), jamais 0 — même règle que la série GSC.
 */
function ga4SeriesWithGaps(
  daily: Ga4DailyTotal[],
  dateFrom: string,
  dateTo: string,
): Array<{
  date: string;
  sessions: number | null;
  conversions: number | null;
}> {
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const start = Date.parse(`${dateFrom}T00:00:00Z`);
  const end = Date.parse(`${dateTo}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return daily.map((d) => ({ ...d }));
  }
  const series: Array<{
    date: string;
    sessions: number | null;
    conversions: number | null;
  }> = [];
  for (let t = start; t <= end; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    const day = byDate.get(date);
    series.push({
      date,
      sessions: day ? day.sessions : null,
      conversions: day ? day.conversions : null,
    });
  }
  return series;
}

/**
 * Lit la réponse d'un endpoint `seo-monitoring`. L'API signale une lecture en
 * échec par un corps `{ error }` en HTTP 200 : c'est une panne, pas un vide.
 */
async function readSource(
  res: Response,
): Promise<{ data: Record<string, unknown> | null; reason: string | null }> {
  if (!res.ok) return { data: null, reason: `HTTP ${res.status}` };
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { data: null, reason: "réponse illisible" };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { data: null, reason: "réponse inattendue" };
  }
  const data = body as Record<string, unknown>;
  if (typeof data.error === "string" && data.error) {
    return { data: null, reason: data.error };
  }
  return { data, reason: null };
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
