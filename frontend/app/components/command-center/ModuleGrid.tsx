/**
 * Command Center — Department/Module grid, grouped into the 4 families
 * (Business / Growth / Operations / AI-Governance). Each card shows the live
 * health score (base + live caps), worst-case certification, KPI, and its
 * capabilities with per-capability certification (OVERCLAIM highlight when a
 * live capability has no evidence).
 */
import { type CommandCenterResponse, type Certification } from "@repo/registry";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { certVariant, scoreTextClass } from "./badges";

const FAMILIES = ["Business", "Growth", "Operations", "AI-Governance"] as const;

const priorityVariant: Record<
  string,
  "destructive" | "warning" | "info" | "subtle"
> = {
  P0: "destructive",
  P1: "warning",
  P2: "info",
  P3: "subtle",
};

export function ModuleGrid({ data }: { data: CommandCenterResponse }) {
  const capsByOwner = new Map<string, CommandCenterResponse["capabilities"]>();
  for (const c of data.capabilities) {
    const arr = capsByOwner.get(c.owner) ?? [];
    arr.push(c);
    capsByOwner.set(c.owner, arr);
  }

  return (
    <div className="space-y-6">
      {FAMILIES.map((family) => {
        const depts = data.departments.filter((d) => d.family === family);
        if (!depts.length) return null;
        return (
          <section key={family} aria-label={family}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {family}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {depts.map((d) => {
                const caps = capsByOwner.get(d.id) ?? [];
                return (
                  <Card key={d.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm">{d.label}</CardTitle>
                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                          {d.priority ? (
                            <Badge
                              variant={priorityVariant[d.priority] ?? "subtle"}
                            >
                              {d.priority}
                            </Badge>
                          ) : null}
                          <Badge
                            variant={
                              certVariant[d.certification as Certification]
                            }
                          >
                            {d.certification}
                          </Badge>
                        </div>
                      </div>
                      {d.kpi_primary ? (
                        <p className="text-xs text-muted-foreground">
                          KPI : {d.kpi_primary}
                        </p>
                      ) : null}
                    </CardHeader>
                    <CardContent className="flex grow flex-col gap-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Santé</span>
                          <span
                            className={`font-semibold ${scoreTextClass(d.health_score_current)}`}
                          >
                            {d.health_score_current}/100
                          </span>
                        </div>
                        <Progress
                          value={d.health_score_current}
                          aria-label={`Santé ${d.label} : ${d.health_score_current} sur 100`}
                        />
                        {d.live_caps_applied.length +
                          d.structural_caps_applied.length >
                        0 ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            plafonds :{" "}
                            {[
                              ...d.structural_caps_applied,
                              ...d.live_caps_applied,
                            ].join(", ")}
                          </p>
                        ) : null}
                      </div>
                      <ul className="space-y-1">
                        {caps.map((c) => {
                          const overclaim =
                            c.status === "live" &&
                            c.reason === "no_structured_evidence";
                          return (
                            <li
                              key={c.id}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="truncate" title={c.id}>
                                {c.id}
                              </span>
                              <span className="flex shrink-0 items-center gap-1">
                                {overclaim ? (
                                  <Badge
                                    variant="destructive"
                                    aria-label="Risque de surclassement : live sans preuve"
                                  >
                                    OVERCLAIM
                                  </Badge>
                                ) : null}
                                {c.certification === "BROKEN" ? (
                                  <Badge variant="destructive">BROKEN</Badge>
                                ) : (
                                  <Badge
                                    variant={
                                      certVariant[
                                        c.certification as Certification
                                      ]
                                    }
                                  >
                                    {c.certification}
                                  </Badge>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
