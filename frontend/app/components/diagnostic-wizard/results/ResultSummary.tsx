/**
 * ResultSummary — Block 2: Factual inputs confirmed + system suspects
 */
import { CheckCircle2, Info } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface Props {
  confirmed: string[];
  systemSuspects: string[];
  signalQuality?: string;
  hypothesesCount: number;
}

const QUALITY_LABELS: Record<string, { label: string; color: string }> = {
  high: { label: "Signal clair", color: "bg-green-100 text-green-700" },
  medium: { label: "Signal partiel", color: "bg-amber-100 text-amber-700" },
  low: { label: "Signal faible", color: "bg-red-100 text-red-700" },
};

export function ResultSummary({
  confirmed,
  systemSuspects,
  signalQuality,
  hypothesesCount,
}: Props) {
  const quality =
    QUALITY_LABELS[signalQuality || "medium"] || QUALITY_LABELS.medium;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            Synthèse du diagnostic
          </span>
          <div className="flex gap-2">
            <Badge variant="outline" className={`text-xs ${quality.color}`}>
              {quality.label}
            </Badge>
            <Badge
              variant="outline"
              className="text-xs bg-blue-50 text-blue-700"
            >
              {hypothesesCount} hypothèse{hypothesesCount > 1 ? "s" : ""}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Confirmed facts */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Données prises en compte
          </p>
          <ul className="space-y-1">
            {confirmed.map((fact, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                {fact}
              </li>
            ))}
          </ul>
        </div>

        {/* System suspects */}
        {systemSuspects.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Composants suspects
            </p>
            <div className="flex flex-wrap gap-2">
              {systemSuspects.map((s, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-sm bg-orange-50 text-orange-700 border-orange-200"
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
