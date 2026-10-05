/**
 * ResultHypotheses — Block 3: ranked hypotheses with evidence
 *
 * No number is shown per cause (ADR-035 D3): no score out of 100, no bar,
 * no sub-score. The order still comes from the engine; only the rank shows.
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
import { type Hypothesis } from "../types";

interface Props {
  hypotheses: Hypothesis[];
}

const URGENCY_BADGE: Record<Hypothesis["urgency"], string> = {
  critique: "bg-red-100 text-red-800 border-red-300",
  haute: "bg-red-100 text-red-700 border-red-200",
  moyenne: "bg-amber-100 text-amber-700 border-amber-200",
  basse: "bg-green-100 text-green-700 border-green-200",
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
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
                    isTop
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 border border-gray-200"
                  }`}
                >
                  {i + 1}
                </span>

                {/* Label */}
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
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
                  </span>
                </span>

                {expanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* Expanded details */}
              {expanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3 ml-10">
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
                      <Wrench className="w-3.5 h-3.5 mt-0.5 text-amber-600 shrink-0" />
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
