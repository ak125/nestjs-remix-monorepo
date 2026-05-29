/**
 * ResultDrivability — Bloc "Puis-je rouler ?" (PR-1a, kill-switch DIAGNOSTIC_RESULT_UX_V2_ENABLED)
 *
 * Verdict de roulabilité TOUJOURS affiché, dérivé du `risk_level` de l'EvidencePack
 * (donnée déjà produite par RiskSafetyEngine — aucune nouvelle table, aucun calcul inventé).
 *
 * No-fake-confidence : si `risk_level` est absent, on affiche « À confirmer » (gris),
 * jamais un feu vert/rouge non fondé.
 */
import { CircleCheck, CircleAlert, OctagonAlert, CircleHelp } from "lucide-react";

interface Props {
  riskLevel?: string;
  safetyAlert?: string;
}

interface Verdict {
  title: string;
  message: string;
  bg: string;
  border: string;
  text: string;
  icon: typeof CircleCheck;
}

// Mapping risk_level (RiskSafetyEngine) → verdict roulabilité. Pas de feu vert "par défaut".
const VERDICTS: Record<string, Verdict> = {
  critical: {
    title: "Ne roulez pas",
    message:
      "Arrêtez le véhicule dès que possible en sécurité et contactez une assistance ou un garage.",
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-800",
    icon: OctagonAlert,
  },
  high: {
    title: "Roulez avec prudence",
    message:
      "Un court trajet reste possible, mais évitez l'autoroute et faites contrôler rapidement.",
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-800",
    icon: CircleAlert,
  },
  moderate: {
    title: "Vous pouvez rouler, mais surveillez",
    message:
      "Aucun danger immédiat identifié. Faites contrôler ce point lors d'un prochain entretien.",
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    icon: CircleAlert,
  },
  low: {
    title: "Vous pouvez rouler",
    message:
      "Aucun signe de danger immédiat. Restez attentif à l'évolution des symptômes.",
    bg: "bg-green-50",
    border: "border-green-300",
    text: "text-green-800",
    icon: CircleCheck,
  },
};

const UNKNOWN: Verdict = {
  title: "À confirmer",
  message:
    "Précisez les symptômes (et un code OBD si disponible) pour évaluer si vous pouvez rouler.",
  bg: "bg-gray-50",
  border: "border-gray-200",
  text: "text-gray-700",
  icon: CircleHelp,
};

export function ResultDrivability({ riskLevel, safetyAlert }: Props) {
  const verdict = (riskLevel && VERDICTS[riskLevel]) || UNKNOWN;
  const Icon = verdict.icon;

  return (
    <div
      className={`rounded-lg border-2 ${verdict.border} ${verdict.bg} p-4`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-6 h-6 flex-shrink-0 mt-0.5 ${verdict.text}`} />
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Puis-je rouler ?
          </p>
          <h3 className={`font-semibold text-sm ${verdict.text}`}>
            {verdict.title}
          </h3>
          <p className={`text-sm ${verdict.text}`}>
            {safetyAlert || verdict.message}
          </p>
        </div>
      </div>
    </div>
  );
}
