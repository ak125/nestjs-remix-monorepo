/**
 * ResultMaintenance — Block 4: Maintenance recommendations with intervals
 */
import { Calendar, Clock, ExternalLink, Wrench } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { buildGammeUrl } from "~/utils/url-builder.utils";
import { type MaintenanceRecommendation, type SuggestedGamme } from "../types";

interface Props {
  recommendations: MaintenanceRecommendation[];
  maintenanceLinks: string[];
  allowedOutputMode: string;
  catalogGammes: SuggestedGamme[];
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
  allowedOutputMode,
  catalogGammes,
  maintenanceLinks: _maintenanceLinks,
}: Props) {
  const allowedGammeUrls = new Set(
    catalogGammes.map((gamme) => buildGammeUrl(gamme.gamme_slug, gamme.pg_id)),
  );
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="w-5 h-5 text-blue-600" />
          {recommendations.some((r) => r.relevance === "selected")
            ? "Échéances estimées"
            : "Entretien associé"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.some((r) => r.applicability === "unverified") && (
          <p className="text-xs text-gray-600">
            Intervalles génériques ; applicabilité au véhicule non vérifiée. Un
            seuil dépassé appelle une vérification, pas un remplacement
            automatique.
          </p>
        )}
        {recommendations.map((rec) => {
          const overdue =
            OVERDUE_STYLES[rec.overdue_status || "unknown"] ||
            OVERDUE_STYLES.unknown;

          // Operation metadata can retain stale gamme IDs. Only expose a
          // destination already authorized by the catalogue guard.
          const candidateUrl = buildGammeUrl(
            rec.related_gamme_slug,
            rec.related_pg_id,
          );
          const gammeUrl =
            allowedOutputMode !== "none" &&
            candidateUrl &&
            allowedGammeUrls.has(candidateUrl)
              ? candidateUrl
              : undefined;

          return (
            <div
              key={rec.operation_slug}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                rec.overdue_status === "overdue"
                  ? "border-red-200 bg-red-50/30"
                  : "border-gray-200"
              }`}
            >
              {rec.relevance !== "selected" && (
                <span className="text-lg mt-0.5">
                  {SEVERITY_ICONS[rec.severity_if_overdue] || "🔵"}
                </span>
              )}

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-900">
                    {rec.operation_label}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${overdue.badge}`}
                  >
                    {rec.relevance === "selected"
                      ? {
                          overdue: "Seuil indicatif dépassé",
                          approaching: "À vérifier",
                          ok: "Sous les seuils indicatifs",
                          unknown: "Informations insuffisantes",
                        }[rec.overdue_status ?? "unknown"]
                      : overdue.label}
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

                {rec.applicability === "unverified" && (
                  <div className="space-y-1 text-xs text-gray-600">
                    <p>
                      Dernière intervention déclarée :{" "}
                      {rec.last_service_km !== undefined
                        ? `${rec.last_service_km.toLocaleString("fr-FR")} km`
                        : "kilométrage inconnu"}{" "}
                      · {rec.last_service_date ?? "date inconnue"}
                    </p>
                    {rec.interval_km && rec.next_at_km && (
                      <p>
                        Compteur estimé : <span>{rec.next_at_km}</span>
                      </p>
                    )}
                    {rec.interval_months && rec.next_at_date && (
                      <p>
                        Date estimée : <span>{rec.next_at_date}</span>
                      </p>
                    )}
                  </div>
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
                  {gammeUrl && (
                    <a
                      href={gammeUrl}
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
