/**
 * ResultHypotheses — Block 3: Scored hypotheses with evidence
 */
import {
  ChevronDown,
  ChevronUp,
  Search,
  ThumbsUp,
  ThumbsDown,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { type Hypothesis } from "../types";

interface Props {
  hypotheses: Hypothesis[];
}

const URGENCY_BADGE: Record<string, string> = {
  haute: "bg-red-100 text-red-700 border-red-200",
  moyenne: "bg-amber-100 text-amber-700 border-amber-200",
  basse: "bg-green-100 text-green-700 border-green-200",
};

const SCORE_COLOR = (score: number) => {
  if (score >= 70) return "text-red-600";
  if (score >= 45) return "text-orange-600";
  if (score >= 25) return "text-amber-600";
  return "text-gray-500";
};

const PROGRESS_COLOR = (score: number) => {
  if (score >= 70) return "[&>div]:bg-red-500";
  if (score >= 45) return "[&>div]:bg-orange-500";
  if (score >= 25) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-gray-400";
};

export function ResultHypotheses({ hypotheses }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(
    hypotheses[0]?.hypothesis_id || null,
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-600" />
          Causes possibles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {hypotheses.map((h, i) => {
          const expanded = expandedId === h.hypothesis_id;
          const isTop = i === 0;

          return (
            <div
              key={h.hypothesis_id}
              className={`rounded-lg border transition-all ${
                isTop ? "border-blue-200 bg-blue-50/30" : "border-gray-200"
              }`}
            >
              {/* Header — always visible */}
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : h.hypothesis_id)}
                className="w-full flex items-center gap-3 p-3 text-left"
              >
                {/* Rank */}
                <span
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${
                    isTop
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 border border-gray-200"
                  }`}
                >
                  {i + 1}
                </span>

                {/* Label + score */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900 truncate">
                      {h.label}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${
                        URGENCY_BADGE[h.urgency] || ""
                      }`}
                    >
                      {h.urgency}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress
                      value={h.relative_score}
                      className={`h-1.5 flex-1 max-w-[120px] ${PROGRESS_COLOR(h.relative_score)}`}
                    />
                    <span
                      className={`text-xs font-semibold ${SCORE_COLOR(h.relative_score)}`}
                    >
                      {h.relative_score}/100
                    </span>
                  </div>
                </div>

                {expanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* Expanded details */}
              {expanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3 ml-10">
                  {/* Scoring breakdown */}
                  {h.scoring_breakdown && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(h.scoring_breakdown).map(([key, val]) => (
                        <div
                          key={key}
                          className="text-center p-1.5 rounded bg-gray-50"
                        >
                          <p className="text-[10px] text-gray-500 uppercase">
                            {SCORE_LABELS[key] || key}
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            {val as number}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Evidence for */}
                  {h.evidence_for.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-green-700 flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" />
                        Arguments pour
                      </p>
                      <ul className="space-y-0.5">
                        {h.evidence_for.map((e, j) => (
                          <li
                            key={j}
                            className="text-xs text-gray-600 pl-4 relative before:content-['+'] before:absolute before:left-0 before:text-green-500 before:font-bold"
                          >
                            {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Evidence against */}
                  {h.evidence_against.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-red-700 flex items-center gap-1">
                        <ThumbsDown className="w-3 h-3" />
                        Arguments contre
                      </p>
                      <ul className="space-y-0.5">
                        {h.evidence_against.map((e, j) => (
                          <li
                            key={j}
                            className="text-xs text-gray-600 pl-4 relative before:content-['-'] before:absolute before:left-0 before:text-red-500 before:font-bold"
                          >
                            {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Verification method */}
                  {h.verification_method && (
                    <div className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-100">
                      <Wrench className="w-3.5 h-3.5 mt-0.5 text-amber-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-amber-800">
                          Vérification recommandée
                        </p>
                        <p className="text-xs text-amber-700">
                          {h.verification_method}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

const SCORE_LABELS: Record<string, string> = {
  signal_match: "Signal",
  vehicle_fit: "Véhicule",
  lifecycle_fit: "Cycle vie",
  maintenance_history: "Entretien",
  plausibility: "Plausibilité",
  context: "Contexte",
};
