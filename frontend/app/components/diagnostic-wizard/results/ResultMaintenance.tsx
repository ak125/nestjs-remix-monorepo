/**
 * ResultMaintenance — Block 4: Maintenance recommendations with intervals
 */
import { Calendar, Clock, ExternalLink, Wrench } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { type MaintenanceRecommendation } from "../types";

interface Props {
  recommendations: MaintenanceRecommendation[];
  maintenanceLinks: string[];
}

const OVERDUE_STYLES: Record<string, { badge: string; label: string }> = {
  overdue: {
    badge: "bg-red-100 text-red-700 border-red-200",
    label: "En retard",
  },
  approaching: {
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    label: "À vérifier",
  },
  ok: { badge: "bg-green-100 text-green-700 border-green-200", label: "OK" },
  unknown: {
    badge: "bg-gray-100 text-gray-500 border-gray-200",
    label: "Inconnu",
  },
};

const SEVERITY_ICONS: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  moderate: "🟡",
  low: "🟢",
};

export function ResultMaintenance({
  recommendations,
  maintenanceLinks: _maintenanceLinks,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="w-5 h-5 text-blue-600" />
          Entretien associé
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((rec) => {
          const overdue =
            OVERDUE_STYLES[rec.overdue_status || "unknown"] ||
            OVERDUE_STYLES.unknown;

          return (
            <div
              key={rec.operation_slug}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                rec.overdue_status === "overdue"
                  ? "border-red-200 bg-red-50/30"
                  : "border-gray-200"
              }`}
            >
              <span className="text-lg mt-0.5">
                {SEVERITY_ICONS[rec.severity_if_overdue] || "🔵"}
              </span>

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-900">
                    {rec.operation_label}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${overdue.badge}`}
                  >
                    {overdue.label}
                  </Badge>
                  {rec.relevance === "primary" && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200"
                    >
                      Lié au symptôme
                    </Badge>
                  )}
                </div>

                {rec.description && (
                  <p className="text-xs text-gray-500">{rec.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                  {rec.interval_km && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {rec.interval_km}
                    </span>
                  )}
                  {rec.interval_months && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {rec.interval_months}
                    </span>
                  )}
                  {rec.related_gamme_slug && (
                    <a
                      href={`/pieces/${rec.related_gamme_slug}`}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Voir les pièces
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
