/**
 * Command Center — shared badge variants + colour maps.
 * Single source for tile colours so "no green on broken source" stays consistent.
 * Colour is never the ONLY signal — every badge carries text.
 */
import type {
  Certification,
  GlobalStatus,
} from "@repo/registry";
import { Badge } from "~/components/ui/badge";

type BadgeVariant =
  | "default" | "secondary" | "destructive" | "outline"
  | "success" | "warning" | "info" | "error" | "orange" | "subtle" | "purple";

export const certVariant: Record<Certification, BadgeVariant> = {
  CERTIFIED: "success",
  PARTIAL: "warning",
  UNKNOWN: "subtle",
  BROKEN: "destructive",
};

export const staleVariant: Record<string, BadgeVariant> = {
  FRESH: "success",
  WARNING: "warning",
  STALE: "destructive",
  UNKNOWN: "subtle",
};

export const validationVariant: Record<string, BadgeVariant> = {
  VALIDATED: "success",
  WARN_ONLY: "warning",
  STRICT_FAIL: "destructive",
  UNKNOWN: "subtle",
};

export const severityVariant: Record<string, BadgeVariant> = {
  error: "destructive",
  warn: "warning",
  info: "info",
};

export const globalLevelVariant: Record<GlobalStatus["level"], BadgeVariant> = {
  OK: "success",
  WARNING: "warning",
  CRITICAL: "destructive",
};

/** Health-score → tailwind text colour (≥80 green, ≥50 amber, else red). */
export function scoreTextClass(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

/** Health-score → progress bar colour class. */
export function scoreBarClass(score: number): string {
  if (score >= 80) return "bg-success";
  if (score >= 50) return "bg-warning";
  return "bg-destructive";
}

export function CertBadge({ value }: { value: Certification }) {
  return (
    <Badge variant={certVariant[value]} aria-label={`Certification : ${value}`}>
      {value}
    </Badge>
  );
}

export function StaleBadge({ value }: { value: string }) {
  return (
    <Badge variant={staleVariant[value] ?? "subtle"} aria-label={`Fraîcheur : ${value}`}>
      {value}
    </Badge>
  );
}

export function ValidationBadge({ value }: { value: string }) {
  return (
    <Badge variant={validationVariant[value] ?? "subtle"} aria-label={`Validation : ${value}`}>
      {value.replace("_", " ")}
    </Badge>
  );
}
