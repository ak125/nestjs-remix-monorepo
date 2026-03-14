import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  AlertCircle,
  Database,
  HardDrive,
  Activity,
  Trash2,
  Search,
  RefreshCw,
} from "lucide-react";
import { useState, useCallback } from "react";
import { Badge } from "~/components/ui/badge";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";

export const meta: MetaFunction = () => [
  { title: "DB Governance - Admin FAFA AUTO" },
  { name: "description", content: "Dashboard de gouvernance base de données" },
  { name: "robots", content: "noindex, nofollow" },
];

interface MetricRow {
  [key: string]: string | number | null;
}

interface GovernanceAlert {
  metric_id: string;
  level: "warning" | "critical";
  message: string;
  object_name: string;
}

interface MetricResult {
  metric_id: string;
  rows: MetricRow[];
  alerts: GovernanceAlert[];
  duration_ms: number;
}

interface GovernanceReport {
  metrics: MetricResult[];
  total_alerts: number;
  collected_at: string;
}

const METRIC_LABELS: Record<string, { label: string; description: string }> = {
  M1: { label: "Tables", description: "Top 20 tables par taille" },
  M2: { label: "Indexes", description: "Top 20 indexes par taille" },
  M3: { label: "Stats", description: "Tables sans ANALYZE > 3 mois" },
  M4: { label: "Dead Tuples", description: "Tables avec dead tuples élevés" },
  M5: { label: "Seq Scans", description: "Anomalies sequential scan" },
  M6: { label: "Unused", description: "Indexes 0-scan > 1MB" },
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const baseUrl =
      process.env.NODE_ENV === "development"
        ? "http://127.0.0.1:3000"
        : getInternalApiUrl("");

    const cookie = request.headers.get("Cookie") || "";

    const response = await fetch(`${baseUrl}/api/admin/db-governance/metrics`, {
      headers: { Cookie: cookie },
    }).catch(() => null);

    if (!response || !response.ok) {
      return json({
        report: null,
        error: "Impossible de charger les métriques DB Governance",
        timestamp: new Date().toISOString(),
      });
    }

    const result = await response.json();
    const report: GovernanceReport = result.data || result;

    return json({
      report,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Erreur DB Governance loader:", error);
    return json({
      report: null,
      error: "Erreur lors du chargement",
      timestamp: new Date().toISOString(),
    });
  }
};

export default function AdminDbGovernance() {
  const {
    report: initialReport,
    error,
    timestamp,
  } = useLoaderData<typeof loader>();
  const [report, setReport] = useState<GovernanceReport | null>(initialReport);
  const [activeTab, setActiveTab] = useState("M1");
  const [loading, setLoading] = useState(false);
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(timestamp);

  const refreshMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/db-governance/metrics");
      if (res.ok) {
        const result = await res.json();
        setReport(result.data || result);
        setLastUpdate(new Date().toISOString());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const takeSnapshot = useCallback(async () => {
    setLoading(true);
    setSnapshotStatus(null);
    try {
      const res = await fetch("/api/admin/db-governance/snapshot", {
        method: "POST",
      });
      if (res.ok) {
        const result = await res.json();
        const data = result.data || result;
        setReport(data);
        setSnapshotStatus(`Snapshot enregistré : ${data.total_alerts} alertes`);
        setLastUpdate(new Date().toISOString());
      } else {
        setSnapshotStatus("Erreur lors du snapshot");
      }
    } catch {
      setSnapshotStatus("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, []);

  const activeMetric = report?.metrics?.find((m) => m.metric_id === activeTab);
  const totalAlerts = report?.total_alerts || 0;

  if (error && !report) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PublicBreadcrumb
        items={[{ label: "Admin", href: "/admin" }, { label: "DB Governance" }]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">DB Governance</h1>
          <p className="text-gray-600 mt-1">
            Monitoring base de données — M1 à M6
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refreshMetrics}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Rafraîchir
          </button>
          <button
            onClick={takeSnapshot}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Database className="h-4 w-4" />
            Prendre Snapshot
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500 text-right">
        Dernière mise à jour: {new Date(lastUpdate).toLocaleString("fr-FR")}
      </div>

      {snapshotStatus && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          {snapshotStatus}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<HardDrive className="h-5 w-5 text-blue-500" />}
          label="Tables"
          value={
            report?.metrics?.find((m) => m.metric_id === "M1")?.rows?.length ||
            0
          }
          sub="Top tables par taille"
        />
        <KpiCard
          icon={<Search className="h-5 w-5 text-purple-500" />}
          label="Indexes"
          value={
            report?.metrics?.find((m) => m.metric_id === "M2")?.rows?.length ||
            0
          }
          sub="Top indexes par taille"
        />
        <KpiCard
          icon={<Trash2 className="h-5 w-5 text-orange-500" />}
          label="Dead Tuples"
          value={
            report?.metrics?.find((m) => m.metric_id === "M4")?.rows?.length ||
            0
          }
          sub="Tables avec dead tuples"
        />
        <KpiCard
          icon={
            <AlertCircle
              className={`h-5 w-5 ${totalAlerts > 0 ? "text-red-500" : "text-green-500"}`}
            />
          }
          label="Alertes"
          value={totalAlerts}
          sub={
            totalAlerts === 0
              ? "Aucune alerte"
              : `${totalAlerts} alerte${totalAlerts > 1 ? "s" : ""} active${totalAlerts > 1 ? "s" : ""}`
          }
          highlight={totalAlerts > 0}
        />
      </div>

      {/* Alerts */}
      {report?.metrics?.some((m) => m.alerts.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-amber-800">Alertes actives</h3>
          {report.metrics
            .flatMap((m) => m.alerts)
            .map((alert, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <Badge
                  variant={
                    alert.level === "critical" ? "destructive" : "warning"
                  }
                  size="sm"
                >
                  {alert.level}
                </Badge>
                <span className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">
                  {alert.object_name}
                </span>
                <span className="text-amber-700">{alert.message}</span>
              </div>
            ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {Object.entries(METRIC_LABELS).map(([id, { label }]) => {
            const metric = report?.metrics?.find((m) => m.metric_id === id);
            const alertCount = metric?.alerts?.length || 0;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {id}: {label}
                {alertCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                    {alertCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Metric Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">
              {METRIC_LABELS[activeTab]?.label}
            </h3>
            <p className="text-sm text-gray-500">
              {METRIC_LABELS[activeTab]?.description}
            </p>
          </div>
          {activeMetric && (
            <span className="text-xs text-gray-400">
              {activeMetric.rows.length} lignes · {activeMetric.duration_ms}ms
            </span>
          )}
        </div>

        {activeMetric && activeMetric.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {Object.keys(activeMetric.rows[0]).map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeMetric.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {Object.values(row).map((val, j) => (
                      <td
                        key={j}
                        className="px-4 py-2 text-gray-700 font-mono text-xs whitespace-nowrap"
                      >
                        {val === null ? (
                          <span className="text-gray-300">-</span>
                        ) : (
                          String(val)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Aucune donnée pour cette métrique
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow-sm border p-5 ${
        highlight ? "border-red-200 bg-red-50" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-500">{label}</h3>
        {icon}
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}
