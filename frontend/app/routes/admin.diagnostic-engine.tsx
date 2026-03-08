/**
 * Route: /admin/diagnostic-engine
 *
 * Admin dashboard for the Diagnostic Engine.
 * Shows stats, recent sessions, system coverage.
 */
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Activity,
  Brain,
  Clock,
  Database,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getInternalApiUrl } from "~/utils/internal-api.server";

interface Stats {
  total_sessions: number;
  sessions_by_system: Array<{ system_scope: string; count: number }>;
  systems_count: number;
  symptoms_count: number;
  causes_count: number;
  safety_rules_count: number;
}

interface Session {
  id: string;
  system_scope: string;
  vehicle: Record<string, unknown>;
  created_at: string;
}

export const loader = async ({ request: _request }: LoaderFunctionArgs) => {
  const [statsRes, sessionsRes] = await Promise.all([
    fetch(getInternalApiUrl("/api/diagnostic-engine/stats")).catch(() => null),
    fetch(getInternalApiUrl("/api/diagnostic-engine/sessions?limit=10")).catch(
      () => null,
    ),
  ]);

  const stats: Stats = statsRes?.ok
    ? await statsRes.json()
    : {
        total_sessions: 0,
        sessions_by_system: [],
        systems_count: 0,
        symptoms_count: 0,
        causes_count: 0,
        safety_rules_count: 0,
      };

  const sessionsData = sessionsRes?.ok
    ? await sessionsRes.json()
    : { sessions: [] };

  return json({ stats, sessions: sessionsData.sessions || [] });
};

const SYSTEM_LABELS: Record<string, string> = {
  freinage: "Freinage",
  demarrage_charge: "Demarrage / Charge",
  refroidissement: "Refroidissement",
};

export default function AdminDiagnosticEngine() {
  const { stats, sessions } = useLoaderData<{
    stats: Stats;
    sessions: Session[];
  }>();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Brain className="w-6 h-6 text-blue-600" />
          Moteur Diagnostic
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Statistiques et monitoring du moteur de raisonnement mecanique
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={<Activity className="w-4 h-4 text-blue-600" />}
          label="Sessions"
          value={stats.total_sessions}
        />
        <StatCard
          icon={<Stethoscope className="w-4 h-4 text-green-600" />}
          label="Systemes"
          value={stats.systems_count}
        />
        <StatCard
          icon={<Database className="w-4 h-4 text-purple-600" />}
          label="Symptomes"
          value={stats.symptoms_count}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-orange-600" />}
          label="Causes"
          value={stats.causes_count}
        />
        <StatCard
          icon={<ShieldCheck className="w-4 h-4 text-red-600" />}
          label="Regles securite"
          value={stats.safety_rules_count}
        />
        <StatCard
          icon={<Brain className="w-4 h-4 text-indigo-600" />}
          label="Engines"
          value={6}
        />
      </div>

      {/* Sessions by system + Recent sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions by system */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Repartition par systeme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.sessions_by_system.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune session</p>
            ) : (
              stats.sessions_by_system.map((s) => {
                const pct =
                  stats.total_sessions > 0
                    ? Math.round((s.count / stats.total_sessions) * 100)
                    : 0;
                return (
                  <div key={s.system_scope} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        {SYSTEM_LABELS[s.system_scope] || s.system_scope}
                      </span>
                      <span className="text-gray-500">
                        {s.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent sessions */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              Sessions recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune session</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 font-medium">Systeme</th>
                      <th className="pb-2 font-medium">Vehicule</th>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sessions.map((s: Session) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="py-2">
                          <Badge variant="outline" className="text-xs">
                            {SYSTEM_LABELS[s.system_scope] || s.system_scope}
                          </Badge>
                        </td>
                        <td className="py-2 text-gray-700">
                          {s.vehicle
                            ? `${s.vehicle.brand || ""} ${s.vehicle.model || ""}`.trim() ||
                              "-"
                            : "-"}
                        </td>
                        <td className="py-2 text-gray-500">
                          {new Date(s.created_at).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2">
                          <code className="text-xs text-gray-400">
                            {s.id.slice(0, 8)}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Engine pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pipeline (6 engines)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {[
              { name: "Signal", color: "bg-blue-100 text-blue-700" },
              { name: "Scoring", color: "bg-purple-100 text-purple-700" },
              { name: "Securite", color: "bg-red-100 text-red-700" },
              { name: "Catalogue", color: "bg-green-100 text-green-700" },
              { name: "Entretien", color: "bg-orange-100 text-orange-700" },
              { name: "RAG", color: "bg-indigo-100 text-indigo-700" },
            ].map((engine, i) => (
              <div key={engine.name} className="flex items-center gap-2">
                <Badge className={engine.color}>{engine.name}</Badge>
                {i < 5 && (
                  <span className="text-gray-300 hidden sm:inline">&rarr;</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs text-gray-500">{label}</span>
        </div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </CardContent>
    </Card>
  );
}
