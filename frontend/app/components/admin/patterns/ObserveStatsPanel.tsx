import { Eye, ShieldAlert, BarChart3 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { KpiGrid } from "./DashboardShell";
import { KpiCard } from "./KpiCard";

interface ObserveStats {
  window_days: number;
  cutoff: string;
  generated_at: string;
  totals: {
    total_evaluations: number;
    would_block_brief: number;
    would_block_hard: number;
    published_despite_warning: number;
  };
  by_page_type: Array<{
    page_type: string;
    total_evaluations: number;
    would_block_brief: number;
    would_block_hard: number;
    published_despite_warning: number;
  }>;
  gate_distribution: Array<{
    gate: string;
    verdict: string;
    count: number;
  }>;
  ar_flag_distribution: Array<{
    flag: string;
    count: number;
  }>;
}

export function ObserveStatsPanel({ days = 7 }: { days?: number }) {
  const [stats, setStats] = useState<ObserveStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/content-refresh/observe-stats?days=${days}`,
      );
      if (!res.ok) return;
      const json = await res.json();
      setStats(json?.data ?? json);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chargement...
        </CardContent>
      </Card>
    );
  }

  if (!stats || !stats.totals) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Aucune donnee observe disponible
        </CardContent>
      </Card>
    );
  }

  const { totals, by_page_type, gate_distribution } = stats;

  return (
    <div className="space-y-4">
      <KpiGrid columns={4}>
        <KpiCard
          title="Evaluations"
          value={totals.total_evaluations}
          icon={Eye}
          variant="default"
        />
        <KpiCard
          title="Would block (brief)"
          value={totals.would_block_brief}
          icon={ShieldAlert}
          variant={totals.would_block_brief > 0 ? "warning" : "default"}
        />
        <KpiCard
          title="Would block (hard)"
          value={totals.would_block_hard}
          icon={ShieldAlert}
          variant={totals.would_block_hard > 0 ? "danger" : "default"}
        />
        <KpiCard
          title="Published malgre warn"
          value={totals.published_despite_warning}
          icon={BarChart3}
          variant={totals.published_despite_warning > 0 ? "warning" : "success"}
        />
      </KpiGrid>

      {by_page_type.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Par type de page
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4 text-right">Evaluations</th>
                    <th className="pb-2 pr-4 text-right">Block brief</th>
                    <th className="pb-2 pr-4 text-right">Block hard</th>
                    <th className="pb-2 text-right">Pub+warn</th>
                  </tr>
                </thead>
                <tbody>
                  {by_page_type.map((row) => (
                    <tr key={row.page_type} className="border-b last:border-0">
                      <td className="py-1.5 pr-4 font-mono text-xs">
                        {row.page_type}
                      </td>
                      <td className="py-1.5 pr-4 text-right">
                        {row.total_evaluations}
                      </td>
                      <td className="py-1.5 pr-4 text-right">
                        {row.would_block_brief}
                      </td>
                      <td className="py-1.5 pr-4 text-right">
                        {row.would_block_hard}
                      </td>
                      <td className="py-1.5 text-right">
                        {row.published_despite_warning}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {gate_distribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Distribution des gates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {gate_distribution.map((g, i) => (
                <Badge
                  key={`${g.gate}-${g.verdict}-${i}`}
                  variant={
                    g.verdict === "FAIL"
                      ? "destructive"
                      : g.verdict === "WARN"
                        ? "outline"
                        : "secondary"
                  }
                >
                  {g.gate}: {g.verdict} ({g.count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
