/**
 * Command Center — Global Health Bar.
 * Summarizes the operating map, not application execution: verdict + reasons + per-family
 * rollup + freshness/validation. Enforces "no green on broken source" — a family
 * with non-CERTIFIED software evidence is never shown green. Human responsibilities
 * without software capabilities are counted separately and remain unassessed.
 */
import {
  type CommandCenterResponseV2,
  type Certification,
  type GlobalStatus,
} from "@repo/registry";
import { ShieldCheck, ShieldAlert, AlertTriangle, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import {
  CertBadge,
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

const VERDICT_LABEL: Record<GlobalStatus["verdict"], string> = {
  OPERATIONAL: "Cartographie sans blocage détecté",
  PARTIAL_READY: "Cartographie partielle",
  BLOCKED: "Cartographie bloquée",
};

export function GlobalHealthBar({ data }: { data: CommandCenterResponseV2 }) {
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

  // Presentation only: preserve technical certifications and separate human gaps.
  const families = FAMILIES.map((family) => {
    const depts = data.departments.filter((d) => d.family === family);
    const software = depts.filter(
      (d) => !(d.operating_mode === "human" && d.capabilities.length === 0),
    );
    let worst: Certification = "CERTIFIED";
    for (const d of software) {
      if (RANK[d.certification as Certification] < RANK[worst]) {
        worst = d.certification as Certification;
      }
    }
    return {
      family,
      worst,
      count: depts.length,
      softwareCount: software.length,
      humanCount: depts.length - software.length,
    };
  }).filter((f) => f.count > 0);

  return (
    <section aria-label="État de la cartographie" className="space-y-4">
      <Alert
        variant={alertVariant}
        icon={<Icon className="h-5 w-5" aria-hidden />}
      >
        <AlertTitle className="flex flex-wrap items-center gap-2">
          <span>État de la cartographie&nbsp;:</span>
          <Badge variant={globalLevelVariant[g.level]}>{g.level}</Badge>
          <Badge variant="outline">{VERDICT_LABEL[g.verdict]}</Badge>
          <StaleBadge value={data.stale_status} />
          <ValidationBadge value={data.validation_status} />
        </AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            Certification structurelle : déclaration et présence des fichiers
            cités. L’exécution des services et des parcours métier n’est pas
            vérifiée ici.
          </p>
          {g.reasons.length === 0 ? (
            <span>
              {data.mode === "light"
                ? "Détail des alertes non exposé en mode light."
                : "Aucune alerte de cartographie signalée."}
            </span>
          ) : (
            <ul className="list-disc pl-5">
              {g.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden />
            Vérification déclarée : {data.source_truth.last_verified ?? "—"} ·
            réponse servie {new Date(data.generated_at).toLocaleString("fr-FR")}
            {data.git_sha ? ` · ${data.git_sha.slice(0, 7)}` : ""}
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {families.map((f) => (
          <Card key={f.family} role="group" aria-label={f.family}>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <p className="text-sm font-medium">{f.family}</p>
                <p className="text-xs text-muted-foreground">{f.count} dépt.</p>
                {f.humanCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {f.humanCount}{" "}
                    {f.humanCount === 1
                      ? "responsabilité humaine non évaluée"
                      : "responsabilités humaines non évaluées"}
                  </p>
                )}
              </div>
              {f.softwareCount > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Périmètre logiciel
                  </p>
                  <CertBadge value={f.worst} />
                </div>
              ) : (
                <Badge variant="outline">
                  Aucune capacité logicielle rattachée
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
