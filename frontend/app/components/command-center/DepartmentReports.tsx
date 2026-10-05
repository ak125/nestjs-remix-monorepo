/**
 * Command Center — rapports départementaux (Vue 5 de audit/automecanik-departments-map.md).
 * Une fiche par département, calculée par le backend à chaque ouverture du cockpit
 * (`department_reports`, mode full) : KPI mesuré ou « non mesuré », évolution sur la
 * fenêtre précédente, trou, cause, décision, risque, feu vert owner, prochaine preuve.
 * L'écran n'invente rien : une valeur absente reste « non mesuré » / « illisible ».
 */
import { type CommandCenterResponse } from "@repo/registry";
import { ArrowRight, ClipboardList, Hand } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

type Report = CommandCenterResponse["department_reports"][number];
type BadgeVariant = "success" | "warning" | "orange" | "destructive" | "subtle";

const SCORE: Record<Report["score"], { label: string; variant: BadgeVariant }> =
  {
    FORT: { label: "Fort", variant: "success" },
    MOYEN: { label: "Moyen", variant: "warning" },
    FAIBLE: { label: "Faible", variant: "orange" },
    CRITIQUE: { label: "Critique", variant: "destructive" },
    NON_MESURE: { label: "Non mesuré", variant: "subtle" },
  };

const DECISION_LABEL: Record<Report["decision"], string> = {
  REUSE: "Réutiliser",
  IMPROVE: "Améliorer",
  CREATE: "Créer",
  PAUSE: "En pause",
};

const EVOLUTION_LABEL: Record<Report["evolution"], string> = {
  MIEUX: "mieux",
  STABLE: "stable",
  PIRE: "pire",
  INCONNUE: "pas de comparaison",
};

const RISK_LABEL: Record<Report["risk"], string> = {
  FAIBLE: "faible",
  MOYEN: "moyen",
  HAUT: "haut",
};

function kpiLine(r: Report): string {
  const name = r.kpi.label ?? r.kpi.id ?? "aucun KPI déclaré";
  if (r.kpi.measure === "SANS_PRODUCTEUR") return `${name} — non mesuré`;
  if (r.kpi.measure === "ILLISIBLE") return `${name} — source illisible`;
  const value = `${r.kpi.value}${r.kpi.unit ?? ""}`;
  const previous =
    r.kpi.previous_value == null
      ? ""
      : ` (période précédente : ${r.kpi.previous_value})`;
  return `${name} — ${value}${previous}`;
}

export function DepartmentReports({ data }: { data: CommandCenterResponse }) {
  const reports = data.department_reports; // déjà triés côté serveur
  const [onlyGo, setOnlyGo] = useState(false);
  const waitingGo = reports.filter((r) => r.owner_go_required).length;
  const unmeasured = reports.filter((r) => r.score === "NON_MESURE").length;
  const shown = onlyGo ? reports.filter((r) => r.owner_go_required) : reports;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4" aria-hidden />
          Rapports des départements ({reports.length})
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="orange">{waitingGo} attendent votre feu vert</Badge>
          <Badge variant="subtle">{unmeasured} non mesurés</Badge>
          {waitingGo > 0 ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setOnlyGo((v) => !v)}
              aria-pressed={onlyGo}
            >
              {onlyGo
                ? "Tout afficher"
                : "Seulement ceux qui attendent mon feu vert"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun rapport disponible dans ce mode.
          </p>
        ) : (
          <ul className="space-y-3">
            {shown.map((r) => (
              <li key={r.department} className="rounded-md border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {r.label}
                      {r.priority ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {r.priority}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {kpiLine(r)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={SCORE[r.score].variant}>
                      {SCORE[r.score].label}
                    </Badge>
                    <Badge variant="outline">
                      {DECISION_LABEL[r.decision]}
                    </Badge>
                    {r.owner_go_required ? (
                      <Badge variant="orange">
                        <Hand className="mr-1 h-3 w-3" aria-hidden />
                        feu vert owner
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
                  <dt className="text-muted-foreground">Évolution</dt>
                  <dd>
                    {EVOLUTION_LABEL[r.evolution]}
                    {r.period.window_days
                      ? ` · ${r.period.window_days} derniers jours`
                      : ""}
                  </dd>
                  {r.gap ? (
                    <>
                      <dt className="text-muted-foreground">Trou</dt>
                      <dd>{r.gap}</dd>
                    </>
                  ) : null}
                  {r.probable_cause ? (
                    <>
                      <dt className="text-muted-foreground">Cause probable</dt>
                      <dd>{r.probable_cause}</dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">Risque</dt>
                  <dd>{RISK_LABEL[r.risk]}</dd>
                  <dt className="text-muted-foreground">Prochaine preuve</dt>
                  <dd className="flex items-start gap-1">
                    <ArrowRight
                      className="mt-1 h-3.5 w-3.5 shrink-0"
                      aria-hidden
                    />
                    <span>{r.next_evidence}</span>
                  </dd>
                  {r.open_action_ids.length > 0 ? (
                    <>
                      <dt className="text-muted-foreground">Actions</dt>
                      <dd>
                        {r.open_action_ids.length} ouverte(s) dans l'onglet
                        Actions
                      </dd>
                    </>
                  ) : null}
                </dl>

                {r.evidence.length > 0 ? (
                  <ul className="mt-2 space-y-0.5">
                    {r.evidence.slice(0, 3).map((e) => (
                      <li key={e} className="text-xs text-muted-foreground">
                        <code className="break-all">{e}</code>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
