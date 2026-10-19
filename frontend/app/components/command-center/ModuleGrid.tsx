/**
 * Command Center — Responsibilities ordered by business number, with family badges
 * (Business / Growth / Operations / AI-Governance). Each card shows the live
 * health score (base + live caps), worst-case certification, declared lead and
 * state (as written in the operating map, not verified), KPI, and its
 * capabilities with per-capability certification (OVERCLAIM highlight when a
 * live capability has no evidence).
 */
import { type CommandCenterResponseV2 } from "@repo/registry";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { CertBadge, scoreTextClass } from "./badges";

const MODE_LABELS = {
  human: "Humain",
  software: "Logiciel",
  hybrid: "Hybride",
};

function departmentProfileHref(
  profileRef: string,
  departmentId: string,
  gitSha: string | null,
): string | null {
  if (
    !gitSha ||
    !/^[a-f0-9]{40}$/i.test(gitSha) ||
    !/^[a-z][a-z0-9-]*$/.test(departmentId)
  )
    return null;
  const expected = `audit/automecanik-departments-map.md#department-${departmentId}`;
  return profileRef === expected
    ? `https://github.com/ak125/nestjs-remix-monorepo/blob/${gitSha}/${expected}`
    : null;
}

const priorityVariant: Record<
  string,
  "destructive" | "warning" | "info" | "subtle"
> = {
  P0: "destructive",
  P1: "warning",
  P2: "info",
  P3: "subtle",
};

export function ModuleGrid({ data }: { data: CommandCenterResponseV2 }) {
  const capsByOwner = new Map<
    string,
    CommandCenterResponseV2["capabilities"]
  >();
  for (const c of data.capabilities) {
    const arr = capsByOwner.get(c.owner) ?? [];
    arr.push(c);
    capsByOwner.set(c.owner, arr);
  }

  return (
    <section
      aria-label="Responsabilités"
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      {[...data.departments]
        .sort((a, b) => a.business_number - b.business_number)
        .map((d) => {
          const caps = capsByOwner.get(d.id) ?? [];
          const profileHref = departmentProfileHref(
            d.profile_ref,
            d.id,
            data.git_sha,
          );
          const humanWithoutSoftware =
            d.operating_mode === "human" && d.capabilities.length === 0;
          return (
            <Card
              key={d.id}
              role="article"
              aria-label={d.label}
              data-business-number={d.business_number}
              className="flex min-w-0 flex-col break-words"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle role="heading" aria-level={3} className="text-sm">
                    <span className="mr-2">#{d.business_number}</span>
                    <span>{d.label}</span>
                  </CardTitle>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    {d.priority ? (
                      <Badge variant={priorityVariant[d.priority] ?? "subtle"}>
                        {d.priority}
                      </Badge>
                    ) : null}
                    <CertBadge value={d.certification} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rôle déclaré : {d.lead} · état déclaré : {d.state}
                </p>
                <p className="text-xs">
                  {d.accountable_owner ?? "Responsable non nommé"}
                </p>
                <p className="text-xs text-muted-foreground">
                  ID : {d.id} · Mode : {MODE_LABELS[d.operating_mode]}
                </p>
                <p className="text-xs text-muted-foreground">
                  Domaines :{" "}
                  {d.repo_domains.length
                    ? d.repo_domains.join(", ")
                    : "aucun domaine logiciel rattaché"}
                </p>
                <div>
                  <Badge variant="subtle">{d.family}</Badge>
                </div>
                {d.kpi_primary ? (
                  <p className="text-xs text-muted-foreground">
                    KPI : {d.kpi_primary}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="flex grow flex-col gap-3">
                {humanWithoutSoftware ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune capacité logicielle rattachée ; activité humaine non
                    évaluée
                  </p>
                ) : (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Score de cartographie
                      </span>
                      <span
                        className={`font-semibold ${scoreTextClass(d.health_score_current)}`}
                      >
                        {d.health_score_current}/100
                      </span>
                    </div>
                    <Progress
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={d.health_score_current}
                      value={d.health_score_current}
                      aria-label={`Score de cartographie ${d.label} : ${d.health_score_current} sur 100`}
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
                )}
                {profileHref ? (
                  <a
                    className="text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2"
                    href={profileHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ouvrir la fiche de {d.label}
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Fiche indisponible pour cette révision
                  </p>
                )}
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
                          <CertBadge value={c.certification} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })}
    </section>
  );
}
