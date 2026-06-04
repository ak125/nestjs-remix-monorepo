/**
 * Command Center — Global Health Bar.
 * Answers "is the system healthy?" in <10s: global verdict + reasons + per-family
 * rollup + freshness/validation. Enforces "no green on broken source" — a family
 * with any non-CERTIFIED department is never shown green.
 */
import { type CommandCenterResponse, type Certification } from "@repo/registry";
import { ShieldCheck, ShieldAlert, AlertTriangle, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import {
  certVariant,
  globalLevelVariant,
  StaleBadge,
  ValidationBadge,
} from "./badges";

const FAMILIES = ["Business", "Growth", "Operations", "AI-Governance"] as const;
const RANK: Record<Certification, number> = {
  BROKEN: 0,
  UNKNOWN: 1,
  PARTIAL: 2,
  CERTIFIED: 3,
};

export function GlobalHealthBar({ data }: { data: CommandCenterResponse }) {
  const { global_status: g } = data;
  const Icon =
    g.level === "OK"
      ? ShieldCheck
      : g.level === "WARNING"
        ? AlertTriangle
        : ShieldAlert;
  const alertVariant =
    g.level === "CRITICAL"
      ? "error"
      : g.level === "WARNING"
        ? "warning"
        : "success";

  // per-family rollup = worst department certification in the family
  const families = FAMILIES.map((family) => {
    const depts = data.departments.filter((d) => d.family === family);
    let worst: Certification = "CERTIFIED";
    for (const d of depts) {
      if (RANK[d.certification as Certification] < RANK[worst]) {
        worst = d.certification as Certification;
      }
    }
    return { family, worst, count: depts.length };
  }).filter((f) => f.count > 0);

  return (
    <section aria-label="Santé globale" className="space-y-4">
      <Alert
        variant={alertVariant}
        icon={<Icon className="h-5 w-5" aria-hidden />}
      >
        <AlertTitle className="flex flex-wrap items-center gap-2">
          <span>État global&nbsp;:</span>
          <Badge variant={globalLevelVariant[g.level]}>{g.level}</Badge>
          <Badge variant="outline">{g.verdict}</Badge>
          <StaleBadge value={data.stale_status} />
          <ValidationBadge value={data.validation_status} />
        </AlertTitle>
        <AlertDescription>
          {g.reasons.length === 0 ? (
            <span>Aucun risque signalé.</span>
          ) : (
            <ul className="list-disc pl-5">
              {g.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden />
            Snapshot {data.source_truth.last_verified ?? "—"} · servi{" "}
            {new Date(data.generated_at).toLocaleString("fr-FR")}
            {data.git_sha ? ` · ${data.git_sha.slice(0, 7)}` : ""}
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {families.map((f) => (
          <Card key={f.family}>
            <CardContent className="flex items-center justify-between gap-2 p-4">
              <div>
                <p className="text-sm font-medium">{f.family}</p>
                <p className="text-xs text-muted-foreground">{f.count} dépt.</p>
              </div>
              <Badge
                variant={certVariant[f.worst]}
                aria-label={`${f.family} : ${f.worst}`}
              >
                {f.worst}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
