/**
 * ResultSafety — Block 1: Safety alert & risk flags
 * Always visible if risk_flags is non-empty. Critical = red banner.
 */
import { AlertTriangle, ShieldAlert } from "lucide-react";

interface Props {
  riskLevel?: string;
  riskFlags: string[];
  safetyAlert?: string;
}

const RISK_STYLES: Record<
  string,
  { bg: string; border: string; text: string; icon: string }
> = {
  critical: {
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-800",
    icon: "text-red-600",
  },
  high: {
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-800",
    icon: "text-orange-600",
  },
  moderate: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    icon: "text-amber-600",
  },
  low: {
    bg: "bg-green-50",
    border: "border-green-300",
    text: "text-green-800",
    icon: "text-green-600",
  },
};

export function ResultSafety({ riskLevel, riskFlags, safetyAlert }: Props) {
  const style = RISK_STYLES[riskLevel || "moderate"] || RISK_STYLES.moderate;

  return (
    <div
      className={`rounded-lg border-2 ${style.border} ${style.bg} p-4 space-y-3`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className={`w-6 h-6 flex-shrink-0 mt-0.5 ${style.icon}`} />
        <div className="space-y-1">
          <h3 className={`font-semibold text-sm ${style.text}`}>
            {riskLevel === "critical"
              ? "Alerte sécurité"
              : riskLevel === "high"
                ? "Attention requise"
                : "Points de vigilance"}
          </h3>
          {safetyAlert && (
            <p className={`text-sm ${style.text}`}>{safetyAlert}</p>
          )}
        </div>
      </div>

      <ul className="space-y-1.5 ml-9">
        {riskFlags.map((flag, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <AlertTriangle
              className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${style.icon}`}
            />
            <span className={style.text}>{flag}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
